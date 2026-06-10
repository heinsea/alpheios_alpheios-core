<script setup>
/**
 * ResourcesPage — DESIGN §7 + mockup drawer-resources.html.
 *
 * One component, three modes (driven by `mode` prop, which the App.vue
 * router fills from `uiStore.state.page`):
 *   usage    — quotes grouped by author, chip filters
 *   grammar  — list of grammar sources → reading view
 *   tree     — dependency tree viewer or explicit metadata state
 *
 * Rationale: the three modes share the same panel chrome (topbar +
 * scroll + footer) and similar DOM density, so collapsing them keeps
 * the routing layer flat at a small CSS cost.
 */

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import Chip from '../primitives/Chip.vue'
import Icon from '../primitives/Icon.vue'
import DependencyTree from '../primitives/DependencyTree.vue'
import { uiStore } from '../store/ui-store.js'
import { summarizeTreebankPos } from '../lib/treebank-pos.js'
import { getCatalog, getWorkIndex } from '../lib/treebank-service.js'

const props = defineProps({
  mode: { type: String, required: true }, // 'usage' | 'grammar' | 'tree'
  data: { type: Object, required: true }
})

const emit = defineEmits(['footer-meta', 'load-treebank'])

/* ─── Usage mode local state ─── */
const usage = computed(() => props.data.usage || { authorChips: [], groups: [], word: '', totalQuotes: 0, footerMeta: '', officialReaderUrl: '', isOfficialTextsPage: false })
const authorFilter = ref(usage.value?.filterAuthor ?? 'all')
const sortLabel = ref('by date')
const genreLabel = ref('any')

/* ─── Grammar mode local state ─── */
const GRAMMAR_ORIGIN = 'https://grammars.alpheios.net'
const HOST_MSG_SOURCE = 'alph-grammar-host'   // panel → reader
const READER_MSG_SOURCE = 'alph-grammar'      // reader → panel

const grammar = computed(() => props.data.grammar || { sources: [], books: [], reading: { blocks: [] }, language: '', sourceCount: 0, linkedFrom: '', footerMeta: '', browserUrl: '' })
const grammarFrame = ref(null)
const grammarSrc = ref(grammar.value.browserUrl || '')
const currentUrl = ref(grammarSrc.value)   // live URL reported by the reader bridge
const currentTitle = ref('')
const selectedBookId = ref('')

watch(() => grammar.value.browserUrl, (url) => {
  if (url) { grammarSrc.value = url; currentUrl.value = url }
}, { immediate: true })

const grammarBooks = computed(() => grammar.value.books || [])

// Keep the dropdown synced to whichever book the live URL belongs to.
watch([currentUrl, grammarBooks], () => {
  const url = currentUrl.value || ''
  const match = grammarBooks.value.find(b => url.includes(`/${b.id}/`))
  if (match) selectedBookId.value = match.id
}, { immediate: true })

const activeGrammarBook = computed(() => (
  grammarBooks.value.find(b => b.id === selectedBookId.value) || null
))

const grammarTitle = computed(() => {
  if (currentTitle.value) return currentTitle.value
  return (activeGrammarBook.value && activeGrammarBook.value.title) || grammar.value.language || 'Grammar'
})

const grammarFooterMeta = computed(() => (
  activeGrammarBook.value
    ? (activeGrammarBook.value.source || `${activeGrammarBook.value.title} · official browser`)
    : grammar.value?.footerMeta
))

// True only once the in-frame reader announces itself (Allen & Greenough
// pages). Posting before that — e.g. while loadUrl() has the iframe on the
// transient blank document, or for non-AG books that have no reader bridge —
// would target the wrong origin, and the browser logs a postMessage error that
// try/catch cannot suppress. Gating on the handshake avoids that entirely.
const readerReady = ref(false)

function postToFrame (msg) {
  if (!readerReady.value) return
  try {
    grammarFrame.value?.contentWindow?.postMessage({ source: HOST_MSG_SOURCE, ...msg }, GRAMMAR_ORIGIN)
  } catch (e) { /* frame not ready / cross-origin */ }
}
function postTheme () { postToFrame({ action: 'set-theme', theme: uiStore.state.theme }) }

// Force a (re)load even when the URL is unchanged — Vue would otherwise skip it.
function loadUrl (url) {
  if (!url) return
  readerReady.value = false
  grammarSrc.value = ''
  requestAnimationFrame(() => { grammarSrc.value = url; currentUrl.value = url })
}

function grammarBack () { postToFrame({ action: 'back' }) }
function grammarForward () { postToFrame({ action: 'forward' }) }
function grammarReload () {
  // Re-set src so reload works for every book, including non-AG ones that have
  // no in-frame reader bridge.
  loadUrl(currentUrl.value || grammarSrc.value)
}
function grammarHome () {
  const book = grammarBooks.value.find(b => b.id === selectedBookId.value)
  loadUrl((book && book.url) || grammar.value.browserUrl)
}
function selectBook (id) {
  const book = grammarBooks.value.find(b => b.id === id)
  if (!book) return
  selectedBookId.value = id
  currentTitle.value = ''
  loadUrl(book.url)
}

function onHostMessage (event) {
  if (event.origin !== GRAMMAR_ORIGIN) return
  const data = event.data
  if (!data || data.source !== READER_MSG_SOURCE) return
  if (data.type === 'ready' || data.type === 'state') readerReady.value = true
  if (data.type === 'ready') postTheme()
  if (data.url) currentUrl.value = data.url
  if (typeof data.title === 'string') currentTitle.value = data.title
}

