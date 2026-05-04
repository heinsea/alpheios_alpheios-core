<script setup>
/**
 * Icon — SVG-based icon primitive.
 *
 * Replaces Material Symbols Outlined font, which fails to load on pages
 * with strict `style-src` CSP (the webfont @import is blocked, leaving
 * literal text like "menu_book" rendered inside icon buttons).
 *
 * 24×24 viewBox, currentColor fill/stroke, Heroicons-style outline (1.75 px
 * stroke, round caps + joins). Adequate visual parity with Material Symbols
 * at 16-22 px without any external font dependency.
 *
 * Add a new icon by registering its `d` path in `ICON_PATHS` below.
 */

import { computed } from 'vue'

const props = defineProps({
  /** Registered icon name. Falls back to `info` if unknown. */
  name: { type: String, required: true },
  /** Pixel size — width and height. Default 18 fits 24×24 / 28×28 buttons. */
  size: { type: [Number, String], default: 18 },
  /** Stroke style; some icons (filled markers) override to `fill`. */
  variant: { type: String, default: 'outline' /* 'outline' | 'fill' */ }
})

/* All paths assume viewBox="0 0 24 24". For outline icons, they are designed
 * to render with `fill: none` + `stroke: currentColor` (linecap/linejoin
 * round). For `fill` variants, paths use `fill: currentColor`. */
