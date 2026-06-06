<script setup>
/**
 * Popup surface — DESIGN §3.1 + mockup popup-states.html.
 *
 * 360 × auto, max-h 480, anchored to a caret position. Renders 4 states
 * driven by `state` prop:
 *
 *   default    : word meta + numbered defs + verified chip + dual footer
 *   loading    : 2 px indeterminate progress + 3 skeleton rows + disabled CTAs
 *   no-result  : centred empty text + two outbound links + close button
 *   error      : error banner above cached body (still useful) + retry footer
 *
 * `data` provides the lookup payload for default + error (cached) states.
 * `emptyStates` provides copy for the no-result + loading + error scenes.
 * The arrow is a 12 × 12 rotated ::before — colour matches glass background.
 */

import { computed, ref, watch, onMounted } from 'vue'
import Button from '../primitives/Button.vue'
import Chip from '../primitives/Chip.vue'
import Icon from '../primitives/Icon.vue'
import { definitionSenseItems } from '../pages/lookup-definitions.js'

const props = defineProps({
  state: { type: String, default: 'default' },
  data: { type: Object, default: () => ({}) },
  emptyStates: { type: Object, default: () => ({}) },
  arrowDir: { type: String, default: 'up' }
})
const emit = defineEmits(['close', 'expand', 'add', 'retry', 'login', 'switchLanguage', 'lookupVariants'])

const targetWord = computed(() => {
  // Prefer live data (data.lemma has the actual queried word) over empty-state copy.
  if (props.state === 'loading') return props.data.lemma || props.emptyStates.loading?.lemma || ''
  if (props.state === 'no-result') return props.data.lemma || props.emptyStates.noResult?.lemma || ''
  if (props.state === 'error') return props.data.lemma || props.emptyStates.error?.lemma || ''
  return props.data.selectedText || props.data.lemma || ''
})
const targetLang = computed(() => {
  // Prefer live data.lang over empty-state copy.
  const liveLang = props.data.lang
  if (props.state === 'loading') return liveLang || props.emptyStates.loading?.lang
  if (props.state === 'no-result') return liveLang || props.emptyStates.noResult?.lang
  if (props.state === 'error') return liveLang || props.emptyStates.error?.lang
  return liveLang
})
const errorBanner = computed(() => props.emptyStates.error?.banner)
const noResultData = computed(() => {
  const raw = props.emptyStates.noResult || {}
  // Substitute placeholder copy with the actual queried word.
  if (targetWord.value && raw.desc) {
    const escaped = raw.lemma ? raw.lemma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''
    const re = escaped ? new RegExp(escaped, 'g') : null
    return {
      ...raw,
      desc: re ? raw.desc.replace(re, targetWord.value) : raw.desc
    }
  }
  return raw
})
const cachedPos = computed(() => props.emptyStates.error?.cachedPos || [])
const cachedDefs = computed(() => props.emptyStates.error?.cachedDefs || [])
const shortDefinitionItems = computed(() => {
  if (props.state === 'error') return definitionSenseItems(cachedDefs.value)
  const defs = props.data.shortDefinitions || props.data.definitions || []
  return definitionSenseItems(defs)
})
const fullDefinitionItems = computed(() => {
  if (props.state === 'error') return definitionSenseItems(cachedDefs.value)
  const defs = props.data.fullDefinitions || []
  return definitionSenseItems(defs)
})
const definitionMode = ref('short')

watch(
  () => `${props.state}|${targetWord.value}|${(props.data.shortDefinitions || []).length}|${(props.data.fullDefinitions || []).length}|${(props.data.definitions || []).length}`,
  () => { definitionMode.value = 'short' }
)

const visibleDefinitions = computed(() => (
  definitionMode.value === 'full' ? fullDefinitionItems.value : shortDefinitionItems.value
))
const hasShortDefinitions = computed(() => shortDefinitionItems.value.length > 0)
const hasFullDefinitions = computed(() => fullDefinitionItems.value.length > 0)
const emptyDefinitionText = computed(() => (
  definitionMode.value === 'full'
    ? 'No full definition available.'
    : 'No short definition available.'
))

const showFullBody = computed(() => props.state === 'default' || props.state === 'error')

