/**
 * useWordList — bridges alpheios-core's WordlistController into a Vue 3-reactive
 * shape consumed by WordListPage.
 *
 * Returns `{ groups, contextData, loading, hasData, selectWord }`:
 *   groups      — array of { id, name, count, expanded, words: [{ form, pos, ctx }] }
 *   contextData — when a word is selected, its contexts as citation cards
 *   loading     — true while waiting for wordlist data
 *   hasData     — true when at least one wordlist has items
 *   selectWord  — function(langCode, targetWord) to view a word's contexts
 *
 * Sandbox returns empty refs so WordListPage shows an explicit empty state.
 */

import { ref, onScopeDispose } from 'vue'
import { useAppController } from './use-app-controller.js'
import {
  buildWordListGroups,
  csvForWordList,
  parseWordListImport
} from '../lib/wordlist-helpers.js'

export function useWordList () {
  const controller = useAppController()
  if (!controller) {
    return {
      groups: ref([]),
      contextData: ref(null),
      loading: ref(false),
      hasData: ref(false),
      selectWord: () => {},
      addCurrentLookup: () => false,
      exportList: () => false,
      importFile: () => Promise.resolve(false),
      rebuild: () => {}
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
    groups.value = buildWordListGroups({ wordLists, langNameFor })

    const total = groups.value.reduce((sum, group) => sum + group.words.length, 0)
    hasData.value = total > 0
  }

  function addCurrentLookup () {
    const homonym = api.homonym || (api.app && api.app.homonym)
    if (!homonym || !homonym.targetWord || !controller._wordlistC) return false
    controller._wordlistC.onHomonymReady(homonym)
    if (homonym.hasShortDefs && typeof controller._wordlistC.onDefinitionsReady === 'function') {
      controller._wordlistC.onDefinitionsReady({ requestType: 'shortDefs', homonym })
    }
    rebuild()
    return true
  }

  function exportList () {
    const words = groups.value.flatMap(group => group.words)
    if (!words.length || typeof document === 'undefined' || typeof Blob === 'undefined') return false
    const data = csvForWordList(words)
    const blob = new Blob([data], { type: 'text/tab-separated-values' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'alpheios-wordlist.tsv'
    ;(document.getElementById('alpheios-panel-inner') || document.body).appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    return true
  }

  async function importFile (file) {
    if (!file || !controller._wordlistC) return false
    const text = await file.text()
    const fallbackLangCode = store.state.app.selectedLookupLangCode ||
      store.state.app.currentLanguageCode ||
      'lat'
    const items = parseWordListImport(text, fallbackLangCode)
    if (!items.length) return false

    for (const item of items) {
      const wordItem = controller._wordlistC.getWordListItem(item.languageCode, item.targetWord, true)
      if (item.definition) wordItem.shortMeaning = item.definition
      const textSelector = createWordlistTextSelector(item.targetWord, item.languageCode)
      if (textSelector && controller.api.lexis && typeof controller.api.lexis.lookupForWordlist === 'function') {
        await controller.api.lexis.lookupForWordlist(textSelector)
      }
    }
    rebuild()
    return true
  }

  function createWordlistTextSelector (text, langCode) {
    const langDetails = controller.constructor.getLanguageName(langCode)
    const languageID = langDetails && langDetails.id
    if (!languageID) return null
    return {
      text,
      languageID,
      data: {},
      location: '',
      get normalizedText () { return this.text },
      get languageCode () { return langCode },
      isEmpty () { return !this.text }
    }
  }

  function selectWord (langCode, targetWord) {
    if (!langCode || !targetWord) return
    contextData.value = {
      word: targetWord,
      lang: langNameFor(langCode),
      count: 0,
      items: [],
      footerMeta: `${targetWord} · loading contexts`
    }
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

  return { groups, contextData, loading, hasData, selectWord, addCurrentLookup, exportList, importFile, rebuild }
}
