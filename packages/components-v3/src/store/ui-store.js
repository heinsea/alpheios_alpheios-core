/**
 * UI store — single reactive object describing the current v3 surface.
 *
 * Lives in the fork so every Vue component can `import { uiStore } from
 * '@/store/ui-store.js'` without prop drilling. Stage 4 will introduce a
 * separate `data-store.js` (or call adapter directly) for lookup results;
 * this one stays UI-only.
 *
 * Why not Pinia: a single reactive() + a few setters cover the whole need
 * (4 surfaces, 9 pages, 4 popup states, 1 theme). Pinia adds ~3 KB and
 * boilerplate for nothing.
 *
 * Why not provide/inject: every consumer would need the right ancestor;
 * importing from a module file lets Sandbox / pages / surfaces share the
 * same singleton without ceremony.
 */

import { reactive, readonly, computed } from 'vue'

/** All possible surface ids. Only one is visible at a time. */
export const SURFACES = ['popup', 'drawer', 'toolbar', 'hidden']

/** Drawer pages. Visibility is gated by which page has data (Stage 4). */
export const PAGES = [
  'lookup',      // default
  'morph',
  'inflections',
  'usage',
  'tree',
  'grammar',
  'wordlist',
  'user',
  'opts'
]

/** Popup display states (DESIGN.md §7.1, mockup popup-states.html). */
export const POPUP_STATES = ['default', 'loading', 'no-result', 'error']

const state = reactive({
  surface: 'drawer',           // current surface
  page: 'lookup',              // current drawer page
  popupState: 'default',       // current popup state
  theme: 'light',              // 'light' | 'dark' (Stage 5 wires auto-detect)
  toast: null,                 // { kind, title, body, ttl } or null
  // Set of pages that currently have data (controls sidebar disable state).
  // Stage 2 hardcodes; Stage 4 derives from Vuex store.
  availablePages: new Set(['lookup', 'morph', 'inflections', 'usage', 'tree', 'wordlist', 'grammar', 'user', 'opts'])
})

let toastTimer = null

export const uiStore = {
  state: readonly(state),
  /** Computed convenience. */
  isVisible: computed(() => state.surface !== 'hidden'),

  setSurface (s) {
    if (!SURFACES.includes(s)) throw new Error(`Unknown surface: ${s}`)
    state.surface = s
  },
  setPage (p) {
    if (!PAGES.includes(p)) throw new Error(`Unknown page: ${p}`)
    state.page = p
  },
  setPopupState (ps) {
    if (!POPUP_STATES.includes(ps)) throw new Error(`Unknown popup state: ${ps}`)
    state.popupState = ps
  },
  setTheme (t) {
    if (!['light', 'dark'].includes(t)) throw new Error(`Unknown theme: ${t}`)
    state.theme = t
  },
  isPageAvailable (p) { return state.availablePages.has(p) },
  setAvailablePages (set) { state.availablePages = new Set(set) },

  /** Toast helper. ttl in ms; auto-dismiss. Pass null body for one-line toasts. */
  showToast ({ kind = 'info', title, body = null, ttl = 3500 } = {}) {
    state.toast = { kind, title, body }
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { state.toast = null }, ttl)
  },
  dismissToast () {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null }
    state.toast = null
  }
}

/**
 * Read URL query params (only when running inside an extension content
 * script — the host page URL drives this) and apply matching overrides.
 * Lets the user preview surfaces / popup-states / theme without rebuild:
 *
 *   ?alpheios=v3                              → drawer + lookup
 *   ?alpheios=v3&surface=popup&state=loading  → popup loading
 *   ?alpheios=v3&surface=toolbar              → just FAB
 *   ?alpheios=v3&theme=dark                   → dark mode
 */
export function applyUrlOverrides () {
  try {
    const u = new URL(window.location.href)
    const surface = u.searchParams.get('surface')
    const popupState = u.searchParams.get('state')
    const page = u.searchParams.get('page')
    const theme = u.searchParams.get('theme')
    if (surface && SURFACES.includes(surface)) uiStore.setSurface(surface)
    if (popupState && POPUP_STATES.includes(popupState)) uiStore.setPopupState(popupState)
    if (page && PAGES.includes(page)) uiStore.setPage(page)
    if (theme && ['light', 'dark'].includes(theme)) uiStore.setTheme(theme)
  } catch { /* not in a browser context (tests) — skip */ }
}
