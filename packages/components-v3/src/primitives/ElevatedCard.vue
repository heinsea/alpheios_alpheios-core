<script setup>
/**
 * Elevated card — DESIGN §4.5, §6.7 citation card, §6.5 morph card.
 *
 * Uses the bottom of the surface stack (lowest) + outline-variant border.
 * NOT a glass surface — opaque, sits in-flow inside a Drawer body.
 *
 * Slots:
 *   - default   : main content
 *   - eyebrow   : small uppercase label printed top-left (§6.7 "IN CONTEXT")
 *   - footer    : optional footer row (§6.7 "— Virgil ·  View Full →")
 *
 * The `accent` prop adds a 1.5px left tertiary stripe — used for the
 * "disambiguated lemma" card in morph (DESIGN §6.5).
 */
defineProps({
  accent: { type: Boolean, default: false },
  /** Compact mode trims padding for high-density lists. */
  compact: { type: Boolean, default: false }
})
defineSlots()
</script>

<template>
  <article
    class="alph-elevated"
    :class="{ 'alph-elevated--accent': accent, 'alph-elevated--compact': compact }"
  >
    <header v-if="$slots.eyebrow" class="alph-elevated__eyebrow">
      <slot name="eyebrow" />
    </header>
    <div class="alph-elevated__body"><slot /></div>
    <footer v-if="$slots.footer" class="alph-elevated__footer">
      <slot name="footer" />
    </footer>
  </article>
</template>

<style scoped>
.alph-elevated {
  position: relative;
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-xl);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.alph-elevated--compact { padding: 12px; gap: 6px; }

.alph-elevated--accent::before {
  content: '';
  position: absolute;
  top: 12px; bottom: 12px; left: -1px;
  width: 1.5px;
  background: var(--tertiary);
  border-radius: 2px;
}

.alph-elevated__eyebrow {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--on-surface-variant);
}

.alph-elevated__body {
  font-size: 13px;
  line-height: 20px;
  color: var(--on-surface);
}

.alph-elevated__footer {
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--on-surface-variant);
  border-top: 1px solid var(--divider);
  padding-top: 8px;
}
</style>
