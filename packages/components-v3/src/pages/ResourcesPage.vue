<script setup>
/**
 * ResourcesPage — DESIGN §7 + mockup drawer-resources.html.
 *
 * One component, three modes (driven by `mode` prop, which the App.vue
 * router fills from `uiStore.state.page`):
 *   usage    — quotes grouped by author, chip filters
 *   grammar  — list of grammar sources → reading view
 *   tree     — dependency tree viewer (SVG nodes from fixture)
 *
 * Rationale: the three modes share the same panel chrome (topbar +
 * scroll + footer) and similar DOM density, so collapsing them keeps
 * the routing layer flat at a small CSS cost.
 */

import { ref, computed } from 'vue'
import Button from '../primitives/Button.vue'
import Chip from '../primitives/Chip.vue'
import Icon from '../primitives/Icon.vue'

const props = defineProps({
  mode: { type: String, required: true }, // 'usage' | 'grammar' | 'tree'
  data: { type: Object, required: true }
})

/* ─── Usage mode local state ─── */
const usage = computed(() => props.data.usage || { authorChips: [], groups: [], word: '', totalQuotes: 0, footerMeta: '' })
const authorFilter = ref(usage.value?.filterAuthor ?? 'all')
const sortLabel = ref('by date')
const genreLabel = ref('any')

/* ─── Grammar mode local state ─── */
const grammar = computed(() => props.data.grammar || { sources: [], reading: { blocks: [] }, language: '', sourceCount: 0, linkedFrom: '', footerMeta: '' })
const activeSourceId = ref(grammar.value?.sources.find(s => s.active)?.id ?? grammar.value?.sources[0]?.id ?? '')

/* ─── Tree mode local state ─── */
const tree = computed(() => props.data.tree || { nodes: [], footerMeta: '' })
const zoom = ref(1)
function zoomIn  () { zoom.value = Math.min(2,   zoom.value + 0.1) }
function zoomOut () { zoom.value = Math.max(0.5, zoom.value - 0.1) }
function zoomFit () { zoom.value = 1 }

/* ─── Edges derived from `parent` ─── */
const treeEdges = computed(() => {
  if (!tree.value) return []
  const byId = Object.fromEntries(tree.value.nodes.map(n => [n.id, n]))
  return tree.value.nodes.filter(n => n.parent).map(n => ({
    from: byId[n.parent], to: n, label: n.edgeLabel
  }))
})

const footerMeta = computed(() => {
  if (props.mode === 'usage')   return usage.value?.footerMeta
  if (props.mode === 'tree')    return tree.value?.footerMeta
  if (props.mode === 'grammar') return grammar.value?.footerMeta
  return ''
})
defineExpose({ footerMeta })
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
    </template>

    <!-- ============ GRAMMAR ============ -->
    <template v-else-if="mode === 'grammar'">
      <header class="alph-resources__h-section alph-resources__h-section--row">
        <span>{{ grammar.language }} grammars · {{ grammar.sourceCount }} sources</span>
        <Button variant="icon" aria-label="Tune"><Icon name="tune" :size="14" /></Button>
      </header>

      <div class="alph-resources__source-list">
        <article v-for="s in grammar.sources" :key="s.id"
                 class="alph-resources__source"
                 :class="{ 'alph-resources__source--active': activeSourceId === s.id }"
                 @click="activeSourceId = s.id">
          <span class="alph-resources__source-icon"><Icon name="menu_book" :size="16" /></span>
          <div class="alph-resources__source-body">
            <p class="alph-resources__source-title" v-html="s.title" />
            <p class="alph-resources__source-meta" v-html="s.meta" />
          </div>
          <Icon name="chevron_right" :size="14" />
        </article>
      </div>

      <div class="alph-resources__toc-jump">
        <Icon name="link" :size="12" />
        <span v-html="grammar.linkedFrom" />
      </div>

      <div class="alph-resources__reading">
        <span class="alph-resources__anchor" v-html="grammar.reading?.anchor" />
        <h3>{{ grammar.reading?.title }}</h3>
        <template v-for="(b, i) in (grammar.reading?.blocks || [])" :key="i">
          <p   v-if="b.type === 'p'"          v-html="b.html" />
          <blockquote v-else-if="b.type === 'blockquote'" v-html="b.html" />
        </template>
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

      <!-- Fixture SVG tree (no live data) -->
      <template v-else>
        <div class="alph-resources__tree-toolbar">
          <div class="alph-resources__pager">
            <button title="First sentence"><Icon name="first_page" :size="14" /></button>
            <button title="Previous"><Icon name="chevron_left" :size="14" /></button>
          </div>
          <span class="alph-resources__sentence-id" v-html="tree.ref" />
          <div class="alph-resources__pager">
            <button title="Next"><Icon name="chevron_right" :size="14" /></button>
            <button title="Last sentence"><Icon name="last_page" :size="14" /></button>
          </div>
          <div class="alph-resources__zoom">
            <button title="Zoom in" @click="zoomIn"><Icon name="add" :size="12" /></button>
            <button title="Zoom out" @click="zoomOut"><Icon name="open_in_full" :size="12" /></button>
            <button title="Fit" @click="zoomFit"><Icon name="fit_screen" :size="12" /></button>
          </div>
        </div>

        <div class="alph-resources__tree-canvas">
          <div class="alph-resources__tree-svg-wrap" :style="{ transform: `scale(${zoom})` }">
            <svg width="540" height="280" viewBox="0 0 540 280" xmlns="http://www.w3.org/2000/svg" class="alph-resources__tree-svg">
              <!-- edges -->
              <g stroke="var(--outline-variant)" stroke-width="1.2" fill="none">
                <path v-for="(e, i) in treeEdges" :key="i"
                      :d="`M ${e.from.x} ${e.from.y + 22} L ${e.to.x} ${e.to.y - 22}`" />
              </g>
              <!-- edge labels -->
              <g font-size="9" fill="var(--on-surface-variant)" font-weight="500" text-anchor="middle">
                <text v-for="(e, i) in treeEdges" :key="i"
                      :x="(e.from.x + e.to.x) / 2"
                      :y="(e.from.y + e.to.y) / 2 + 4">{{ e.label }}</text>
              </g>
              <!-- nodes -->
              <g v-for="n in tree.nodes" :key="n.id">
                <rect :x="n.x - 48" :y="n.y - 22" width="96" height="44" rx="8"
                      :fill="n.isRoot ? 'var(--tertiary)' : 'var(--surface-container-lowest)'"
                      :stroke="n.isRoot ? 'var(--tertiary)' : (n.isMatch ? 'var(--on-surface)' : 'var(--outline-variant)')"
                      :stroke-width="n.isMatch && !n.isRoot ? 1.5 : 1" />
                <text :x="n.x" :y="n.y - 2" text-anchor="middle"
                      font-family="Lato, serif" font-size="14" font-weight="700"
                      :fill="n.isRoot ? 'var(--on-tertiary)' : 'var(--on-surface)'">{{ n.form }}</text>
                <text :x="n.x" :y="n.y + 12" text-anchor="middle"
                      font-size="9" letter-spacing="0.5"
                      :fill="n.isRoot ? 'rgba(255,255,255,0.85)' : 'var(--on-surface-variant)'">{{ n.tag }}</text>
              </g>
            </svg>
          </div>
        </div>

        <div class="alph-resources__tree-strip" v-html="tree.textStrip" />
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

/* ── Grammar ── */
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