onMounted(() => window.addEventListener('message', onHostMessage))
onBeforeUnmount(() => window.removeEventListener('message', onHostMessage))
watch(() => uiStore.state.theme, () => postTheme())

/* ─── Tree mode local state ─── */
const tree = computed(() => ({
  nodes: [],
  edges: [],
  text: '',
  footerMeta: '',
  officialReaderUrl: '',
  isOfficialTextsPage: false,
  ...(props.data.tree || {})
}))
const treeText = computed(() => tree.value.text || tree.value.textStrip || '')

// Query state — catalog-driven, index loaded via treebank-service.
const treebankCatalog = getCatalog()
const TREE_QUERY_STATE = {
  lang: 'greek',
  docId: 'tlg0012.tlg002.perseus-grc1',
  sentenceId: '',
  position: 0
}

const queryLang = ref(TREE_QUERY_STATE.lang)
const queryDocId = ref(TREE_QUERY_STATE.docId)
const sentenceIndex = ref([]) // _index.json sentences, numerically ordered by official cite
const indexLoading = ref(false)
const indexError = ref(null)
const position = ref(0) // 0-based offset into sentenceIndex
const selectedPassageId = ref('')
const treeSvgRef = ref(null)

const treebankWorks = computed(() => treebankCatalog[queryLang.value] || [])

const selectedWork = computed(() =>
  treebankWorks.value.find(w => w.docId === queryDocId.value)
)

const totalSentences = computed(() => sentenceIndex.value.length)
const currentEntry = computed(() => sentenceIndex.value[position.value] || null)

function passageLabel (entry) {
  return entry?.cite || entry?.id || ''
}

function citeSortParts (entry) {
  return passageLabel(entry)
    .match(/\d+|\D+/g)
    ?.map(part => (/^\d+$/.test(part) ? Number(part) : part)) || ['']
}

function compareCites (a, b) {
  const left = citeSortParts(a)
  const right = citeSortParts(b)
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    if (left[i] === undefined) return -1
    if (right[i] === undefined) return 1
    if (left[i] === right[i]) continue
    if (typeof left[i] === 'number' && typeof right[i] === 'number') return left[i] - right[i]
    return String(left[i]).localeCompare(String(right[i]))
  }
  return 0
}

const passageOptions = computed(() => sentenceIndex.value
  .map((entry, index) => ({ entry, index }))
)

async function loadIndex () {
  const docId = queryDocId.value
  if (!docId) return
  indexLoading.value = true
  indexError.value = null
  sentenceIndex.value = []
  try {
    const { index, source } = await getWorkIndex(docId)
    if (queryDocId.value !== docId) return // user switched works mid-flight
    if (!index || !Array.isArray(index.sentences) || !index.sentences.length) {
      indexError.value = 'Unable to load the sentence index. Check your connection, or install the offline package from Settings.'
      return
    }
    sentenceIndex.value = [...index.sentences].sort(compareCites)
    let startAt = 0
    if (TREE_QUERY_STATE.docId === docId && TREE_QUERY_STATE.sentenceId) {
      const restored = sentenceIndex.value.findIndex(entry => String(entry.id) === String(TREE_QUERY_STATE.sentenceId))
      if (restored >= 0) startAt = restored
    } else if (TREE_QUERY_STATE.docId === docId && TREE_QUERY_STATE.position < sentenceIndex.value.length) {
      startAt = TREE_QUERY_STATE.position
    }
    const startEntry = sentenceIndex.value[startAt]
    selectedPassageId.value = startEntry ? String(startEntry.id) : ''
    goTo(startAt, { force: true })
  } catch (err) {
    if (queryDocId.value === docId) indexError.value = `Failed to load index: ${err.message}`
  } finally {
    if (queryDocId.value === docId) indexLoading.value = false
  }
}

watch(queryDocId, () => {
  TREE_QUERY_STATE.docId = queryDocId.value
  loadIndex()
}, { immediate: true })

// Watch lang change to update docId
watch(queryLang, (newLang) => {
  TREE_QUERY_STATE.lang = newLang
  const works = treebankCatalog[newLang] || []
  if (works.length > 0) {
    const savedDocIsInLang = works.some(work => work.docId === TREE_QUERY_STATE.docId)
    queryDocId.value = savedDocIsInLang ? TREE_QUERY_STATE.docId : works[0].docId
  }
})

// Navigation MUST follow _index.json array order: cite values are passage
// anchors shared by several sentences and ids contain source gaps, so
// neither supports next/previous arithmetic (see DATA-INTEGRITY-AUDIT.md).
function syncSelectorsToPosition () {
  const entry = currentEntry.value
  if (!entry) return
  selectedPassageId.value = String(entry.id)
}

function goTo (pos, { force = false } = {}) {
  if (pos < 0 || pos >= totalSentences.value) return
  if (!force && pos === position.value) return
  position.value = pos
  syncSelectorsToPosition()
  const entry = sentenceIndex.value[pos]
  if (entry) {
    TREE_QUERY_STATE.lang = queryLang.value
    TREE_QUERY_STATE.docId = queryDocId.value
    TREE_QUERY_STATE.position = pos
    TREE_QUERY_STATE.sentenceId = String(entry.id)
    emit('load-treebank', queryDocId.value, entry.id)
  }
}

function selectPassage (sentenceId) {
  selectedPassageId.value = sentenceId
  const pos = sentenceIndex.value.findIndex(entry => String(entry.id) === String(sentenceId))
  if (pos >= 0) goTo(pos, { force: true })
}

const goToFirst = () => goTo(0)
const goToPrevious = () => goTo(position.value - 1)
const goToNext = () => goTo(position.value + 1)
const goToLast = () => goTo(totalSentences.value - 1)
const canGoPrevious = computed(() => position.value > 0)
const canGoNext = computed(() => position.value < totalSentences.value - 1)

