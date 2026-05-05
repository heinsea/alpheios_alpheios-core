<script setup>
/**
 * WordListPage — DESIGN §7 + mockup drawer-wordlist.html.
 *
 * Two views:
 *   list    — words grouped by language with filter / bulk / import / export.
 *   context — drilling into a single word: stack of citation cards with
 *             a back arrow at the top.
 *
 * View state local. `selectedWord` doubles as "navigate-into-context"
 * trigger; clicking a row stores it then flips view.
 */

import { ref, computed } from 'vue'
import Button from '../primitives/Button.vue'
import Chip from '../primitives/Chip.vue'
import Icon from '../primitives/Icon.vue'

const props = defineProps({
  data: { type: Object, required: true }
})
const emit = defineEmits(['selectWord'])

const view = ref('list')               // 'list' | 'context'
const filter = ref('')
const bulkMode = ref(false)
const selected = ref(new Set())

const groups = computed(() => props.data.list.groups)
const expandedIds = ref(new Set(groups.value.filter(g => g.expanded).map(g => g.id)))
function toggleGroup (id) {
  const s = new Set(expandedIds.value)
  s.has(id) ? s.delete(id) : s.add(id)
  expandedIds.value = s
}

function visibleWords (g) {
  if (!filter.value) return g.words
  const q = filter.value.toLowerCase()
  return g.words.filter(w => w.form.toLowerCase().includes(q) || w.pos.toLowerCase().includes(q))
}

function openContext (word) {
  view.value = 'context'
  if (word.langCode && word.form) {
    emit('selectWord', { langCode: word.langCode, targetWord: word.form })
  }
}
function backToList () { view.value = 'list' }

function toggleSelected (form) {
  const s = new Set(selected.value)
  s.has(form) ? s.delete(form) : s.add(form)
  selected.value = s
}

const ctx = computed(() => props.data.context)

const footerMeta = computed(() => {
  if (view.value === 'context') return ctx.value.footerMeta
  return props.data.list.footerMeta
})
defineExpose({ footerMeta, view, backToList })
</script>

<template>
  <div class="alph-wl">

    <!-- ============ LIST VIEW ============ -->
    <template v-if="view === 'list'">
      <div class="alph-wl__toolbar">
        <div class="alph-wl__search">
          <Icon name="filter_list" :size="14" />
          <input v-model="filter" placeholder="Filter words…" />
        </div>
        <button class="alph-wl__icon-sq" :class="{ 'alph-wl__icon-sq--active': bulkMode }"
                title="Bulk select" @click="bulkMode = !bulkMode">
          <Icon name="checklist" :size="14" />
        </button>
        <button class="alph-wl__icon-sq" title="Import"><Icon name="file_upload" :size="14" /></button>
        <button class="alph-wl__icon-sq" title="Export"><Icon name="file_download" :size="14" /></button>
      </div>

      <template v-for="g in groups" :key="g.id">
        <header class="alph-wl__group-head">
          <button type="button" class="alph-wl__group-title" @click="toggleGroup(g.id)">
            <Icon :name="expandedIds.has(g.id) ? 'expand_more' : 'chevron_right'" :size="14" />
            <span>{{ g.name }}</span>
            <span class="alph-wl__group-count">· {{ g.count }}</span>
          </button>
          <button type="button" class="alph-wl__sort">
            Sort: {{ g.sort }}
            <Icon name="unfold_more" :size="12" />
          </button>
        </header>

        <div v-if="expandedIds.has(g.id) && visibleWords(g).length" class="alph-wl__list">
          <div v-for="w in visibleWords(g)" :key="w.form"
               class="alph-wl__row"
               :class="{ 'alph-wl__row--selected': w.selected }"
               @click="openContext(w)">
            <span v-if="bulkMode"
                  class="alph-wl__check"
                  :class="{ 'alph-wl__check--on': selected.has(w.form) }"
                  @click.stop="toggleSelected(w.form)">
              <Icon v-if="selected.has(w.form)" name="check" :size="10" />
            </span>
            <span class="alph-wl__form lang-classical">{{ w.form }}</span>
            <span class="alph-wl__pos">{{ w.pos }}</span>
            <span class="alph-wl__ctx">{{ w.ctx }} ctx</span>
          </div>
        </div>
        <p v-else-if="expandedIds.has(g.id)" class="alph-wl__empty">No words in this group yet.</p>
      </template>
    </template>

    <!-- ============ CONTEXT VIEW ============ -->
    <template v-else>
      <header class="alph-wl__ctx-head">
        <Button variant="icon" aria-label="Back to list" @click="backToList">
          <Icon name="arrow_back" :size="16" />
        </Button>
        <span class="alph-wl__ctx-word lang-classical">{{ ctx.word }}</span>
        <Chip variant="filled">{{ ctx.lang }}</Chip>
        <span class="alph-wl__ctx-count">{{ ctx.count }} contexts</span>
      </header>

      <article v-for="(item, i) in ctx.items" :key="i" class="alph-wl__ctx-card">
        <header class="alph-wl__ctx-card-head">
          <span>{{ item.label }}</span>
          <span class="alph-wl__ctx-when">{{ item.when }}</span>
        </header>
        <p class="alph-wl__ctx-quote lang-classical" v-html="item.quote" />
        <footer class="alph-wl__ctx-card-foot">
          <span v-html="item.source" />
          <a v-if="item.link" :href="item.link" class="alph-wl__ctx-link">Open source →</a>
        </footer>
      </article>

      <p v-if="!ctx.items.length" class="alph-wl__empty alph-wl__empty--context">
        No saved context is available for this word yet.
      </p>
    </template>
  </div>
