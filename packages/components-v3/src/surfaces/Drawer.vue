<script setup>
/**
 * Drawer — DESIGN §3.2 + mockup drawer-lookup.html.
 *
 * Composes: 64 px sidebar (brand + 7 main tabs + 2 bottom tabs) + 380 px panel
 * (44 px topbar + search + scroll-area + 56 px footer). Mounted fixed to the
 * right edge by default.
 *
 * Stability invariants (user-facing fixes):
 *   - The drawer has an explicit total width (sidebar + panel = 444 px). It
 *     never re-sizes when the active page changes.
 *   - sidebar / panel both `flex-shrink: 0`.
 *   - Scrollable regions reserve their gutter (`scrollbar-gutter: stable`)
 *     so content doesn't jump when a scrollbar appears or disappears.
 *
 * Visual style: faithful to the mockup. Tabs are full-bleed 64×64 with a
 * 6% black background fill + 1.5 px left stripe when active. The brand cell
 * sits above with a 1 px divider, exactly as drawn in drawer-lookup.html.
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Button from '../primitives/Button.vue'
import Icon from '../primitives/Icon.vue'
import { uiStore } from '../store/ui-store.js'

defineProps({
  /** Optional override for the topbar lang label. */
  lang: { type: String, default: '' }
})
const emit = defineEmits(['close', 'collapse', 'more', 'lookup'])

const tabs = [
  { id: 'lookup',      icon: 'search',         label: 'Lookup' },
  { id: 'morph',       icon: 'menu_book',      label: 'Morph' },
  { id: 'inflections', icon: 'table_view',     label: 'Infl' },
  { id: 'usage',       icon: 'format_quote',   label: 'Usage' },
  { id: 'tree',        icon: 'account_tree',   label: 'Tree' },
  { id: 'grammar',     icon: 'history_edu',    label: 'Gram' },
  { id: 'wordlist',    icon: 'bookmark',       label: 'List' }
]
const bottomTabs = [
  { id: 'user', icon: 'account_circle', label: 'User' },
  { id: 'opts', icon: 'settings',       label: 'Opts' }
]

const currentPage = computed(() => uiStore.state.page)
const drawerWidth = ref(444)
const drawerStyle = computed(() => ({ width: `${drawerWidth.value}px` }))
const panelStyle = computed(() => ({ width: `${Math.max(296, drawerWidth.value - 64)}px` }))
let resizeStartX = 0
let resizeStartWidth = 0
let resizePointerId = null

function clampDrawerWidth (width) {
  const viewportMax = typeof window !== 'undefined'
    ? Math.max(360, Math.floor(window.innerWidth * 0.9))
    : 900
  return Math.min(Math.max(width, 360), Math.min(viewportMax, 900))
}

function onResizeMove (event) {
  if (resizePointerId !== null && event.pointerId !== resizePointerId) return
  drawerWidth.value = clampDrawerWidth(resizeStartWidth + (resizeStartX - event.clientX))
}

function stopResize () {
  resizePointerId = null
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', stopResize)
  document.body.style.cursor = ''
  document.documentElement.style.userSelect = ''
  try { window.localStorage.setItem('alpheios-v3-drawer-width', String(drawerWidth.value)) } catch { /* ignore */ }
}

function startResize (event) {
  resizePointerId = event.pointerId
  resizeStartX = event.clientX
  resizeStartWidth = drawerWidth.value
  try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* ignore */ }
  document.body.style.cursor = 'col-resize'
  document.documentElement.style.userSelect = 'none'
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', stopResize)
  event.preventDefault()
}

function selectTab (id) {
  if (!uiStore.isPageAvailable(id)) return
  uiStore.setPage(id)
}
function isDisabled (id) { return !uiStore.isPageAvailable(id) }

onMounted(() => {
  try {
    const savedWidth = Number(window.localStorage.getItem('alpheios-v3-drawer-width'))
    if (savedWidth) drawerWidth.value = clampDrawerWidth(savedWidth)
  } catch { /* ignore */ }
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', stopResize)
})
</script>

