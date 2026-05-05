/**
 * useResources — bridges alpheios-core wordUsageExamples + grammarData into
 * a Vue 3-reactive shape consumed by ResourcesPage.
 *
 * Returns `{ usageData, grammarData, treeData }` — each is a ref (null when
 * no live data is available, so App.vue supplies explicit empty states).
 *
 * Sandbox returns null refs so ResourcesPage shows explicit empty states.
 */

import { ref, onScopeDispose } from 'vue'
import { useAppController } from './use-app-controller.js'

const OFFICIAL_READER_URL = 'https://texts.alpheios.net/text/urn%3Acts%3AlatinLit%3Aphi0959.phi006.alpheios-text-lat1/passage/1.163-1.183'
const OFFICIAL_GRAMMAR_URL = 'https://grammars.alpheios.net/allen-greenough/index.htm?ts=1777980366365#table-of-contents'

function isOfficialTextsPage () {
  try { return window.location.hostname === 'texts.alpheios.net' } catch { return false }
}

export function useResources () {
  const controller = useAppController()
  if (!controller) {
    return {
      usageData: ref(null),
      grammarData: ref(null),
      treeData: ref(null),
      refreshUsage: async () => {},
      refreshGrammar: async () => {},
      refreshTree: async () => {}
    }
  }

  const store = controller._store
  const api = controller.api.app
  const usageData = ref(null)
  const grammarData = ref(null)
  const treeData = ref(null)

  /* ── Word Usage Examples ── */
  function buildUsage () {
    const wue = api.wordUsageExamples
    if (!wue || !wue.wordUsageExamples || !Array.isArray(wue.wordUsageExamples) || !wue.wordUsageExamples.length) {
      if (store.state.app.homonymDataReady && api.homonym) {
        const word = api.homonym.targetWord || ''
        usageData.value = {
          word,
          totalQuotes: 0,
          authorsCount: 0,
          filterAuthor: 'all',
          authorChips: [{ id: 'all', label: 'All authors', count: null }],
          groups: [],
          officialReaderUrl: OFFICIAL_READER_URL,
          isOfficialTextsPage: isOfficialTextsPage(),
          footerMeta: word ? `${word} · no usage examples` : 'No usage examples'
        }
      } else {
        usageData.value = null
      }
      return
    }
    const examples = wue.wordUsageExamples

    const authorMap = new Map()
    examples.forEach(ex => {
      const authorName = (ex.author && ex.author.title && ex.author.title()) || ex.formattedAuthor || 'Unknown'
      if (!authorMap.has(authorName)) authorMap.set(authorName, [])
      authorMap.get(authorName).push({
        text: ex.htmlExample ||
          `${ex.prefix || ''}<mark>${ex.normalizedText || ''}</mark>${ex.suffix || ''}`,
        ref: [ex.formattedTextWork, ex.formattedPassage || ex.cit].filter(Boolean).join(' ') || ex.source || '',
        link: ex.source || '#'
      })
    })

    const authorEntries = Array.from(authorMap.entries())
    const groups = authorEntries.map(([author, quotes]) => {
      const maxShow = 3
      return {
        author,
        meta: '',
        remaining: quotes.length > maxShow ? quotes.length - maxShow : 0,
        quotes: quotes.slice(0, maxShow)
      }
    })

    usageData.value = {
      word: wue.targetWord || '',
      totalQuotes: examples.length,
      authorsCount: authorEntries.length,
      filterAuthor: 'all',
      authorChips: [
        { id: 'all', label: 'All authors', count: null },
        ...authorEntries.map(([author, quotes]) => ({
          id: author.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20),
          label: author,
          count: quotes.length
        }))
      ],
      groups,
      officialReaderUrl: OFFICIAL_READER_URL,
      isOfficialTextsPage: isOfficialTextsPage(),
      footerMeta: `${wue.targetWord || ''} · ${examples.length} quotes · ${authorEntries.length} authors`
    }
  }

  /* ── Grammar ── */
  function buildGrammar () {
    const langCode = store.state.app.currentLanguageCode
    if (!langCode) { grammarData.value = null; return }
    const gd = api.grammarData && api.grammarData[langCode]
    if (!gd || !gd.url) {
      if (store.state.app.homonymDataReady) {
        grammarData.value = {
          language: store.state.app.currentLanguageName || langCode,
          sourceCount: 0,
          linkedFrom: 'No grammar reference available for this lookup.',
          sources: [],
          browserUrl: OFFICIAL_GRAMMAR_URL,
          reading: {
            anchor: 'Grammar',
            title: 'No grammar reference available',
            blocks: [
              { type: 'p', html: 'Alpheios did not return a grammar resource for the current language and selection.' }
            ]
          },
          footerMeta: 'No grammar data'
        }
      } else {
        grammarData.value = null
      }
      return
    }

    grammarData.value = {
      language: store.state.app.currentLanguageName || langCode,
      sourceCount: 1,
      linkedFrom: `Grammar reference for ${store.state.app.currentLanguageName || langCode}`,
      browserUrl: OFFICIAL_GRAMMAR_URL,
      sources: [
        { id: 'live', title: gd.provider || 'Allen and Greenough', meta: gd.url, url: gd.url, active: true }
      ],
      reading: {
        anchor: gd.provider || 'Grammar',
        title: 'Open grammar reference',
        blocks: [
          { type: 'p', html: `Open the full grammar via <a class="alph-resources__crossref" href="${gd.url}" target="_blank" rel="noopener">${gd.provider || 'this link'}</a>.` }
        ]
      },
      footerMeta: `${gd.provider || 'Grammar'} · official browser`
    }
  }

  /* ── Treebank ── */
  function buildTree () {
    const lexisState = store.state.lexis
    if (lexisState && lexisState.treebankSrc) {
      treeData.value = {
        ref: 'Live treebank',
        textStrip: '',
        nodes: [],
        footerMeta: 'Treebank active',
        treebankSrc: lexisState.treebankSrc,
        officialReaderUrl: OFFICIAL_READER_URL,
        isOfficialTextsPage: isOfficialTextsPage(),
        suppressTree: lexisState.suppressTree,
        kind: 'live'
      }
      return
    }
    // Distinguish "no live data yet" from "live homonym exists but the host
    // page has no Arethusa treebank metadata". Once a real lookup has
    // happened, we surface an explicit empty-state instead of sample data.
    if (store.state.app.homonymDataReady) {
      treeData.value = {
        ref: '',
        textStrip: '',
        nodes: [],
        footerMeta: 'No treebank for this page',
        treebankSrc: null,
        officialReaderUrl: OFFICIAL_READER_URL,
        isOfficialTextsPage: isOfficialTextsPage(),
        suppressTree: false,
        kind: 'no-metadata'
      }
      return
    }
    treeData.value = null
  }

  async function refreshUsage () {
    const homonym = api.homonym
    const hasLexemes = !!(homonym && Array.isArray(homonym.lexemes) && homonym.lexemes.length)
    if (!hasLexemes || !homonym.targetWord || !homonym.languageID) return
    await api.getWordUsageData(homonym)
    buildUsage()
  }

  async function refreshGrammar () {
    const languageID = store.state.app.currentLanguageID
    if (!languageID) return
    await api.restoreGrammarIndex(languageID)
  }

  async function refreshTree () {
    // Treebank state is *passively* driven by the lexis module: it reads
    // Arethusa-style metadata from the page DOM (TreebankDataItem.getTreebankData)
    // when the module loads, and updates `lexis.treebankSrc` again on every
    // selection. There is no legitimate manual trigger — calling
    // `startResourceQuery({type:'treebank',...})` actually routes through
    // ResourceQuery's grammar iterator (resource-query.js#iterations), which
    // ignores the `type` field and just publishes GRAMMAR_NOT_FOUND. So this
    // function intentionally does nothing; the page-watcher in App.vue only
    // keeps it for routing symmetry. The `treeData` ref will fill itself via
    // the store.watch on `lexis.treebankSrc` set up in the body above.
  }

  /* ── Watchers ── */
  const unwatchers = []
  unwatchers.push(store.watch(
    (st) => st.app.wordUsageExamplesReady,
    (val) => { if (val) buildUsage() }
  ))
  unwatchers.push(store.watch(
    (st) => st.app.updatedGrammar,
    () => { buildGrammar() }
  ))
  unwatchers.push(store.watch(
    (st) => st.lexis && st.lexis.treebankSrc,
    () => { buildTree() }
  ))
  // Proactively fetch word-usage examples whenever a homonym becomes
  // available — `enableWordUsageExamples` (Latin + feature flag) gates the
  // request inside `getWordUsageData`, so this is safe to fire for every
  // language; non-Latin queries no-op. We watch `homonymDataReady` instead
  // of the homonym ref directly because Vuex 3 does not deeply observe
  // assignments to api.app.homonym.
  unwatchers.push(store.watch(
    (st) => st.app.homonymDataReady,
    async (ready) => {
      if (!ready) return
      const homonym = api.homonym
      if (!homonym || !homonym.targetWord || !homonym.languageID) return
      try {
        await api.getWordUsageData(homonym)
        buildUsage()
      } catch { /* swallow — buildUsage falls back */ }
    }
  ))

  // `homonymDataReady` may stay `true` across consecutive lookups, so we also
  // watch lexical request completion to refresh usage data for every query.
  unwatchers.push(store.watch(
    (st) => st.app.lexicalRequest.endTime,
    async (endTime) => {
      if (!endTime) return
      const homonym = api.homonym
      if (!homonym || !homonym.targetWord || !homonym.languageID) return
      try {
        await api.getWordUsageData(homonym)
        buildUsage()
      } catch { /* swallow — buildUsage falls back */ }
    }
  ))

  if (store.state.app.wordUsageExamplesReady) buildUsage()
  buildGrammar()
  buildTree()

  onScopeDispose(() => {
    unwatchers.forEach(u => { try { u() } catch { /* swallow */ } })
  })

  return { usageData, grammarData, treeData, refreshUsage, refreshGrammar, refreshTree }
}