</template>

<style scoped>
.alph-wl { font-size: 12px; color: var(--on-surface); }

/* toolbar */
.alph-wl__toolbar {
  display: flex; gap: 6px; align-items: center;
  padding: 12px;
}
.alph-wl__search {
  flex: 1;
  background: var(--recessed-bg);
  box-shadow: var(--recessed-shadow);
  border-radius: var(--radius-lg);
  height: 32px; padding: 0 10px;
  display: flex; align-items: center; gap: 6px;
  color: var(--on-surface-variant);
}
.alph-wl__search input {
  background: transparent; border: 0; outline: 0;
  flex: 1;
  font-family: 'Lato', serif;
  font-size: 12px;
  color: var(--on-surface);
}
.alph-wl__search input::placeholder { color: var(--on-surface-variant); opacity: 0.6; }

.alph-wl__icon-sq {
  width: 32px; height: 32px;
  border-radius: var(--radius-lg);
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--outline-variant);
  background: var(--surface-container-lowest);
  color: var(--on-surface-variant);
  cursor: pointer;
  transition: background-color var(--motion-fast), color var(--motion-fast);
}
.alph-wl__icon-sq:hover {
  background: var(--surface-container-low);
  color: var(--on-surface);
}
.alph-wl__icon-sq--active {
  background: var(--primary); color: var(--on-primary);
  border-color: var(--primary);
}

/* group head */
.alph-wl__group-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px 6px;
  margin-top: 4px;
}
.alph-wl__group-title {
  display: inline-flex; align-items: center; gap: 6px;
  border: 0; background: transparent;
  padding: 0;
  font-family: inherit;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--on-surface);
  cursor: pointer;
}
.alph-wl__group-count {
  color: var(--on-surface-variant);
  font-weight: 500;
  letter-spacing: 0.05em;
}
.alph-wl__sort {
  background: transparent; border: 0;
  color: var(--on-surface-variant);
  font-family: inherit;
  font-size: 10px; font-weight: 500;
  letter-spacing: 0.05em; text-transform: uppercase;
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px;
}

/* row */
.alph-wl__list {
  display: flex; flex-direction: column;
  padding: 0 12px;
}
.alph-wl__row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  margin-bottom: 2px;
  cursor: pointer;
  transition: background-color var(--motion-fast);
}
.alph-wl__row:hover { background: rgba(0,0,0,0.04); }
[data-theme="dark"] .alph-wl__row:hover { background: rgba(255,255,255,0.05); }
.alph-wl__row--selected { background: rgba(0,0,0,0.04); }
[data-theme="dark"] .alph-wl__row--selected { background: rgba(255,255,255,0.05); }

.alph-wl__check {
  width: 16px; height: 16px; flex-shrink: 0;
  border: 1.5px solid var(--outline-variant);
  border-radius: 3px;
  display: inline-flex; align-items: center; justify-content: center;
}
.alph-wl__check--on {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}

.alph-wl__form {
  font-size: 14px; flex-shrink: 0; min-width: 96px;
}
.alph-wl__pos {
  font-size: 10px; font-weight: 500;
  letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--on-surface-variant);
  flex: 1; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.alph-wl__ctx { font-size: 10px; color: var(--on-surface-variant); }

.alph-wl__empty {
  padding: 0 24px 12px;
  font-size: 11px;
  color: var(--on-surface-variant);
  font-style: italic;
}
.alph-wl__empty--context { padding-top: 12px; }

/* context view */
.alph-wl__ctx-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--divider);
}
.alph-wl__ctx-head :deep(.alph-btn--icon) { width: 28px; height: 28px; }
.alph-wl__ctx-word {
  font-size: 18px; font-weight: 600;
}
.alph-wl__ctx-count {
  margin-left: auto;
  font-size: 10px;
  color: var(--on-surface-variant);
  letter-spacing: 0.08em; text-transform: uppercase;
}

.alph-wl__ctx-card {
  margin: 12px;
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-xl);
  padding: 14px;
}
.alph-wl__ctx-card + .alph-wl__ctx-card { margin-top: 8px; }
.alph-wl__ctx-card-head {
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--on-surface-variant);
  margin-bottom: 8px;
  display: flex; justify-content: space-between;
}
.alph-wl__ctx-when {
  color: var(--on-surface-variant);
  font-weight: 500; letter-spacing: 0; text-transform: none;
}
.alph-wl__ctx-quote {
  font-style: italic;
  font-size: 13px; line-height: 20px;
  margin: 0 0 8px;
}
.alph-wl__ctx-quote :deep(mark) {
  background: rgba(0, 0, 0, 0.04);
  border-bottom: 1px solid rgba(0, 0, 0, 0.18);
  padding: 0 1px; color: inherit;
}
[data-theme="dark"] .alph-wl__ctx-quote :deep(mark) {
  background: rgba(255,255,255,0.06);
  border-bottom-color: rgba(255,255,255,0.18);
}
.alph-wl__ctx-card-foot {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 11px;
  color: var(--on-surface-variant);
  font-family: 'Lato', serif;
}
.alph-wl__ctx-card-foot :deep(em) { font-style: italic; }
.alph-wl__ctx-link {
  color: var(--on-surface); text-decoration: none;
  border-bottom: 1px solid currentColor;
  font-family: 'Inter', sans-serif;
  font-size: 10px; font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase;
}
</style>