<template>
  <aside class="alph-drawer alpheios-v3-scope" :style="drawerStyle" aria-label="Alpheios reading panel">
    <div
      class="alph-drawer__resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize Alpheios panel"
      @pointerdown="startResize"
    />

    <nav class="alph-drawer__sidebar" aria-label="Drawer tabs">

      <div class="alph-drawer__brand-cell">
        <span class="alph-brand alph-brand--sidebar">α</span>
      </div>

      <div class="alph-drawer__tabs">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="alph-drawer__tab"
          :class="{
            'alph-drawer__tab--active': currentPage === t.id,
            'alph-drawer__tab--disabled': isDisabled(t.id)
          }"
          :aria-current="currentPage === t.id ? 'page' : undefined"
          :aria-disabled="isDisabled(t.id) ? 'true' : undefined"
          :disabled="isDisabled(t.id)"
          @click="selectTab(t.id)"
        >
          <Icon :name="t.icon" :size="20" />
          <span class="alph-drawer__tab-label">{{ t.label }}</span>
        </button>
      </div>

      <div class="alph-drawer__bottom">
        <button
          v-for="t in bottomTabs"
          :key="t.id"
          type="button"
          class="alph-drawer__tab"
          :class="{ 'alph-drawer__tab--active': currentPage === t.id }"
          @click="selectTab(t.id)"
        >
          <Icon :name="t.icon" :size="20" />
          <span class="alph-drawer__tab-label">{{ t.label }}</span>
        </button>
      </div>
    </nav>

    <section class="alph-drawer__panel" :style="panelStyle" :aria-label="`Alpheios — ${currentPage}`">

      <header class="alph-drawer__topbar">
        <div class="alph-drawer__topbar-title">
          <span>Alpheios</span>
          <span v-if="lang || $slots.lang" class="alph-drawer__topbar-lang">
            · <slot name="lang">{{ lang }}</slot>
          </span>
        </div>
        <div class="alph-drawer__topbar-actions">
          <Button variant="icon" aria-label="Collapse to toolbar" @click="emit('collapse')">
            <Icon name="close_fullscreen" :size="16" />
          </Button>
          <Button variant="icon" aria-label="More" @click="emit('more')">
            <Icon name="more_vert" :size="16" />
          </Button>
          <Button variant="icon" aria-label="Close" @click="emit('close')">
            <Icon name="close" :size="16" />
          </Button>
        </div>
      </header>

      <div v-if="$slots.search" class="alph-drawer__search">
        <slot name="search" />
      </div>

      <div class="alph-drawer__scroll">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="alph-drawer__footer">
        <slot name="footer" />
      </footer>
    </section>
  </aside>
</template>

<style scoped>
.alph-drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  z-index: 50;
  display: flex;
  /* EXPLICIT total width with hard-coded fallback. Tokens (--drawer-sidebar,
   * --drawer-content) might fail to resolve on hosts that strip CSS
   * variables — in that case calc() falls back to the literal 444 px. */
  width: 444px;
  height: 100vh;
  pointer-events: auto;
}

.alph-drawer__resize {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 12px;
  cursor: col-resize;
  z-index: 5;
  touch-action: none;
}
.alph-drawer__resize::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background: rgba(0, 0, 0, 0.10);
  transition: background-color var(--motion-fast), box-shadow var(--motion-fast);
}
.alph-drawer__resize:hover::before {
  background: var(--on-surface);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.06);
}
[data-theme="dark"] .alph-drawer__resize:hover::before {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.08);
}
[data-theme="dark"] .alph-drawer__resize::before {
  background: rgba(255, 255, 255, 0.12);
}