const ICON_PATHS = {
  // ─── Lookup / navigation ─────────────────────────────────────────────────
  search:      'M21 21l-5.2-5.2M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
  menu_book:   'M12 6.25v13M12 6.25C10.83 5.48 9.25 5 7.5 5S4.17 5.48 3 6.25v13C4.17 18.48 5.75 18 7.5 18s3.33.48 4.5 1.25M12 6.25C13.17 5.48 14.75 5 16.5 5c1.75 0 3.33.48 4.5 1.25v13C19.83 18.48 18.25 18 16.5 18s-3.33.48-4.5 1.25',
  table_view:  'M3 6h18M3 10h18M3 14h18M3 18h18M9 6v14M15 6v14',
  format_quote:'M7 7H4v4h3v6c0 .55-.45 1-1 1H4M17 7h-3v4h3v6c0 .55-.45 1-1 1h-2',
  account_tree:'M5 4h6v4H5zM5 16h6v4H5zM13 16h6v4h-6zM13 4h6v4h-6zM8 8v4h12M8 12v4',
  history_edu: 'M12 14L3 9l9-5 9 5-9 5zm0 0l6.16-3.42a12.08 12.08 0 0 1 .67 6.47A11.95 11.95 0 0 0 12 20.05a11.95 11.95 0 0 0-6.83-3 12.08 12.08 0 0 1 .67-6.47L12 14z',
  bookmark:    'M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-3.5L6 22V4z',
  account_circle:'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM5 21a7 7 0 0 1 14 0',
  settings:    'M10.32 4.32a1.72 1.72 0 0 1 3.36 0 1.72 1.72 0 0 0 2.57 1.06 1.72 1.72 0 0 1 2.37 2.37 1.72 1.72 0 0 0 1.07 2.57 1.72 1.72 0 0 1 0 3.36 1.72 1.72 0 0 0-1.07 2.57 1.72 1.72 0 0 1-2.37 2.37 1.72 1.72 0 0 0-2.57 1.07 1.72 1.72 0 0 1-3.36 0 1.72 1.72 0 0 0-2.57-1.07 1.72 1.72 0 0 1-2.37-2.37 1.72 1.72 0 0 0-1.07-2.57 1.72 1.72 0 0 1 0-3.36 1.72 1.72 0 0 0 1.07-2.57 1.72 1.72 0 0 1 2.37-2.37 1.72 1.72 0 0 0 2.57-1.06zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',

  // ─── Action / state ──────────────────────────────────────────────────────
  close:       'M6 6l12 12M18 6L6 18',
  add:         'M12 5v14M5 12h14',
  refresh:     'M4 4v5h5M20 20v-5h-5M5.5 9.5a8 8 0 0 1 14.4-1M18.5 14.5a8 8 0 0 1-14.4 1',
  login:       'M11 16l-4-4 4-4M7 12h14M14 8V7a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3v-1',
  share:       'M5 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M15 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M15 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8.5 11l7-4M8.5 13l7 4',
  volume_up:   'M11 5L6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  read_more:   'M4 6h16M4 10h16M4 14h7M4 18h7M14 14h6M14 18h6M17 12l-3 3 3 3',

  // ─── Disclosure ──────────────────────────────────────────────────────────
  expand_less:    'M6 15l6-6 6 6',
  expand_more:    'M6 9l6 6 6-6',
  unfold_more:    'M6 8l6-5 6 5M6 16l6 5 6-5',
  open_in_full:   'M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6',
  close_fullscreen:'M9 4v5H4M15 20v-5h5M10 10L4 4M14 14l6 6',
  more_vert:      'M12 6.5h.01M12 12h.01M12 17.5h.01',
  more_horiz:     'M6 12h.01M12 12h.01M18 12h.01',

  // ─── Status (filled style: tertiary-on-white) ────────────────────────────
  check:          'M5 12.5l5 5 9-10',
  check_circle:   'M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  error:          'M12 8v5M12 16.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  info:           'M12 11v6M12 7.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  verified:       'M9 12l2 2 4-4M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z',

  // ─── Direction / pagination ──────────────────────────────────────────────
  chevron_right:    'M9 6l6 6-6 6',
  chevron_left:     'M15 6l-6 6 6 6',
  arrow_back:       'M15 18l-6-6 6-6M21 12H9',
  arrow_back_ios_new: 'M15 6l-6 6 6 6',
  first_page:       'M18 18l-6-6 6-6M7 6v12',
  last_page:        'M6 18l6-6-6-6M17 6v12',

  // ─── Filter / sort / tune ────────────────────────────────────────────────
  filter_list:    'M4 6h16M7 12h10M10 18h4',
  filter_alt:     'M4 4h16l-6 8v6l-4-2v-4L4 4z',
  sort:           'M4 8h12M4 12h8M4 16h4M16 14l3 3 3-3M19 6v11',
  tune:           'M4 6h6M14 6h6M4 12h12M16 12h4M4 18h4M10 18h10M9 4v4M17 10v4M7 16v4',
  unfold_more_alt:'M8 9l4-4 4 4M8 15l4 4 4-4',

  // ─── File / IO / share ───────────────────────────────────────────────────
  file_upload:    'M12 5v12M7 10l5-5 5 5M5 21h14',
  file_download:  'M12 5v12M7 12l5 5 5-5M5 21h14',
  download:       'M12 4v12M7 11l5 5 5-5M5 20h14',
  print:          'M7 8V4h10v4M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1M7 14h10v6H7z',
  open_in_new:    'M14 4h6v6M20 4l-9 9M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6',
  link:           'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5',
  cloud_sync:     'M7 18h10a4 4 0 1 0-1-7.87A6 6 0 1 0 5 14M9 17l2 2-2 2M15 13l-2-2 2-2',
  sync:           'M4 4v5h5M20 20v-5h-5M5.5 9.5a8 8 0 0 1 13.4-2.5M18.5 14.5a8 8 0 0 1-13.4 2.5',
  history:        'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  share_alt:      'M5 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M15 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M15 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8.5 11l7-4M8.5 13l7 4',

  // ─── List / select ───────────────────────────────────────────────────────
  checklist:      'M4 6l2 2 4-4M4 13l2 2 4-4M14 6h6M14 13h6M4 20l2 2 4-4M14 20h6',
  drag_indicator: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  delete:         'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6',

  // ─── Account / device ────────────────────────────────────────────────────
  logout:         'M15 16l4-4-4-4M19 12H9M13 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8',
  smartphone:     'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  laptop_mac:     'M5 5h14a1 1 0 0 1 1 1v9H4V6a1 1 0 0 1 1-1zM3 17h18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',

  // ─── View / zoom ─────────────────────────────────────────────────────────
  fit_screen:     'M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4',
  help:           'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7v.5M12 17.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'
}

const path = computed(() => ICON_PATHS[props.name] || ICON_PATHS.info)
const useFill = computed(() => props.variant === 'fill')
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="useFill ? 'currentColor' : 'none'"
    :stroke="useFill ? 'none' : 'currentColor'"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="alph-icon"
    :class="`alph-icon--${name}`"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="path" />
  </svg>
</template>

<style scoped>
.alph-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  /* The path strokes inherit currentColor; consumers control color via the
   * surrounding text color (e.g. .alph-btn--icon sets `--on-surface-variant`). */
}
</style>