/* ── Drag to move + edge resize ── */
const EDGE = 8 // px
const popupRef = ref(null)
const popupPos = ref(null)          // { left, top } — set on mount and after every drag/resize
const popupCustomWidth = ref(null)
const popupCustomHeight = ref(null)

const dragging = ref(false)
const dragState = {}

const resizing = ref(false)
const resizeEdge = ref('')
const resizeState = {}

function popupRect () { return popupRef.value.getBoundingClientRect() }
function headerBottom () {
  const h = popupRef.value.querySelector('.alph-popup__header')
  return h ? h.getBoundingClientRect().bottom : 0
}

function edgeAt (r, e) {
  // Exclude header area — edges there belong to drag, not resize
  if (e.clientY <= headerBottom() + 2) return ''
  const t = e.clientY - r.top <= EDGE
  const b = r.bottom - e.clientY <= EDGE
  const l = e.clientX - r.left <= EDGE
  const ri = r.right - e.clientX <= EDGE
  if (t && l) return 'nw'; if (t && ri) return 'ne'
  if (b && l) return 'sw'; if (b && ri) return 'se'
  if (t) return 'n'; if (b) return 's'
  if (l) return 'w'; if (ri) return 'e'
  return ''
}

/* Initialise position from computed CSS defaults; use the live rect so
   explicit left/top/right:auto inline style replaces the CSS right anchor. */
onMounted(() => {
  const r = popupRect()
  popupPos.value = { left: r.left, top: r.top }
})

function applyPos (left, top) {
  popupPos.value = { left, top }
}