function retrySentence () {
  goTo(position.value, { force: true })
}

const selectedTreeTokenIds = ref([])
const selectedTreePos = ref([])
const treePosSummary = computed(() => summarizeTreebankPos(tree.value.nodes || []))
const treePosTotal = computed(() => treePosSummary.value.reduce((sum, item) => sum + item.count, 0))
const treeTokenMap = computed(() => new Map((tree.value.nodes || []).map(node => [Number(node.id), node])))
const activeTreeHighlightIds = computed(() => selectedTreeTokenIds.value)
const selectedTreeTokens = computed(() => (
  activeTreeHighlightIds.value
    .map(id => treeTokenMap.value.get(Number(id)))
    .filter(Boolean)
))
const selectedTreeToken = computed(() => selectedTreeTokens.value[0] || null)
const selectedTreeRelations = computed(() => selectedTreeTokens.value.map(token => ({
  token,
  ...relationsForTreeToken(token)
})))
const initialTreeHighlightIds = computed(() => (
  Array.isArray(tree.value.highlightIds) ? tree.value.highlightIds.map(Number).filter(Number.isFinite) : []
))

function relationsForTreeToken (token) {
  const id = Number(token.id)
  const headEdge = (tree.value.edges || []).find(edge => Number(edge.to) === id)
  const head = headEdge
    ? { relation: headEdge.relation, token: treeTokenMap.value.get(Number(headEdge.from)) || null }
    : null
  const dependents = (tree.value.edges || [])
    .filter(edge => Number(edge.from) === id)
    .map(edge => ({ relation: edge.relation, token: treeTokenMap.value.get(Number(edge.to)) || null }))
    .filter(item => item.token)
  return { head, dependents }
}

watch(() => [tree.value.id, initialTreeHighlightIds.value.join(',')], () => {
  selectedTreeTokenIds.value = initialTreeHighlightIds.value
}, { immediate: true })

function toggleTreePos (pos) {
  selectedTreePos.value = selectedTreePos.value.includes(pos)
    ? selectedTreePos.value.filter(item => item !== pos)
    : [...selectedTreePos.value, pos]
}

function clearTreePos () {
  selectedTreePos.value = []
}

function clearTreeSelection () {
  selectedTreeTokenIds.value = []
}

function selectTreeToken (id) {
  const tokenId = Number(id)
  if (!Number.isFinite(tokenId)) return
  selectedTreeTokenIds.value = selectedTreeTokenIds.value.includes(tokenId)
    ? selectedTreeTokenIds.value.filter(item => item !== tokenId)
    : [...selectedTreeTokenIds.value, tokenId]
}

const footerMeta = computed(() => {
  if (props.mode === 'usage')   return usage.value?.footerMeta
  if (props.mode === 'tree')    return tree.value?.footerMeta
  if (props.mode === 'grammar') return grammarFooterMeta.value
  return ''
})
defineExpose({ footerMeta })

// Push footer text up to App so the drawer footer stays in sync. A parent
// computed reading this via the template ref does not re-track when only the
// child's local state (e.g. selectedBookId) changes, so emit it explicitly.
watch(footerMeta, (v) => emit('footer-meta', v), { immediate: true })
</script>

