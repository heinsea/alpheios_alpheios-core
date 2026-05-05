/**
 * useLookup — bridges alpheios-core's Vuex `app` namespace + `api.app.homonym`
 * into a Vue 3-reactive ref consumed by LookupPage and MorphPage.
 *
 * Returns `{ state, data, targetWord, loading, error, rebuild }`:
 *   state       — 'idle' | 'loading' | 'success' | 'no-result'
 *                 (idle: nothing has been looked up yet; success: homonym
 *                 with at least one lexeme; no-result: a lexical request
 *                 has finished without a homonym).
 *   data        — live lookup object when state === 'success', else null.
 *   targetWord  — the most recent target word string, even when no homonym
 *                 came back (lets the page show "couldn't find <word>").
 *   loading     — true while `lexicalRequest.startTime > endTime`.
 *   error       — reserved for Stage 4c+ (currently always null).
 *
 * Sandbox / unit-tests (no AppController provided) get inert refs:
 *   state='idle', data=null, targetWord='', loading=false, error=null.
 *
 * Reactivity strategy: Vuex 3's `store.watch()` creates a Vue 2 reactive
 * subscription. Each watcher's unwatch fn is collected and disposed in
 * `onScopeDispose`.
 */

import { ref, onScopeDispose } from 'vue'
import { useAppController } from './use-app-controller.js'