/* ── Pointer events ── */
function onHeaderPointerDown (e) {
  if (e.target.closest('button')) return
  // If the pointer is on a resize edge, prefer resize over drag
  const r = popupRect()
  if (edgeAt(r, e)) return
  dragging.value = true
  dragState.sx = e.clientX; dragState.sy = e.clientY
  dragState.sl = r.left; dragState.st = r.top
  popupRef.value.setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onRootPointerDown (e) {
  if (dragging.value || resizing.value) return
  if (e.target.closest('button')) return
  const r = popupRect()
  const edge = edgeAt(r, e)
  if (!edge) return
  resizing.value = true
  resizeEdge.value = edge
  resizeState.sx = e.clientX; resizeState.sy = e.clientY
  resizeState.sl = r.left; resizeState.st = r.top
  resizeState.sw = r.width; resizeState.sh = r.height
  popupRef.value.setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onPointerMove (e) {
  if (dragging.value) {
    const l = dragState.sl + (e.clientX - dragState.sx)
    const t = Math.max(0, dragState.st + (e.clientY - dragState.sy))
    applyPos(l, t)
    return
  }
  if (resizing.value) {
    const dx = e.clientX - resizeState.sx
    const dy = e.clientY - resizeState.sy
    let w = resizeState.sw, h = resizeState.sh
    let l = resizeState.sl, t = resizeState.st
    const ed = resizeEdge.value
    if (ed.includes('e')) w = resizeState.sw + dx
    if (ed.includes('w')) { w = resizeState.sw - dx; l = resizeState.sl + dx }
    if (ed.includes('s')) h = resizeState.sh + dy
    if (ed.includes('n')) { h = resizeState.sh - dy; t = resizeState.st + dy }
    w = Math.max(280, Math.min(1200, w))
    h = Math.max(200, Math.min(800, h))
    popupCustomWidth.value = w
    popupCustomHeight.value = h
    applyPos(l, Math.max(0, t))
    return
  }
}

function onPointerUp () {
  dragging.value = false
  resizing.value = false
  resizeEdge.value = ''
}

const popupRootStyle = computed(() => {
  // The build pipeline force-adds `!important` to every v3 stylesheet rule,
  // including `.alph-popup { top: 96px; right: 32px; width: … }`. A plain
  // inline style cannot override a stylesheet `!important`, so the dragged
  // top/right and the resized width would be ignored (vertical drag froze,
  // resize width snapped back). An inline `!important` *does* win over a
  // stylesheet `!important`, so the dynamic position/size must be marked
  // important to take effect.
  const s = {}
  if (popupPos.value) {
    s.left = `${popupPos.value.left}px !important`
    s.top = `${popupPos.value.top}px !important`
    s.right = 'auto !important'
  }
  if (popupCustomWidth.value) s.width = `${popupCustomWidth.value}px !important`
  if (popupCustomHeight.value) s.height = `${popupCustomHeight.value}px !important`
  return s
})

</script>

<template>
  <div
    ref="popupRef"
    class="alph-popup alpheios-v3-scope"
    :class="`alph-popup--arrow-${arrowDir}`"
    :style="popupRootStyle"
    @pointerdown="onRootPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <header class="alph-popup__header" @pointerdown="onHeaderPointerDown">
      <span class="alph-brand alph-brand--popup">α</span>
      <span class="alph-popup__target lang-classical">{{ targetWord }}</span>
      <div class="alph-popup__actions">
        <Button variant="icon" aria-label="Expand to drawer" @click="emit('expand')">
          <Icon name="open_in_full" :size="16" />
        </Button>
        <Button variant="icon" aria-label="Close" @click="emit('close')">
          <Icon name="close" :size="16" />
        </Button>
      </div>
    </header>

    <div v-if="state === 'loading'" class="alph-popup__progress" />

    <div class="alph-popup__body">
      <div v-if="state === 'error' && errorBanner" class="alph-popup__error-banner">
        <Icon name="error" :size="16" class="alph-popup__error-icon" />
        <div>
          <strong>{{ errorBanner.title }}</strong>
          {{ errorBanner.desc }}
        </div>
      </div>

      <div v-if="state === 'no-result'" class="alph-popup__empty">
        <p class="alph-popup__empty-title">{{ noResultData.title }}</p>
        <p class="alph-popup__empty-desc" v-html="noResultData.desc" />
        <div class="alph-popup__empty-links">
          <a v-for="l in noResultData.links" :key="l.label" :href="l.href" class="alph-popup__empty-link">{{ l.label }}</a>
        </div>
      </div>

      <template v-if="showFullBody || state === 'loading'">
        <div class="alph-popup__meta">
          <div class="alph-popup__pos">
            <template v-if="state === 'loading'">
              <span class="alph-popup__pos-text alph-popup__pos-text--muted">analyzing…</span>
            </template>
            <template v-else>
              <span class="alph-popup__pos-text">
                <template v-for="(p, idx) in (state === 'error' ? cachedPos : data.pos || [])" :key="idx">
                  <strong v-if="p.kind === 'primary'">{{ p.label.toUpperCase() }}</strong>
                  <span v-else>{{ p.label.toUpperCase() }}</span>
                  <span v-if="idx < (state === 'error' ? cachedPos : data.pos || []).length - 1"> · </span>
                </template>
              </span>
              <span v-if="state === 'error'" class="alph-popup__pos-text alph-popup__pos-text--muted">cached</span>
            </template>
          </div>
          <Chip v-if="targetLang" variant="filled">{{ targetLang }}</Chip>
        </div>

        <div class="alph-popup__defs">
          <template v-if="state === 'loading'">
            <div v-for="(w, i) in [90, 70, 80]" :key="i" class="alph-popup__def">
              <span class="alph-popup__def-num">{{ i + 1 }}.</span>
              <span class="alph-popup__skeleton" :style="{ width: w + '%' }" />
            </div>
          </template>
          <template v-else>
            <div class="alph-popup__definition-toggle" role="group" aria-label="Definition detail">
              <button
                type="button"
                class="alph-popup__definition-toggle-btn"
                :class="{ 'alph-popup__definition-toggle-btn--active': definitionMode === 'short' }"
                :aria-pressed="definitionMode === 'short'"
                :disabled="!hasShortDefinitions"
                @click="definitionMode = 'short'"
              >
                Short
              </button>
              <button
                type="button"
                class="alph-popup__definition-toggle-btn"
                :class="{ 'alph-popup__definition-toggle-btn--active': definitionMode === 'full' }"
                :aria-pressed="definitionMode === 'full'"
                :disabled="!hasFullDefinitions"
                @click="definitionMode = 'full'"
              >
                Full
              </button>
            </div>
            <template v-for="(def, i) in visibleDefinitions" :key="i">
              <!-- Lexeme group header -->
              <div v-if="def.isHeader" class="alph-popup__def-group-head">
                <div v-if="def.headword || def.frequency" class="alph-popup__def-entry-head">
                  <span class="alph-popup__def-headword lang-classical">{{ def.headword }}</span><span
                    v-if="def.frequency" class="alph-popup__def-freq"> ({{ def.frequency }})</span>
                </div>
                <p v-if="def.morphology" class="alph-popup__def-morph">{{ def.morphology }}</p>
                <div v-if="def.form || (def.inflections && def.inflections.length)" class="alph-popup__def-inflect">
                  <span v-if="def.form" class="alph-popup__def-form lang-classical">{{ def.form }}</span>
                  <div v-for="(row, ri) in def.inflections" :key="ri" class="alph-popup__def-infl-row">
                    <span v-if="row.label" class="alph-popup__def-infl-cat">{{ row.label }}.</span>
                    <span v-for="(v, vi) in row.values" :key="vi" class="alph-popup__def-infl-val">{{ v }}.</span>
                  </div>
                </div>
              </div>
              <!-- Definition item -->
              <article v-else class="alph-popup__def">
                <span class="alph-popup__def-num">{{ def.label }}</span>
                <div class="alph-popup__def-body">
                  <div v-if="def.blocks" class="alph-popup__def-text alph-popup__def-rich">
                    <p
                      v-for="(block, blockIndex) in def.blocks"
                      :key="blockIndex"
                      class="alph-popup__dict-block"
                      :class="[
                        {
                          'alph-popup__dict-block--roman': block.kind === 'roman',
                          'alph-popup__dict-block--major': block.kind === 'major',
                          'alph-popup__dict-block--sub': block.kind === 'sub',
                          'alph-popup__dict-source': block.kind === 'source'
                        },
                        `alph-popup__dict-block--depth-${block.depth || 0}`
                      ]"
                    >
                      <span
                        v-if="block.heading"
                        :class="(block.kind === 'roman' || block.kind === 'major') ? 'alph-popup__dict-heading' : 'alph-popup__dict-subheading'"
                      >{{ block.heading }}</span>
                      <span v-if="block.html" v-html="block.html" />
                    </p>
                  </div>
                  <div v-else class="alph-popup__def-text" v-html="def.html" />
                </div>
              </article>
            </template>
            <p v-if="!visibleDefinitions.length" class="alph-popup__def-empty">
              {{ emptyDefinitionText }}
            </p>
          </template>
        </div>

        <div v-if="state === 'default' && data.recognized" class="alph-popup__verified">
          <Icon name="check_circle" :size="12" />
          recognized
        </div>
      </template>
    </div>

    <footer class="alph-popup__footer">
      <template v-if="state === 'default'">
        <Button variant="primary" block @click="emit('add')">
          <Icon name="add" :size="14" />
          Add to list
        </Button>
      </template>
      <template v-else-if="state === 'loading'">
        <Button variant="primary" block disabled>
          <Icon name="add" :size="14" />
          Add to list
        </Button>
      </template>
      <template v-else-if="state === 'no-result'">
        <Button variant="secondary" block @click="emit('close')">Close</Button>
      </template>
      <template v-else-if="state === 'error'">
        <Button variant="secondary" block @click="emit('retry')">
          <Icon name="refresh" :size="14" />
          Retry
        </Button>
        <Button variant="secondary" aria-label="Sign in" @click="emit('login')">
          <Icon name="login" :size="14" />
        </Button>
      </template>
    </footer>
  </div>
</template>

<style scoped>
.alph-popup {
  position: fixed;
  top: 96px; right: 32px; /* default — overridden by drag */
  width: var(--popup-width);
  max-height: 480px;
  border-radius: var(--radius-xl);
  background: var(--glass-surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.5),
    0 12px 40px 0 var(--glass-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}
[data-theme="dark"] .alph-popup {
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.06),
    0 12px 40px 0 var(--glass-shadow);
}

.alph-popup::before {
  content: '';
  position: absolute;
  width: 12px; height: 12px;
  background: var(--glass-surface);
  border-left: 1px solid var(--glass-border);
  border-top: 1px solid var(--glass-border);
}
.alph-popup--arrow-up::before { top: -6px; left: 64px; transform: rotate(45deg); }
.alph-popup--arrow-down::before { bottom: -6px; left: 64px; transform: rotate(225deg); }

.alph-popup__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  height: 36px;
  border-bottom: 1px solid var(--divider);
  background: rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
  user-select: none;
  touch-action: none;
}
[data-theme="dark"] .alph-popup__header { background: rgba(0, 0, 0, 0.15); }