<template>
  <div class="alph-resources" :class="{ 'alph-resources--fill': mode === 'grammar', 'alph-resources--tree': mode === 'tree' }">

    <!-- ============ USAGE ============ -->
    <template v-if="mode === 'usage'">
      <header class="alph-resources__head">
        <h2>Examples for <span class="lang-classical">{{ usage.word }}</span></h2>
        <span class="alph-resources__head-meta">{{ usage.totalQuotes }} quotes</span>
      </header>

      <div class="alph-resources__chip-row">
        <Chip v-for="c in usage.authorChips" :key="c.id"
              variant="default" clickable
              :active="authorFilter === c.id"
              @click="authorFilter = c.id">
          {{ c.label }}
          <span v-if="c.count" class="alph-resources__chip-count">· {{ c.count }}</span>
        </Chip>
      </div>
      <div class="alph-resources__chip-row alph-resources__chip-row--tight">
        <Chip variant="default" clickable>
          <Icon name="sort" :size="12" />
          Sort: {{ sortLabel }}
        </Chip>
        <Chip variant="default" clickable>
          <Icon name="filter_alt" :size="12" />
          Genre: {{ genreLabel }}
        </Chip>
      </div>

      <section v-for="g in usage.groups" :key="g.author" class="alph-resources__author-group">
        <header class="alph-resources__author-head">
          <span class="alph-resources__author-name lang-classical">{{ g.author }}</span>
          <span class="alph-resources__author-meta">{{ g.meta }}</span>
        </header>

        <article v-for="(q, i) in g.quotes" :key="i" class="alph-resources__quote-card">
          <p class="alph-resources__quote lang-classical" v-html="q.text" />
          <footer class="alph-resources__quote-foot">
            <span v-html="q.ref" />
            <a v-if="q.link" :href="q.link" class="alph-resources__open-link">Open →</a>
          </footer>
        </article>

        <button v-if="g.remaining" class="alph-resources__show-more">
          View {{ g.remaining }} more from {{ g.author }} →
        </button>
      </section>

      <div v-if="!usage.groups.length" class="alph-resources__empty">
        <h3>No usage examples found</h3>
        <p v-if="usage.isOfficialTextsPage">
          This Alpheios Texts page is connected. Select a Latin word in the text, then return here after lookup completes.
        </p>
        <p v-else>
          Word Usage is most useful on Alpheios Texts pages. Open the supported reader as the current page, select a word, and v3 will use the page's live AppController state.
        </p>
        <a v-if="!usage.isOfficialTextsPage && usage.officialReaderUrl" :href="usage.officialReaderUrl" target="_blank" rel="noopener" class="alph-resources__reader-link">
          Open supported reader
        </a>
      </div>
    </template>

    <!-- ============ GRAMMAR ============ -->
    <template v-else-if="mode === 'grammar'">
      <header class="alph-resources__browser-toolbar">
        <div class="alph-resources__browser-controls">
          <button type="button" class="alph-resources__tool-button" aria-label="Grammar home" @click="grammarHome">
            <Icon name="home" :size="14" />
          </button>
          <button type="button" class="alph-resources__tool-button" aria-label="Back" @click="grammarBack">
            <Icon name="arrow_back" :size="14" />
          </button>
          <button type="button" class="alph-resources__tool-button" aria-label="Forward" @click="grammarForward">
            <Icon name="arrow_forward" :size="14" />
          </button>
          <button type="button" class="alph-resources__tool-button" aria-label="Reload" @click="grammarReload">
            <Icon name="refresh" :size="14" />
          </button>
        </div>

        <select
          v-if="grammarBooks.length"
          class="alph-resources__book-select"
          :value="selectedBookId"
          aria-label="Select grammar book"
          @change="selectBook($event.target.value)"
        >
          <option v-for="b in grammarBooks" :key="b.id" :value="b.id">{{ b.label }}</option>
        </select>
        <div v-else class="alph-resources__browser-title">
          <small>{{ grammar.language || 'Latin' }} grammar</small>
        </div>

        <a
          :href="currentUrl || grammar.browserUrl"
          target="_blank"
          rel="noopener"
          class="alph-resources__browser-open"
          aria-label="Open grammar in a new tab"
        >
          <Icon name="open_in_new" :size="14" />
        </a>
      </header>

      <div v-if="grammar.browserUrl" class="alph-resources__grammar-browser">
        <iframe
          ref="grammarFrame"
          :src="grammarSrc"
          class="alph-resources__grammar-iframe"
          :title="`${grammarTitle} grammar`"
          @load="postTheme"
        />
      </div>

      <div v-else class="alph-resources__empty">
        <h3>No grammar source found</h3>
        <p>Alpheios did not return a grammar resource for the current lookup.</p>
      </div>
    </template>

    <!-- ============ TREE ============ -->
    <template v-else-if="mode === 'tree'">
      <div class="alph-resources__tree-container">
      <!-- Query interface - compact -->
      <div class="alph-resources__tree-query">
        <div class="alph-resources__tree-query-compact">
          <select v-model="queryLang" class="alph-resources__tree-query-lang" aria-label="Treebank language">
            <option value="latin">Latin</option>
            <option value="greek">Greek</option>
          </select>
          <select v-model="queryDocId" class="alph-resources__tree-query-text" aria-label="Treebank text">
            <option v-for="work in treebankWorks" :key="work.docId" :value="work.docId">
              {{ work.author }} — {{ work.title }}
            </option>
          </select>
          <div v-if="totalSentences" class="alph-resources__tree-nav">
            <button class="alph-resources__tree-nav-btn" :disabled="!canGoPrevious" aria-label="First passage" @click="goToFirst">⇤</button>
            <button class="alph-resources__tree-nav-btn" :disabled="!canGoPrevious" aria-label="Previous passage" @click="goToPrevious">←</button>
            <select
              class="alph-resources__tree-passage-select"
              :value="selectedPassageId"
              aria-label="Treebank passage"
              @change="selectPassage($event.target.value)"
            >
              <option v-for="item in passageOptions" :key="item.entry.id" :value="item.entry.id">
                {{ passageLabel(item.entry) }}
              </option>
            </select>
            <button class="alph-resources__tree-nav-btn" :disabled="!canGoNext" aria-label="Next passage" @click="goToNext">→</button>
            <button class="alph-resources__tree-nav-btn" :disabled="!canGoNext" aria-label="Last passage" @click="goToLast">⇥</button>
          </div>
        </div>
        <div class="alph-resources__tree-query-info">
          <template v-if="indexLoading">
            Loading sentence index…
          </template>
          <template v-else-if="indexError">
            <span class="alph-resources__tree-error-text">{{ indexError }}</span>
            <button class="alph-resources__tree-retry" @click="loadIndex">Retry</button>
          </template>
          <template v-else-if="selectedWork">
            {{ selectedWork.author }} — {{ selectedWork.title }}
            <template v-if="currentEntry"> · {{ passageLabel(currentEntry) }}</template>
          </template>
          <template v-else>
            Select a text to view treebank data
          </template>
        </div>
      </div>

      <!-- Native dependency tree (structured nodes/edges data) -->
      <template v-if="tree.nodes && tree.nodes.length">
        <div class="alph-resources__tree-toolbar">
          <span class="alph-resources__sentence-id" v-html="tree.ref" />
          <div class="alph-resources__zoom">
            <button type="button" aria-label="Zoom out" @click="treeSvgRef?.zoomOut()">−</button>
            <button type="button" aria-label="Reset view" @click="treeSvgRef?.resetZoom()">⊙</button>
            <button type="button" aria-label="Zoom in" @click="treeSvgRef?.zoomIn()">+</button>
          </div>
          <Chip
            v-if="activeTreeHighlightIds.length"
            variant="default"
            clickable
            aria-label="Clear selected treebank relations"
            @click="clearTreeSelection"
          >
            Clear
          </Chip>
        </div>
        <div v-if="treePosSummary.length" class="alph-resources__tree-filter-row">
          <Chip
            variant="default"
            clickable
            :active="!selectedTreePos.length"
            :aria-label="`Show all ${treePosTotal} tokens`"
            @click="clearTreePos"
          >
            All
            <span class="alph-resources__chip-count">· {{ treePosTotal }}</span>
          </Chip>
          <Chip
            v-for="item in treePosSummary"
            :key="item.pos"
            class="alph-resources__tree-pos-chip"
            variant="default"
            clickable
            :active="selectedTreePos.includes(item.pos)"
            :aria-label="`Toggle ${item.pos} tokens`"
            @click="toggleTreePos(item.pos)"
          >
            {{ item.pos }}
            <span class="alph-resources__chip-count">· {{ item.count }}</span>
          </Chip>
        </div>
        <div v-if="treeText" class="alph-resources__tree-strip">
          {{ treeText }}
        </div>
        <div class="alph-resources__tree-canvas">
          <div class="alph-resources__tree-svg-wrap">
            <DependencyTree
              ref="treeSvgRef"
              class="alph-resources__tree-svg"
              :nodes="tree.nodes"
              :edges="tree.edges || []"
              :highlight-ids="activeTreeHighlightIds"
              :selected-pos="selectedTreePos"
              @select="selectTreeToken"
            />
          </div>
          <!-- Inspector as floating overlay at bottom -->
          <div v-if="selectedTreeTokens.length" class="alph-resources__tree-inspector">
            <div v-if="selectedTreeTokens.length === 1" class="alph-resources__tree-inspector-main">
              <strong class="lang-classical">{{ selectedTreeToken.form }}</strong>
              <span>{{ selectedTreeToken.pos || 'TOKEN' }}</span>
              <small v-if="selectedTreeToken.morph">{{ selectedTreeToken.morph }}</small>
            </div>
            <div v-else class="alph-resources__tree-inspector-main">
              <strong>{{ selectedTreeTokens.length }} tokens selected</strong>
              <small>{{ selectedTreeTokens.map(t => t.form).join(' · ') }}</small>
            </div>
            <div class="alph-resources__tree-inspector-links">
              <span v-if="selectedTreeTokens.length === 1" class="alph-resources__tree-port-legend">
                <i class="alph-resources__tree-port alph-resources__tree-port--head" />
                head
                <i class="alph-resources__tree-port alph-resources__tree-port--dependent" />
                dependent
              </span>
              <template v-for="item in selectedTreeRelations" :key="item.token.id">
                <span>
                  <b class="lang-classical">{{ item.token.form }}</b>
                  <span style="font-size: 9px; color: var(--on-surface-variant);">{{ item.token.pos }}</span>
                  <template v-if="item.head">
                    → Head:
                    <b class="lang-classical">{{ item.head.token?.form || '[0]' }}</b>
                    <em>{{ item.head.relation }}</em>
                  </template>
                  <template v-else>
                    <em style="color: var(--on-surface-variant);">Root</em>
                  </template>
                </span>
                <span v-if="item.dependents.length">
                  ← Dependents:
                  <b
                    v-for="dep in item.dependents"
                    :key="`${item.token.id}-${dep.token.id}`"
                    class="lang-classical"
                  >
                    {{ dep.token.form }} <em>{{ dep.relation }}</em>
                  </b>
                </span>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- Sentence loading -->
      <template v-else-if="tree.loading">
        <div class="alph-resources__tree-loading">
          <div class="alph-resources__tree-spinner" />
          <p>Loading sentence…</p>
        </div>
      </template>

      <!-- Sentence load failure -->
      <template v-else-if="tree.kind === 'error'">
        <div class="alph-resources__tree-empty">
          <h3>Failed to load sentence</h3>
          <p>{{ tree.footerMeta }}</p>
          <button class="alph-resources__tree-retry" @click="retrySentence">Retry</button>
        </div>
      </template>

      <!-- Live treebank iframe (when data is available) -->
      <template v-else-if="tree.treebankSrc">
        <div class="alph-resources__tree-toolbar">
          <span class="alph-resources__sentence-id" v-html="tree.ref" />
        </div>
        <iframe
          :src="tree.treebankSrc"
          class="alph-resources__tree-iframe"
          sandbox="allow-scripts allow-same-origin"
          title="Treebank diagram"
        />
      </template>

      <!-- Explicit no-metadata state (real lookup happened, but page has no treebank metadata) -->
      <template v-else-if="tree.kind === 'no-metadata'">
        <div class="alph-resources__tree-empty">
          <h3>No treebank metadata on this page</h3>
          <p>
            Treebank view becomes available only when the current page exposes Arethusa metadata.
            Open the supported reader as the current page, select a word in the text, then return here.
          </p>
          <a v-if="!tree.isOfficialTextsPage && tree.officialReaderUrl" :href="tree.officialReaderUrl" target="_blank" rel="noopener" class="alph-resources__reader-link">
            Open supported reader
          </a>
        </div>
      </template>

      <!-- Explicit idle state (no live data yet) -->
      <template v-else>
        <div class="alph-resources__tree-empty">
          <h3>No treebank loaded</h3>
          <p v-if="tree.isOfficialTextsPage">Select a word on this Alpheios Texts page to load a live treebank.</p>
          <p v-else>Pick a text above to browse its dependency trees, or select a word on a supported Alpheios Texts page.</p>
          <a v-if="!tree.isOfficialTextsPage && tree.officialReaderUrl" :href="tree.officialReaderUrl" target="_blank" rel="noopener" class="alph-resources__reader-link">
            Open supported reader
          </a>
        </div>
      </template>
      </div><!-- .alph-resources__tree-container -->
    </template>

  </div>
