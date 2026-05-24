<script setup>
/**
 * Chip / tag — DESIGN §6.3 (lang-chip), §6.10 (filter chips), §6.7 (POS).
 *
 * Variants:
 *   default     — outline-variant border + on-surface-variant text. Used for
 *                 POS tags ("NOUN · NEUTER").
 *   filled      — secondary-container fill, like the LATIN / GREEK lang chip.
 *   tertiary    — tertiary text + tertiary-container bg ("✓ recognized").
 *   error       — error-container bg.
 *
 * `clickable` flag adds hover/active states for filter contexts.
 */
defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'filled', 'tertiary', 'error'].includes(v)
  },
  clickable: { type: Boolean, default: false },
  active: { type: Boolean, default: false }
})
</script>

<template>
  <span
    class="alph-chip"
    :class="[
      `alph-chip--${variant}`,
      { 'alph-chip--clickable': clickable, 'alph-chip--active': active }
    ]"
    :role="clickable ? 'button' : null"
    :tabindex="clickable ? 0 : null"
  >
    <slot />
  </span>
</template>

<style scoped>
.alph-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid transparent;
  white-space: nowrap;
  line-height: 14px;
  transition: background-color var(--motion-fast), border-color var(--motion-fast);
}
.alph-chip :deep(.alph-icon) {
  /* Inline SVG icons inside a chip should never push the chip taller than
   * the surrounding text line. */
  width: 12px; height: 12px;
}

.alph-chip--default {
  background: transparent;
  border-color: var(--outline-variant);
  color: var(--on-surface-variant);
}
.alph-chip--filled {
  background: var(--secondary-container);
  color: var(--on-secondary-container);
}
.alph-chip--tertiary {
  background: var(--tertiary-container);
  color: var(--tertiary);
}
.alph-chip--error {
  background: var(--error-container);
  color: var(--on-error-container);
}

.alph-chip--clickable {
  cursor: pointer;
}
/* Hover only changes outline-only chips; active chips keep their bold
 * primary fill so the white text stays readable. */
.alph-chip--clickable:hover:not(.alph-chip--active) {
  border-color: var(--on-surface);
  color: var(--on-surface);
}
.alph-chip--clickable.alph-chip--active:hover {
  background: var(--primary-container);
  border-color: var(--primary-container);
}
.alph-chip--active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}
.alph-chip:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
</style>