export function useLookup () {
  const controller = useAppController()
  if (!controller) {
    return {
      state: ref('idle'),
      data: ref(null),
      targetWord: ref(''),
      lang: ref(''),
      loading: ref(false),
      error: ref(null)
    }
  }

  const store = controller._store
  const state = ref('idle')
  const data = ref(null)
  const targetWord = ref('')
  const lang = ref('')
  const loading = ref(false)
  const error = ref(null)

  function langInfoFor (languageID) {
    return (controller.constructor && typeof controller.constructor.getLanguageName === 'function')
      ? controller.constructor.getLanguageName(languageID)
      : { name: '', code: '' }
  }

  function rebuild () {
    const s = store.state.app
    const homonym = controller.api.app.homonym
    const lexemes = homonym && Array.isArray(homonym.lexemes) ? homonym.lexemes : []
    const reqInFlight = s.lexicalRequest.startTime > s.lexicalRequest.endTime
    const reqEverFinished = s.lexicalRequest.endTime > 0

    /* targetWord is tracked independently of homonym readiness so the
     * "no-result" view can still echo what the user looked up. */
    targetWord.value = s.targetWord || ''
    if (homonym && homonym.languageID !== undefined) {
      lang.value = langInfoFor(homonym.languageID).name
    } else if (s.currentLanguageID !== undefined) {
      lang.value = langInfoFor(s.currentLanguageID).name
    }

    loading.value = reqInFlight

    if (reqInFlight) {
      state.value = 'loading'
      data.value = null
      return
    }

    if (s.homonymDataReady && lexemes.length > 0) {
      state.value = 'success'
      data.value = projectHomonym(homonym, lexemes, s)
      return
    }

    if (reqEverFinished) {
      state.value = 'no-result'
      data.value = null
      return
    }

    state.value = 'idle'
    data.value = null
  }

  function projectHomonym (homonym, lexemes, s) {
    const langInfo = langInfoFor(homonym.languageID)

    /* ── Definitions ──
     * Some valid Latin entries, especially indeclinables/conjunctions such as
     * `quamquam`, are most useful only after full lexicon data arrives. v2
     * renders those from `meaning.fullDefs`; v3 must not treat them as empty.
     */
    let definitions = []
    if (s.shortDefUpdateTime > 0 || s.fullDefUpdateTime > 0) {
      definitions = lexemes.flatMap(lex => {
        const meaning = lex && lex.meaning
        if (!meaning) return []
        const shortDefs = Array.isArray(meaning.shortDefs) ? meaning.shortDefs : []
        const fullDefs = Array.isArray(meaning.fullDefs) ? meaning.fullDefs : []
        return [...shortDefs, ...fullDefs].map(d => d && d.text ? d.text : '').filter(Boolean)
      })
    }

    /* ── POS features ── */
    const posList = []
    const feats = lexemes[0] && lexemes[0].lemma && lexemes[0].lemma.features
    if (feats) {
      const pushFeat = (key, kind) => {
        const f = feats[key]
        if (!f) return
        const val = typeof f.value === 'string' ? f.value : (f.values && f.values.map(v => v.value).join(' · '))
        if (val) posList.push({ kind, label: cap(val) })
      }
      pushFeat('part of speech', 'primary')
      pushFeat('gender', 'feature')
      pushFeat('number', 'feature')
      pushFeat('case', 'feature')
      pushFeat('declension', 'feature')
    }

    /* ── Morph cards (with rows populated from inflections) ── */
    const morph = lexemes.map(lex => {
      const rows = []
      const seenTypes = new Set()

      // Helper: push a row, avoiding duplicates by feature type
      const pushRow = (label, value, lang) => {
        if (!value || seenTypes.has(label)) return
        seenTypes.add(label)
        rows.push({
          label,
          value: typeof value === 'string' ? value : String(value),
          lang
        })
      }

      // Include stem/prefix/suffix if available
      if (Array.isArray(lex.inflections)) {
        lex.inflections.forEach(infl => {
          if (!infl) return
          if (infl.stem) pushRow('Stem', infl.stem.value || infl.stem, true)
          if (infl.suffix) pushRow('Suffix', infl.suffix.value || infl.suffix, true)
          if (infl.prefix) pushRow('Prefix', infl.prefix.value || infl.prefix, true)

          // Iterate over grammatical features
          if (infl.features && infl.features.forEach) {
            infl.features.forEach(featureType => {
              const feat = infl[featureType]
              if (feat && feat.value) {
                pushRow(cap(featureType), feat.value, false)
              } else if (feat && Array.isArray(feat.values)) {
                pushRow(cap(featureType), feat.values.map(v => v.value).join(' · '), false)
              }
            })
          }
        })
      }

      // Principal parts from lemma
      if (lex.lemma && Array.isArray(lex.lemma.principalParts) && lex.lemma.principalParts.length) {
        pushRow('Principal parts', lex.lemma.principalParts.join(', '), true)
      }

      return {
        lemma: lex.lemma && lex.lemma.word ? lex.lemma.word : '',
        meta: (lex.lemma && lex.lemma.features && lex.lemma.features['part of speech'] && lex.lemma.features['part of speech'].value) || '',
        expanded: false,
        rows
      }
    })

    /* ── Principal parts (from first lexeme's lemma) ── */
    const principalParts = []
    if (lexemes[0] && lexemes[0].lemma && Array.isArray(lexemes[0].lemma.principalParts)) {
      lexemes[0].lemma.principalParts.forEach((part, i) => {
        principalParts.push({ label: i === 0 ? 'Principal parts' : '', value: typeof part === 'string' ? part : String(part), lang: true })
      })
    }

    /* ── Providers ── */
    const providers = Array.isArray(s.providers)
      ? s.providers.map(p => ({
        name: (p && p.toString && p.toString()) || (p && p.uri) || '',
        scope: ''
      })).filter(p => p.name)
      : []

    return {
      lemma: homonym.targetWord || (lexemes[0] && lexemes[0].lemma && lexemes[0].lemma.word) || '',
      lang: langInfo.name,
      langCode: langInfo.code,
      selectedText: s.selectedText,
      recognized: lexemes.length > 0,
      pos: posList,
      morph,
      definitions,
      citation: null,
      principalParts,
      providers
    }
  }

  /* ── Vuex 3 watchers ── */
  const unwatchers = []
  unwatchers.push(store.watch((st) => st.app.homonymDataReady, rebuild, { immediate: true }))
  unwatchers.push(store.watch((st) => st.app.shortDefUpdateTime, rebuild))
  unwatchers.push(store.watch((st) => st.app.fullDefUpdateTime, rebuild))
  unwatchers.push(store.watch((st) => st.app.morphDataReady, rebuild))
  unwatchers.push(store.watch((st) => st.app.targetWord, rebuild))
  unwatchers.push(store.watch(
    (st) => [st.app.lexicalRequest.startTime, st.app.lexicalRequest.endTime],
    rebuild
  ))

  onScopeDispose(() => {
    unwatchers.forEach(u => { try { u() } catch { /* swallow */ } })
  })

  return { state, data, targetWord, lang, loading, error, rebuild }
}

function cap (s) {
  if (typeof s !== 'string' || s.length === 0) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}