</template>

<style scoped>
.alph-resources { font-size: 12px; color: var(--on-surface); }
.alph-resources--tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── Usage ── */
.alph-resources__head {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 12px 12px 4px;
}
.alph-resources__head h2 {
  margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em;
}
.alph-resources__head-meta {
  font-size: 10px;
  color: var(--on-surface-variant);
  letter-spacing: 0.08em; text-transform: uppercase;
}
.alph-resources__chip-row {
  display: flex; gap: 4px; flex-wrap: wrap;
  padding: 8px 12px;
}
.alph-resources__chip-row--tight { padding-top: 0; }
.alph-resources__chip-count { opacity: 0.6; }

.alph-resources__author-group { padding: 0 12px 6px; }
.alph-resources__author-head {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 8px 4px;
}
.alph-resources__author-name { font-size: 14px; font-weight: 700; }
.alph-resources__author-meta {
  font-size: 10px; color: var(--on-surface-variant);
  letter-spacing: 0.05em; text-transform: uppercase;
}

.alph-resources__quote-card {
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-lg);
  padding: 10px 12px;
  margin-bottom: 4px;
}
.alph-resources__quote {
  margin: 0 0 6px;
  font-style: italic;
  font-size: 12px; line-height: 18px;
}
.alph-resources__quote :deep(mark) {
  background: rgba(0,0,0,0.04);
  border-bottom: 1px solid rgba(0,0,0,0.18);
  padding: 0 1px; color: inherit;
}
[data-theme="dark"] .alph-resources__quote :deep(mark) {
  background: rgba(255,255,255,0.06);
  border-bottom-color: rgba(255,255,255,0.18);
}
.alph-resources__quote-foot {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10px;
  color: var(--on-surface-variant);
  font-family: 'Lato', serif;
}
.alph-resources__quote-foot :deep(em) { font-style: italic; }
.alph-resources__open-link {
  color: var(--on-surface); text-decoration: none;
  border-bottom: 1px solid currentColor;
  font-family: 'Inter', sans-serif;
  font-size: 10px; font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase;
}
.alph-resources__show-more {
  display: block; width: 100%;
  text-align: center;
  font-family: inherit;
  font-size: 10px; font-weight: 500;
  color: var(--on-surface);
  letter-spacing: 0.08em; text-transform: uppercase;
  padding: 8px 6px;
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-lg);
  cursor: pointer;
}
.alph-resources__show-more:hover { border-color: var(--on-surface); }