/* ── sidebar ── */
.alph-drawer__sidebar {
  order: 2;
  width: 64px;
  width: var(--drawer-sidebar);
  flex-shrink: 0;
  background: var(--glass-surface-low);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-left: 1px solid var(--glass-border);
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.4);
  display: flex; flex-direction: column;
}
[data-theme="dark"] .alph-drawer__sidebar {
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
}

/* Brand cell — mockup faithful. 44 px high, 1 px divider underneath. */
.alph-drawer__brand-cell {
  height: var(--topbar-height);
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-bottom: 1px solid var(--divider);
}
.alph-brand--sidebar {
  width: 28px; height: 28px; border-radius: var(--radius-md);
  background: var(--primary); color: var(--on-primary);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px;
  padding-bottom: 3px;
  box-sizing: border-box;
}

.alph-drawer__tabs {
  flex: 1;
  overflow-y: auto;
  scrollbar-gutter: stable;
  display: flex; flex-direction: column;
}
.alph-drawer__bottom {
  border-top: 1px solid var(--divider);
  display: flex; flex-direction: column;
  flex-shrink: 0;
}

/* tab — full-bleed 64×64 (mockup faithful) */
.alph-drawer__tab {
  position: relative;
  height: 64px;
  flex-shrink: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 4px;
  background: transparent;
  border: 0;
  border-right: 1.5px solid transparent;
  cursor: pointer;
  font-family: inherit;
  color: var(--on-surface-variant);
  transition: background-color var(--motion-fast), color var(--motion-fast);
}
.alph-drawer__tab:hover:not(.alph-drawer__tab--disabled) {
  background: rgba(0, 0, 0, 0.04);
  color: var(--on-surface);
}
[data-theme="dark"] .alph-drawer__tab:hover:not(.alph-drawer__tab--disabled) {
  background: rgba(255, 255, 255, 0.06);
}
.alph-drawer__tab--active {
  background: rgba(0, 0, 0, 0.06);
  border-right-color: var(--on-surface);
  color: var(--on-surface);
}
[data-theme="dark"] .alph-drawer__tab--active {
  background: rgba(255, 255, 255, 0.08);
}
.alph-drawer__tab--disabled { opacity: 0.32; cursor: not-allowed; }

.alph-drawer__tab-label {
  font-size: 9px; font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase;
}
.alph-drawer__tab:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

/* ── panel ── */
.alph-drawer__panel {
  order: 1;
  flex: 0 0 auto;
  min-width: 296px;
  height: 100vh;
  background: var(--glass-surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-left: 1px solid var(--glass-border);
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.4),
    -8px 0 32px 0 var(--glass-shadow);
  display: flex; flex-direction: column;
  overflow: hidden;
}
[data-theme="dark"] .alph-drawer__panel {
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.06),
    -8px 0 32px 0 var(--glass-shadow);
}

.alph-drawer__topbar {
  height: var(--topbar-height);
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--divider);
  background: rgba(255, 255, 255, 0.25);
}
[data-theme="dark"] .alph-drawer__topbar { background: rgba(0, 0, 0, 0.15); }

.alph-drawer__topbar-title {
  display: flex; align-items: baseline; gap: 6px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--on-surface);
}
.alph-drawer__topbar-lang { color: var(--on-surface-variant); font-weight: 500; }
.alph-drawer__topbar-actions { display: flex; gap: 2px; }
.alph-drawer__topbar-actions :deep(.alph-btn--icon) { width: 28px; height: 28px; }

.alph-drawer__search { padding: 12px; flex-shrink: 0; }

.alph-drawer__scroll {
  flex: 1;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding-bottom: 12px;
}

.alph-drawer__footer {
  flex-shrink: 0;
  height: var(--footer-height);
  padding: 8px 12px;
  border-top: 1px solid var(--divider);
  background: rgba(255, 255, 255, 0.20);
  display: flex; gap: 6px; align-items: center;
}
[data-theme="dark"] .alph-drawer__footer { background: rgba(0, 0, 0, 0.12); }
</style>
