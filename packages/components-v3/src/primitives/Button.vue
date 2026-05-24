<script setup>
/**
 * Multi-variant button. DESIGN §6.9.
 *
 *   primary    — solid black bg, white text, label-xs uppercase. Used for
 *                "Add to list", "Log in", form submit.
 *   secondary  — outline only, hover paints subtle on-surface tint. Used
 *                alongside primary for "View Full" / "Cancel" / "Share".
 *   ghost      — text only, no border, hover underline. Used for
 *                "Switch language" / inline links.
 *   icon       — 32x32 square host for a single Material-Symbol child.
 *                Used for sidebar tabs, popup actions.
 *   fab        — 44x44 circle, primary fill, drop shadow. Toolbar trigger.
 *
 * Active state is a global `scale(0.98)` (DESIGN §6.9 footer).
 */

defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'secondary', 'ghost', 'icon', 'fab'].includes(v)
  },
  /** Disables the button (visual + a11y) without unmounting click handlers. */
  disabled: { type: Boolean, default: false },
  /** Native button type. Default `button` to avoid accidental form submits. */
  type: { type: String, default: 'button' },
  /** Full-width variant — primary/secondary only. */
  block: { type: Boolean, default: false }
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="alph-btn"
    :class="[`alph-btn--${variant}`, { 'alph-btn--block': block }]"
  >
    <slot />
  </button>
</template>

<style scoped>
.alph-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-weight: 600;
  font-size: 11px;
  line-height: 1;
  transition: background-color var(--motion-fast),
              border-color var(--motion-fast),
              transform var(--motion-fast);
}
.alph-btn:active:not(:disabled) { transform: scale(0.98); }
.alph-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.alph-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.alph-btn--block { width: 100%; }

/* Icons inside buttons — keep proportional to button height. The Icon.vue
 * primitive accepts a `size` prop, but consumers shouldn't have to pass
 * matching numbers everywhere. */
.alph-btn :deep(.alph-icon) { display: inline-block; }

/* primary */
.alph-btn--primary {
  height: 38px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  background: var(--primary);
  color: var(--on-primary);
}
.alph-btn--primary:hover:not(:disabled) { background: var(--primary-container); }

/* secondary (outline) */
.alph-btn--secondary {
  height: 38px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--on-surface);
  border: 1px solid var(--outline);
}
.alph-btn--secondary:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
  border-color: var(--on-surface);
}
[data-theme="dark"] .alph-btn--secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
}

/* ghost */
.alph-btn--ghost {
  height: 28px;
  padding: 0 8px;
  background: transparent;
  color: var(--on-surface);
  border-radius: var(--radius);
}
.alph-btn--ghost:hover:not(:disabled) { text-decoration: underline; }

/* icon */
.alph-btn--icon {
  width: 32px; height: 32px;
  padding: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--on-surface-variant);
  letter-spacing: 0;
  text-transform: none;
}
.alph-btn--icon:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
  color: var(--on-surface);
}
[data-theme="dark"] .alph-btn--icon:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
}

/* fab */
.alph-btn--fab {
  width: var(--toolbar-fab); height: var(--toolbar-fab);
  border-radius: var(--radius-full);
  background: var(--primary);
  color: var(--on-primary);
  letter-spacing: 0;
  text-transform: none;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
}
.alph-btn--fab:hover:not(:disabled) {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
}
</style>
