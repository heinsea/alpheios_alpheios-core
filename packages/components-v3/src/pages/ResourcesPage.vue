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
import { uiStore } from '../store/ui-store.js'

const props = defineProps({
  mode: { type: String, required: true }, // 'usage' | 'grammar' | 'tree'
  data: { type: Object, required: true }
})

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
const tree = computed(() => props.data.tree || { nodes: [], footerMeta: '', officialReaderUrl: '', isOfficialTextsPage: false })

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
const emit = defineEmits(['footer-meta'])
watch(footerMeta, (v) => emit('footer-meta', v), { immediate: true })
</script>

<template>
  <div class="alph-resources">

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
      <!-- Live treebank iframe (when data is available) -->
      <template v-if="tree.treebankSrc">
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
          <p v-else>Treebank is page-metadata driven. Use a supported Alpheios Texts page as the current page to load a live diagram.</p>
          <a v-if="!tree.isOfficialTextsPage && tree.officialReaderUrl" :href="tree.officialReaderUrl" target="_blank" rel="noopener" class="alph-resources__reader-link">
            Open supported reader
          </a>
        </div>
      </template>
    </template>

  </div>
</template>

<style scoped>
.alph-resources { font-size: 12px; color: var(--on-surface); }

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
.alph-resources__tree-toolbar {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--divider);
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
  background:
    radial-gradient(circle at 50% 50%, rgba(255,255,255,0.6), transparent 60%),
    var(--surface-container-low);
  position: relative;
  overflow: auto;
  min-height: 260px;
}
[data-theme="dark"] .alph-resources__tree-canvas {
  background:
    radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04), transparent 60%),
    var(--surface-container-low);
}
.alph-resources__tree-svg-wrap {
  padding: 16px 12px;
  display: flex; align-items: center; justify-content: center;
  transform-origin: top left;
  transition: transform var(--motion-fast);
}
.alph-resources__tree-svg { font-family: 'Inter', sans-serif; }

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
  padding: 8px 12px;
  border-top: 1px solid var(--divider);
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