.alph-resources__empty {
  margin: 12px;
  padding: 14px;
  border: 1px dashed var(--outline-variant);
  border-radius: var(--radius-lg);
  background: var(--surface-container-lowest);
}
.alph-resources__empty h3 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
}
.alph-resources__empty p {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--on-surface-variant);
}
.alph-resources__reader-link {
  display: inline-flex;
  align-items: center;
  margin-top: 12px;
  color: var(--on-surface);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  border-bottom: 1px solid currentColor;
}
.alph-resources__reader-actions {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

/* ── Grammar ── */
/* In grammar mode the page fills the drawer scroll area exactly via flex, so
 * the iframe scrolls internally and no spurious outer scrollbar appears. */
.alph-resources--fill {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.alph-resources--fill .alph-resources__browser-toolbar { flex-shrink: 0; }
.alph-resources--fill .alph-resources__grammar-browser {
  flex: 1;
  height: auto;
  min-height: 0;
}
.alph-resources__browser-toolbar {
  min-height: 44px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--divider);
  background: var(--surface-container);
}
.alph-resources__browser-controls {
  display: inline-flex;
  gap: 4px;
  flex-shrink: 0;
}
.alph-resources__book-select {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-md);
  background: var(--surface-container-lowest);
  color: var(--on-surface);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.alph-resources__book-select:hover { border-color: var(--on-surface); }
.alph-resources__browser-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.alph-resources__browser-title span {
  font-size: 13px;
  font-weight: 700;
  color: var(--on-surface);
}
.alph-resources__browser-title small {
  font-size: 10px;
  color: var(--on-surface-variant);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.alph-resources__tool-button,
.alph-resources__browser-open {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  border: 1px solid var(--outline-variant);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--on-surface);
  background: var(--surface-container-lowest);
  text-decoration: none;
  cursor: pointer;
  font-family: inherit;
}
.alph-resources__tool-button:hover,
.alph-resources__browser-open:hover { border-color: var(--on-surface); }
.alph-resources__tool-link {
  height: 30px;
  padding: 0 9px;
  border-radius: var(--radius-md);
  border: 1px solid var(--outline-variant);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--on-surface);
  background: var(--surface-container-lowest);
  text-decoration: none;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.alph-resources__tool-link:hover { border-color: var(--on-surface); }
.alph-resources__grammar-browser {
  padding: 0;
  height: calc(100vh - var(--topbar-height) - var(--footer-height) - 44px);
  min-height: 420px;
  background: var(--surface-container-lowest);
}
.alph-resources__grammar-iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 0;
  background: var(--surface-container-lowest);
}
.alph-resources__h-section {
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--on-surface-variant);
  padding: 10px 12px 6px;
}
.alph-resources__h-section--row {
  display: flex; align-items: center; justify-content: space-between;
}
.alph-resources__h-section--row :deep(.alph-btn--icon) { width: 24px; height: 24px; }