.alph-brand--popup {
  width: 22px; height: 22px; border-radius: var(--radius-md);
  background: var(--primary); color: var(--on-primary);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
  /* lowercase α optical centring */
  padding-bottom: 2px;
  flex-shrink: 0;
}
.alph-popup__target {
  flex: 1; min-width: 0;
  font-size: 13px; font-weight: 600; letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--on-surface);
}
.alph-popup__actions { display: flex; gap: 2px; }
/* shrink the Button:icon variant to 24×24 inside the popup header */
.alph-popup__actions :deep(.alph-btn--icon) { width: 24px; height: 24px; }

.alph-popup__progress {
  position: relative;
  overflow: hidden;
  height: 2px;
  background: rgba(0, 0, 0, 0.06);
}
.alph-popup__progress::after {
  content: '';
  position: absolute;
  top: 0; left: 0; height: 100%; width: 25%;
  background: var(--primary);
  animation: alph-popup-progress 1.6s infinite ease-in-out;
}
@keyframes alph-popup-progress {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

.alph-popup__body {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.alph-popup__meta {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}
.alph-popup__pos { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.alph-popup__pos-text {
  font-size: 10px; font-weight: 500; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--on-surface-variant);
}
.alph-popup__pos-text strong { color: var(--on-surface); font-weight: 600; }
.alph-popup__pos-text--muted { opacity: 0.6; }

.alph-popup__defs { display: flex; flex-direction: column; margin-bottom: 12px; }
.alph-popup__definition-toggle {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface-container-lowest);
  margin-bottom: 4px;
}
.alph-popup__definition-toggle-btn {
  height: 24px;
  min-width: 48px;
  padding: 0 8px;
  border: 0;
  border-left: 1px solid var(--outline-variant);
  background: transparent;
  color: var(--on-surface-variant);
  cursor: pointer;
  font: inherit;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.alph-popup__definition-toggle-btn:first-child { border-left: 0; }
.alph-popup__definition-toggle-btn--active {
  background: var(--primary);
  color: var(--on-primary);
}
.alph-popup__definition-toggle-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
.alph-popup__def-group-head {
  padding: 8px 4px 4px;
  border-top: 1px solid var(--divider);
  margin-top: 8px;
}
.alph-popup__def-group-head:first-child {
  border-top: 0;
  margin-top: 0;
  padding-top: 0;
}
.alph-popup__def {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 4px;
  padding: 4px 0;
}
.alph-popup__def + .alph-popup__def {
  margin-top: 2px;
  border-top: 1px solid var(--divider);
  padding-top: 6px;
}
.alph-popup__def-body { min-width: 0; }
/* entry header: headword : (freq) */
.alph-popup__def-entry-head {
  margin-bottom: 3px;
  font-size: 11px;
  line-height: 16px;
  color: var(--on-surface);
}
.alph-popup__def-headword { font-weight: 600; }
.alph-popup__def-entry-sep,
.alph-popup__def-freq { color: var(--on-surface-variant); }
.alph-popup__def-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-md);
  background: var(--surface-container);
  color: var(--on-surface);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.alph-popup__def-text {
  font-size: 12px; line-height: 18px;
  color: var(--on-surface);
}
.alph-popup__def-morph {
  margin: 2px 0 4px;
  color: var(--on-surface-variant);
  font-size: 11px;
  line-height: 16px;
}
/* lemma prefix + bold short def */
.alph-popup__def-lemma-pfx {
  color: var(--on-surface-variant);
  font-size: 12px;
}
.alph-popup__def-bold {
  font-weight: 700;
  color: var(--on-surface);
}
/* inflection block below definition */
.alph-popup__def-inflect {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.alph-popup__def-form {
  font-size: 11px;
  color: var(--on-surface);
  letter-spacing: 0.02em;
}
.alph-popup__def-infl-row {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: var(--on-surface-variant);
}
.alph-popup__def-infl-cat { font-style: italic; }
.alph-popup__def-text :deep(em) { font-style: italic; color: var(--on-surface-variant); }
.alph-popup__def-text :deep(br) { content: ""; display: block; margin-top: 6px; }
.alph-popup__def-text :deep(p) { margin: 0 0 6px; }
.alph-popup__def-text :deep(p:last-child) { margin-bottom: 0; }
.alph-popup__def-text :deep(ol),
.alph-popup__def-text :deep(ul) {
  margin: 6px 0 0;
  padding-left: 18px;
}
.alph-popup__def-text :deep(li + li) { margin-top: 3px; }
.alph-popup__def-rich {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 2px;
}
.alph-popup__dict-block {
  margin: 0;
  padding: 0;
}
/* Roman numeral blocks — top-level major sections (I, II, III) */
.alph-popup__dict-block--roman {
  margin-top: 6px;
  padding: 4px 0;
  font-weight: 700;
}
/* Capital-letter sub-sections (A, B, C) */
.alph-popup__dict-block--major {
  margin-top: 4px;
  padding: 2px 0;
}
.alph-popup__dict-block--sub {
  padding: 2px 0;
}
/* Per-depth left indentation */
.alph-popup__dict-block--depth-0 { margin-left: 0; }
.alph-popup__dict-block--depth-1 { margin-left: 12px; }
.alph-popup__dict-block--depth-2 { margin-left: 24px; }
.alph-popup__dict-block--depth-3 { margin-left: 36px; }
.alph-popup__dict-block--depth-4 { margin-left: 48px; }
.alph-popup__dict-heading {
  display: block;
  margin-bottom: 5px;
  color: var(--on-surface);
  font-weight: 700;
}
.alph-popup__dict-subheading {
  display: inline-block;
  margin-right: 4px;
  color: var(--on-surface);
  font-weight: 700;
}
.alph-popup__def-text :deep(.alph-popup__dict-quote) {
  color: var(--on-surface-variant);
  font-weight: 600;
  font-style: italic;
}
.alph-popup__dict-source {
  margin: 4px 0 0;
  padding: 9px 10px;
  border-left: 0;
  border-radius: var(--radius-md);
  background: var(--surface-container);
  color: var(--on-surface-variant);
  font-size: 10px;
  line-height: 15px;
  font-weight: 600;
}
.alph-popup__def-empty {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-lg);
  background: var(--surface-container-lowest);
  color: var(--on-surface-variant);
  font-size: 12px;
  line-height: 16px;
}
.alph-popup__skeleton {
  display: inline-block;
  height: 12px;
  border-radius: var(--radius);
  background: linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.10) 50%, rgba(0,0,0,0.04) 100%);
  background-size: 200% 100%;
  animation: alph-popup-shimmer 1.6s infinite;
}
@keyframes alph-popup-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

