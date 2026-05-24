/**
 * useInflections — bridges alpheios-core's ViewSet / View into a
 * Vue 3-reactive shape consumed by InflectionsPage.
 *
 * Returns `{ matchedData, browserData, hasData, loading }`:
 *   matchedData — table rows/columns/footnotes for the "From lookup" mode
 *   browserData — available languages, POS, paradigms for the picker mode
 *   hasData     — true when the ViewSet has matching inflection views
 *   loading     — true while rendering
 *
 * IMPORTANT: View.render() must be called before reading wideView / footnotes.
 * This composable calls it lazily on first access.
 *
 * Sandbox returns null refs so InflectionsPage shows an explicit empty state.
 */

import { ref, onScopeDispose } from 'vue'
import { useAppController } from './use-app-controller.js'
import InflTablesList from '../data/inflections-browser-tables.json'

export function useInflections () {
  const controller = useAppController()
  if (!controller) {
    return {
      matchedData: ref(null),
      browserData: ref(null),
      hasData: ref(false),
      loading: ref(false)
    }
  }

  const api = controller.api.app
  const store = controller._store
  const matchedData = ref(null)
  const browserData = ref(null)
  const hasData = ref(false)
  const loading = ref(false)

  function buildBrowser () {
    const currentCode = store.state.app.currentLanguageCode
    const language = currentCode === 'grc' ? 'Greek' : 'Latin'
    const langCode = currentCode === 'grc' ? 'grc' : 'lat'
    const langTables = InflTablesList[langCode] || {}
    const posOptions = Object.keys(langTables)
    const firstPos = posOptions[0] || ''
    const firstParadigm = firstPos && langTables[firstPos] && langTables[firstPos][0]
      ? langTables[firstPos][0].title
      : ''

    browserData.value = {
      language,
      languageCode: langCode,
      languages: ['Latin', 'Greek'],
      pos: firstPos,
      posOptions,
      paradigm: firstParadigm,
      paradigmOptions: firstPos && langTables[firstPos] ? langTables[firstPos].map(t => t.title) : [],
      paradigmMeta: firstParadigm ? 'Standard forms from the Alpheios inflection tables.' : 'No standard tables available.',
      voice: '',
      mood: '',
      preview: { columns: [], rows: [] },
      catalog: InflTablesList,
      footerMeta: 'Browse inflection tables'
    }
  }

  /**
   * Extract column headers from a rendered View.
   * The first column is always the row-head label. Additional columns come
   * from view.table.headers (Row objects with cells).
   */
  function extractColumns (view) {
    const cols = ['']
    if (view.table && Array.isArray(view.table.headers) && view.table.headers.length) {
      // Take the first header row's cells as column labels
      const headerRow = view.table.headers[0]
      if (headerRow && Array.isArray(headerRow.cells)) {
        headerRow.cells.forEach(cell => {
          cols.push(cell.value || cell.title || '')
        })
      }
    }
    // Fallback: derive column count from the first data row
    if (cols.length <= 1 && view.wideView && view.wideView.rows && view.wideView.rows.length) {
      const firstRow = view.wideView.rows[0]
      const dataCellCount = (firstRow.cells || []).filter(c => c.isDataCell).length
      for (let i = 0; i < dataCellCount; i++) {
        cols.push(`Col ${i + 1}`)
      }
    }
    return cols
  }

  /**
   * Extract table rows from a rendered View's wideView.
   * Each wideView row has: a RowTitleCell (head) + data Cells.
   */
  function extractRows (view) {
    if (!view.wideView || !Array.isArray(view.wideView.rows)) return []
    return view.wideView.rows.map(row => {
      const cells = row.cells || []
      const headCell = cells.find(c => !c.isDataCell)
      const dataCells = cells.filter(c => c.isDataCell)
      return {
        head: headCell ? (headCell.value || '') : '',
        cells: dataCells.map(cell => {
          const morph = (cell.morphemes && cell.morphemes[0]) || {}
          const isMatch = !!(morph.match && (morph.match.suffixMatch || morph.match.morphologyMatch))
          return {
            value: morph.value || '',
            lang: true,
            match: isMatch,
            secondary: morph.match && morph.match.morphologyMatch ? 'match' : ''
          }
        })
      }
    })
  }

  /**
   * Extract footnotes from a rendered View as an array of HTML strings.
   */
  function extractFootnotes (view) {
    if (!view.footnotes || !(view.footnotes instanceof Map)) return []
    const notes = []
    view.footnotes.forEach((note) => {
      notes.push(typeof note === 'string' ? note : (note.text || note.toString()))
    })
    return notes
  }

  /**
   * Build filter chips from ViewSet's available parts of speech.
   */
  function extractFilterChips (viewSet) {
    const posList = viewSet.partsOfSpeech || []
    if (!posList.length) return [{ id: 'all', label: 'All', active: true }]
    return posList.map((pos, i) => ({
      id: pos.toLowerCase().replace(/\s+/g, '-'),
      label: pos.charAt(0).toUpperCase() + pos.slice(1),
      active: i === 0
    }))
  }

  function rebuild () {
    const viewSet = api.getInflectionsViewSet()
    if (!viewSet || !viewSet.hasMatchingViews) {
      hasData.value = false
      matchedData.value = null
      return
    }

    hasData.value = true
    const allViews = viewSet.getViews()
    if (!allViews.length) return

    // ── Matched mode: use the first renderable view ──
    const matchedView = allViews.find(v => v.isRenderable) || allViews[0]
    try {
      if (matchedView.isRenderable && !matchedView.isRendered) {
        loading.value = true
        matchedView.render()
        loading.value = false
      }
    } catch {
      loading.value = false
      // render() failed — leave matchedData as null so App.vue shows empty state
      return
    }

    const homonym = viewSet.homonym || {}

    matchedData.value = {
      lemma: homonym.targetWord || '',
      pos: matchedView.partOfSpeech || '',
      subhead: matchedView.title || '',
      wordClass: matchedView.partOfSpeech || 'noun',
      density: 'wide',
      filterChips: extractFilterChips(viewSet),
      highlightMatches: true,
      table: {
        columns: extractColumns(matchedView),
        rows: extractRows(matchedView),
        tfoot: ''
      },
      footnotes: extractFootnotes(matchedView),
      credits: matchedView.creditsText || '',
      footerMeta: [homonym.targetWord, matchedView.partOfSpeech].filter(Boolean).join(' · ')
    }
  }

  // Watch for inflection data becoming ready
  const unwatchers = []
  unwatchers.push(store.watch(
    (st) => st.app.hasInflData,
    (val) => { if (val) rebuild() }
  ))

  // Also rebuild when homonym is ready (inflection data arrives after)
  unwatchers.push(store.watch(
    (st) => st.app.homonymDataReady,
    (val) => { if (val) rebuild() }
  ))

  // Consecutive lookups can leave `homonymDataReady` true, so refresh from
  // lexical request completion as well.
  unwatchers.push(store.watch(
    (st) => st.app.lexicalRequest.endTime,
    (endTime) => { if (endTime) rebuild() }
  ))

  // Initial check
  if (store.state.app.hasInflData) rebuild()
  buildBrowser()

  onScopeDispose(() => {
    unwatchers.forEach(u => { try { u() } catch { /* swallow */ } })
  })

  return { matchedData, browserData, hasData, loading, rebuild, buildBrowser }
}