.alph-resources__source-list {
  padding: 8px 12px;
  display: flex; flex-direction: column;
  gap: 6px;
}
.alph-resources__source {
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-xl);
  padding: 10px 12px;
  display: flex; align-items: center; gap: 10px;
  cursor: pointer;
  transition: border-color var(--motion-fast), transform var(--motion-fast),
              box-shadow var(--motion-fast);
}
.alph-resources__source:hover {
  border-color: var(--on-surface);
  transform: translateY(-1px);
}
.alph-resources__source--active {
  border-color: var(--on-surface);
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.alph-resources__source-icon {
  width: 36px; height: 36px;
  border-radius: var(--radius-lg);
  background: var(--surface-container);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--on-surface-variant);
  flex-shrink: 0;
}
.alph-resources__source-body { flex: 1; min-width: 0; }
.alph-resources__source-title {
  font-size: 12px; font-weight: 600;
  margin: 0 0 2px; letter-spacing: -0.01em;
}
.alph-resources__source-meta {
  margin: 0;
  font-size: 11px;
  color: var(--on-surface-variant);
}

.alph-resources__toc-jump {
  margin: 0 12px 8px;
  padding: 10px 12px;
  border: 1px dashed var(--outline-variant);
  border-radius: var(--radius-lg);
  font-size: 10px;
  color: var(--on-surface-variant);
  display: flex; align-items: center; gap: 8px;
}
.alph-resources__toc-jump :deep(em) { font-style: italic; }

.alph-resources__reading { padding: 12px; }
.alph-resources__reading h3 {
  font-size: 14px; font-weight: 700;
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}
.alph-resources__reading p {
  font-family: 'Lato', serif;
  font-size: 13px; line-height: 21px;
  margin: 0 0 12px;
  color: var(--on-surface);
}
.alph-resources__reading p :deep(.alph-resources__em) {
  font-style: italic;
  color: var(--on-surface-variant);
}
.alph-resources__reading .alph-resources__em {
  font-style: italic;
  color: var(--on-surface-variant);
}
.alph-resources__anchor {
  display: inline-block;
  font-size: 10px; font-weight: 500;
  color: var(--on-surface-variant);
  letter-spacing: 0.08em; text-transform: uppercase;
  margin-bottom: 8px;
}
.alph-resources__reading p :deep(.alph-resources__crossref) {
  display: inline-block;
  border-bottom: 1px solid var(--outline-variant);
  color: var(--on-surface);
  text-decoration: none;
}
.alph-resources__reading blockquote {
  margin: 8px 0;
  padding: 8px 12px;
  background: rgba(0,0,0,0.04);
  border-left: 3px solid var(--outline-variant);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  font-family: 'Lato', serif;
  font-style: italic;
  font-size: 12px;
  color: var(--on-surface-variant);
}
[data-theme="dark"] .alph-resources__reading blockquote {
  background: rgba(255,255,255,0.04);
}

/* ── Tree ── */
.alph-resources__tree-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.alph-resources__tree-query {
  flex-shrink: 0;
  padding: 6px 8px;
  background: var(--surface-container-low);
  border-bottom: 1px solid var(--outline-variant);
}
.alph-resources__tree-query-compact {
  display: flex;
  align-items: center;
  gap: 4px;
}
.alph-resources__tree-query-lang {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  background: var(--surface-container);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-sm);
  color: var(--on-surface);
  min-width: 65px;
}
.alph-resources__tree-query-text {
  flex: 1;
  padding: 4px 8px;
  font-size: 11px;
  background: var(--surface-container);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-sm);
  color: var(--on-surface);
  min-width: 0;
}
.alph-resources__tree-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}
.alph-resources__tree-passage-select {
  padding: 4px 6px;
  font-size: 11px;
  font-family: inherit;
  background: var(--surface-container);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-sm);
  color: var(--on-surface);
  width: 96px;
}
.alph-resources__tree-error-text { color: var(--error); }
.alph-resources__tree-retry {
  margin-left: 8px;
  padding: 2px 10px;
  font-size: 10px;
  font-weight: 600;
  font-family: inherit;
  background: var(--surface-container-highest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-sm);
  color: var(--on-surface);
  cursor: pointer;
}
.alph-resources__tree-retry:hover { border-color: var(--on-surface); }
.alph-resources__tree-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--on-surface-variant);
  font-size: 12px;
}
.alph-resources__tree-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--outline-variant);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: alph-tree-spin 0.8s linear infinite;
}
@keyframes alph-tree-spin {
  to { transform: rotate(360deg); }
}
.alph-resources__tree-nav-btn {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  background: var(--surface-container-highest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-sm);
  color: var(--on-surface);
  cursor: pointer;
  transition: all 0.15s;
  min-width: 32px;
}
.alph-resources__tree-nav-btn:hover:not(:disabled) {
  background: var(--surface-container);
  border-color: var(--on-surface);
}
.alph-resources__tree-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.alph-resources__tree-query-info {
  margin-top: 4px;
  padding: 4px 8px;
  font-size: 10px;
  color: var(--on-surface-variant);
  background: var(--surface-container-highest);
  border-radius: var(--radius-sm);
}