.alph-popup__verified {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--tertiary);
  font-size: 10px; font-weight: 500; letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-top: 4px;
}

.alph-popup__empty { text-align: center; padding: 12px 8px 0; }
.alph-popup__empty-title {
  font-size: 13px; font-weight: 600; letter-spacing: -0.01em;
  color: var(--on-surface);
  margin: 0 0 4px;
}
.alph-popup__empty-desc {
  font-size: 12px; line-height: 16px;
  color: var(--on-surface-variant);
  margin: 0 0 12px;
}
.alph-popup__empty-links {
  display: flex; justify-content: center; gap: 12px; margin-top: 8px;
}
.alph-popup__empty-link {
  font-size: 11px; font-weight: 500;
  color: var(--primary);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
}

.alph-popup__error-banner {
  display: flex; align-items: flex-start; gap: 8px;
  background: var(--error-container);
  color: var(--on-error-container);
  border-radius: var(--radius-lg);
  padding: 8px 10px;
  font-size: 11px; line-height: 14px;
  margin-bottom: 12px;
}
.alph-popup__error-icon { color: var(--error); margin-top: 1px; flex-shrink: 0; }
.alph-popup__error-banner strong { display: block; font-weight: 600; margin-bottom: 2px; }

.alph-popup__footer {
  display: flex; gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--divider);
  background: rgba(255, 255, 255, 0.20);
  flex-shrink: 0;
}
[data-theme="dark"] .alph-popup__footer { background: rgba(0, 0, 0, 0.12); }
.alph-popup__footer :deep(.alph-btn--secondary):not(.alph-btn--block) {
  height: 38px;
  padding: 0 12px;
}
</style>
