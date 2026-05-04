/**
 * useResources — bridges alpheios-core wordUsageExamples + grammarData into
 * a Vue 3-reactive shape matching `fixtures/resources.json`.
 *
 * Returns `{ usageData, grammarData, treeData }` — each is a ref (null when
 * no live data is available, so the page falls back to fixture props).
 *
 * Sandbox returns null refs so ResourcesPage falls back to fixture.
 */

import { ref, onScopeDispose } from 'vue'
import { useAppController } from './use-app-controller.js'

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
      usageData.value = null
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
      footerMeta: `${wue.targetWord || ''} · ${examples.length} quotes · ${authorEntries.length} authors`
    }
  }

  /* ── Grammar ── */
  function buildGrammar () {
    const langCode = store.state.app.currentLanguageCode
    if (!langCode) { grammarData.value = null; return }
    const gd = api.grammarData && api.grammarData[langCode]
    if (!gd || !gd.url) { grammarData.value = null; return }

    grammarData.value = {
      language: store.state.app.currentLanguageName || langCode,
      sourceCount: 1,
      linkedFrom: `Grammar reference for ${store.state.app.currentLanguageName || langCode}`,
      sources: [
        { id: 'live', title: gd.provider || 'Grammar reference', meta: gd.url, active: true }
      ],
      reading: {
        anchor: gd.provider || 'Grammar',
        title: 'Open grammar reference',
        blocks: [
          { type: 'p', html: `Open the full grammar via <a class="alph-resources__crossref" href="${gd.url}" target="_blank" rel="noopener">${gd.provider || 'this link'}</a>.` }
        ]
      },
      footerMeta: gd.provider || 'Grammar'
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
        suppressTree: lexisState.suppressTree
      }
    } else {
      treeData.value = null
    }
  }

  async function refreshUsage () {
    const homonym = api.homonym
    const hasLexemes = !!(homonym && Array.isArray(homonym.lexemes) && homonym.lexemes.length)
    if (!hasLexemes || !homonym.targetWord || !homonym.languageID) return
    await api.getWordUsageData(homonym)
  }

  async function refreshGrammar () {
    const languageID = store.state.app.currentLanguageID
    if (!languageID) return
    await api.restoreGrammarIndex(languageID)
  }

  async function refreshTree () {
    const languageID = store.state.app.currentLanguageID
    if (!languageID) return
    api.startResourceQuery({ type: 'treebank', value: '', languageID })
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

  if (store.state.app.wordUsageExamplesReady) buildUsage()
  buildGrammar()
  buildTree()

  onScopeDispose(() => {
    unwatchers.forEach(u => { try { u() } catch { /* swallow */ } })
  })

  return { usageData, grammarData, treeData, refreshUsage, refreshGrammar, refreshTree }
}