.alph-resources__tree-toolbar {
  flex-shrink: 0;
  box-sizing: border-box;
  min-height: 37px;
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--divider);
}
.alph-resources__tree-filter-row {
  flex-shrink: 0;
  --alph-tree-pos-accent: #F4511E;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-bottom: 1px solid var(--divider);
  background: var(--surface-container-lowest);
}
.alph-resources__tree-filter-row :deep(.alph-resources__tree-pos-chip.alph-chip--active) {
  background: var(--alph-tree-pos-accent);
  border-color: var(--alph-tree-pos-accent);
  color: #fff;
}
.alph-resources__tree-filter-row :deep(.alph-resources__tree-pos-chip.alph-chip--clickable.alph-chip--active:hover) {
  background: var(--alph-tree-pos-accent);
  border-color: var(--alph-tree-pos-accent);
}
.alph-resources__pager {
  display: inline-flex; gap: 0;
  background: var(--recessed-bg);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.alph-resources__pager button {
  background: transparent; border: 0;
  padding: 4px 8px;
  color: var(--on-surface-variant); cursor: pointer;
}
.alph-resources__pager button:hover {
  background: rgba(0,0,0,0.08); color: var(--on-surface);
}
[data-theme="dark"] .alph-resources__pager button:hover {
  background: rgba(255,255,255,0.08);
}
.alph-resources__sentence-id {
  flex: 1;
  font-size: 10px; font-weight: 500;
  color: var(--on-surface-variant);
  letter-spacing: 0.08em; text-transform: uppercase;
}
.alph-resources__sentence-id :deep(strong) { color: var(--on-surface); }

.alph-resources__zoom {
  display: inline-flex;
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.alph-resources__zoom button {
  background: var(--surface-container-lowest);
  border: 0; width: 24px; height: 24px;
  color: var(--on-surface-variant);
  cursor: pointer;
}
.alph-resources__zoom button + button { border-left: 1px solid var(--outline-variant); }

.alph-resources__tree-canvas {
  --alph-tree-accent: #00695C;
  background:
    radial-gradient(circle at 50% 50%, rgba(255,255,255,0.6), transparent 60%),
    var(--surface-container-low);
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

/* 自定义滚动条样式 - 更优雅、更细、半透明 */
.alph-resources__tree-canvas::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.alph-resources__tree-canvas::-webkit-scrollbar-track {
  background: transparent;
}
.alph-resources__tree-canvas::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  transition: background 0.2s;
}
.alph-resources__tree-canvas::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
.alph-resources__tree-canvas::-webkit-scrollbar-corner {
  background: transparent;
}

/* Firefox 滚动条 */
.alph-resources__tree-canvas {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

[data-theme="dark"] .alph-resources__tree-canvas {
  background:
    radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04), transparent 60%),
    var(--surface-container-low);
}

/* Dark mode 滚动条 */
[data-theme="dark"] .alph-resources__tree-canvas::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}
[data-theme="dark"] .alph-resources__tree-canvas::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
[data-theme="dark"] .alph-resources__tree-canvas {
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}
.alph-resources__tree-svg-wrap {
  padding: 16px 12px;
  display: inline-block;
  min-width: 100%;
  min-height: 100%;
}
.alph-resources__tree-svg {
  font-family: 'Inter', sans-serif;
  display: block;
}

.alph-resources__tree-inspector {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-top: 1px solid var(--outline-variant);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
  z-index: 10;
  animation: slideUpFade 0.2s ease-out;
  pointer-events: none;
}
.alph-resources__tree-inspector > * {
  pointer-events: auto;
}

@keyframes slideUpFade {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

[data-theme="dark"] .alph-resources__tree-inspector {
  background: rgba(30, 30, 30, 0.95);
  border-top-color: var(--outline);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.4);
}
.alph-resources__tree-inspector-main {
  min-width: 112px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.alph-resources__tree-inspector-main strong {
  font-size: 15px;
  color: var(--alph-tree-accent);
}
.alph-resources__tree-inspector-main span {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--on-surface);
}
.alph-resources__tree-inspector-main small,
.alph-resources__tree-inspector-links {
  font-size: 10px;
  line-height: 15px;
  color: var(--on-surface-variant);
}
.alph-resources__tree-inspector-links {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.alph-resources__tree-inspector-links span {
  display: flex;
  gap: 5px;
  align-items: baseline;
  flex-wrap: wrap;
}
.alph-resources__tree-inspector-links b {
  color: var(--on-surface);
  font-weight: 700;
}
.alph-resources__tree-inspector-links em {
  color: var(--alph-tree-accent);
  font-style: normal;
  font-size: 9px;
  letter-spacing: 0.05em;
}
.alph-resources__tree-port-legend {
  color: var(--on-surface-variant);
  font-size: 9px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.alph-resources__tree-port {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  box-sizing: border-box;
  display: inline-block;
}
.alph-resources__tree-port--head {
  border: 1.4px solid var(--alph-tree-accent);
  background: var(--surface-container-lowest);
}
.alph-resources__tree-port--dependent {
  background: var(--alph-tree-accent);
}

.alph-resources__tree-empty {
  margin: 12px;
  padding: 16px;
  border: 1px dashed var(--outline-variant);
  border-radius: var(--radius-lg);
  background: var(--surface-container-lowest);
}
.alph-resources__tree-empty h3 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.alph-resources__tree-empty p {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--on-surface-variant);
}

.alph-resources__tree-iframe {
  width: 100%;
  height: 400px;
  border: 0;
  background: var(--surface-container-low);
}

.alph-resources__tree-strip {
  flex-shrink: 0;
  padding: 8px 12px;
  border-bottom: 1px solid var(--divider);
  background: rgba(255,255,255,0.3);
  font-family: 'Lato', serif;
  font-size: 12px; line-height: 18px;
  color: var(--on-surface-variant);
}
[data-theme="dark"] .alph-resources__tree-strip {
  background: rgba(255,255,255,0.04);
}
.alph-resources__tree-strip :deep(.alph-resources__hl) {
  color: var(--tertiary);
  font-weight: 700;
  background: var(--tertiary-container);
  padding: 0 2px;
  border-radius: 2px;
}
</style>
