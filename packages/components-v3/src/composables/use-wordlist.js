/**
 * useWordList — bridges alpheios-core's WordlistController into a Vue 3-reactive
 * shape matching `fixtures/wordlist.json`.
 *
 * Returns `{ groups, contextData, loading, hasData, selectWord }`:
 *   groups      — array of { id, name, count, expanded, words: [{ form, pos, ctx }] }
 *   contextData — when a word is selected, its contexts as citation cards
 *   loading     — true while waiting for wordlist data
 *   hasData     — true when at least one wordlist has items
 *   selectWord  — function(langCode, targetWord) to view a word's contexts
 *
 * Sandbox returns empty refs so WordListPage falls back to fixture.
 */

import { ref, onScopeDispose } from 'vue'
import { useAppController } from './use-app-controller.js'

export function useWordList () {
  const controller = useAppController()
  if (!controller) {
    return {
      groups: ref([]),
      contextData: ref(null),
      loading: ref(false),
      hasData: ref(false),
      selectWord: () => {}
    }
  }

  const store = controller._store
  const api = controller.api.app
  const groups = ref([])
  const contextData = ref(null)
  const loading = ref(false)
  const hasData = ref(false)

  function langNameFor (langCode) {
    try {
      return controller.constructor.getLanguageName(langCode).name || langCode
    } catch {
      return langCode
    }
  }

  function rebuild () {
    const wordLists = api.getAllWordLists()
    if (!wordLists) { groups.value = []; hasData.value = false; return }

    const entries = typeof wordLists === 'object' && !Array.isArray(wordLists)
      ? Object.entries(wordLists)
      : []

    let total = 0
    groups.value = entries.map(([langCode, wl]) => {
      const values = (wl && typeof wl.values === 'function')
        ? wl.values() : (Array.isArray(wl && wl.values) ? wl.values : [])
      const words = values.map(item => ({
        form: item.targetWord || '',
        pos: item.lemmasList || '',
        ctx: Array.isArray(item.context) ? item.context.length : 0,
        langCode: item.languageCode || langCode
      }))
      total += words.length
      return {
        id: langCode,
        name: langNameFor(langCode),
        count: words.length,
        expanded: words.length > 0,
        sort: 'A–Z',
        words
      }
    }).filter(g => g.words.length > 0)

    hasData.value = total > 0
  }

  function selectWord (langCode, targetWord) {
    if (!langCode || !targetWord) return
    try {
      api.selectWordItem(langCode, targetWord)
    } catch { /* swallow */ }
    // After selectWordItem dispatches WORDITEM_SELECTED, AppController
    // runs a lexical query. The resulting homonym (with context data) lands
    // in `api.app.homonym`. We watch for that below to build contextData.
  }

  /* ── Vuex watchers ── */
  const unwatchers = []
  unwatchers.push(store.watch(
    (st) => st.app.wordListUpdateTime,
    () => { rebuild() }
  ))

  // When a wordlist item is selected, the homonym gets populated with its
  // saved context history. Watch homonymDataReady for context view updates.
  unwatchers.push(store.watch(
    (st) => [st.app.homonymDataReady, st.app.wordListUpdateTime],
    () => {
      const homonym = api.homonym || (api.app && api.app.homonym)
      if (!homonym || !homonym.targetWord) { contextData.value = null; return }

      // Build context cards from the selected WordItem's context selectors
      const lex = (homonym.lexemes && homonym.lexemes[0]) || {}
      const langInfo = controller.constructor.getLanguageName(homonym.languageID)

      // The WordItem's context lives on item.context (TextQuoteSelector[])
      // which is available via the homonym after selection. For now we derive
      // a basic context view from whatever is available.
      const items = []
      // Context from homonym — textQuoteSelector may be on the homonym itself
      const tqs = homonym.textQuoteSelector || null
      if (tqs) {
        items.push({
          label: 'Context · 1',
          when: '',
          quote: tqs.prefix
            ? `${tqs.prefix}<mark>${tqs.normalizedText || homonym.targetWord}</mark>${tqs.suffix || ''}`
            : homonym.targetWord,
          source: tqs.source || '',
          link: tqs.source || '#'
        })
      }

      contextData.value = {
        word: homonym.targetWord,
        lang: langInfo.name,
        count: items.length,
        items,
        footerMeta: `${homonym.targetWord} · ${langInfo.name} · ${items.length} contexts`
      }
    }
  ))

  // Initial load
  rebuild()

  onScopeDispose(() => {
    unwatchers.forEach(u => { try { u() } catch { /* swallow */ } })
  })

  return { groups, contextData, loading, hasData, selectWord }
}
