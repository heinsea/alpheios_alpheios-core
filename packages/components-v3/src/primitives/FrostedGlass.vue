<script setup>
/**
 * Frosted-glass surface container — DESIGN §4.5 baseline mixin.
 *
 * Wraps a child surface (Popup, Drawer, Toast) with the canonical
 * Scholarly Glass material: semi-transparent surface + heavy backdrop blur +
 * inset top highlight + soft drop shadow. The exact recipe lives here so
 * every glass surface in the app stays visually consistent.
 *
 * `tone` lets the consumer pick between the standard `glass-surface` (~65%
 * opacity) and the `glass-surface-low` (~35%) used for embedded panels.
 *
 * `radius` is plumbed through as a CSS variable so a rounder hero card and
 * a sharper toast can share the same component.
 */

defineProps({
  tone: {
    type: String,
    default: 'standard', // 'standard' | 'low'
    validator: (v) => ['standard', 'low'].includes(v)
  },
  radius: {
    type: String,
    default: 'var(--radius-xl)'
  },
  /**
   * `as` lets the consumer pick the host tag (default `div`) — useful for
   * making the glass surface a `<dialog>` or `<aside>` for a11y.
   */
  as: {
    type: String,
    default: 'div'
  }
})
</script>

<template>
  <component
    :is="as"
    class="frosted-glass"
    :class="`frosted-glass--${tone}`"
    :style="{ borderRadius: radius }"
  >
    <slot />
  </component>
</template>

<style scoped>
.frosted-glass {
  background: var(--glass-surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.5),
    0 12px 40px 0 var(--glass-shadow);
  /* The container is a positioning anchor for arrows (popup) and absolute
   * children (sidebar overlay). */
  position: relative;
}

.frosted-glass--low {
  background: var(--glass-surface-low);
}

[data-theme="dark"] .frosted-glass {
  /* Inset highlight is too bright in dark mode; tone it down. */
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.06),
    0 12px 40px 0 var(--glass-shadow);
}

@supports not (backdrop-filter: blur(20px)) {
  .frosted-glass { background: rgba(255, 255, 255, 0.92); }
  [data-theme="dark"] .frosted-glass { background: rgba(20, 22, 24, 0.92); }
}
</style>
