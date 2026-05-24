<script setup>
/**
 * Stat card — DESIGN §4.2 stats-display + §7.9 user profile.
 *
 * Hero number + small label. Used in the Auth profile page ("24 words saved /
 * 3 languages") and could feed into any future analytics surface.
 */
defineProps({
  value: { type: [String, Number], required: true },
  label: { type: String, required: true }
})
</script>

<template>
  <div class="alph-stat-card">
    <div class="alph-stat-card__value">{{ value }}</div>
    <div class="alph-stat-card__label">{{ label }}</div>
  </div>
</template>

<style scoped>
.alph-stat-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-xl);
}

.alph-stat-card__value {
  font-size: 18px;
  line-height: 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--on-surface);
  font-variant-numeric: tabular-nums;
}

.alph-stat-card__label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--on-surface-variant);
}
</style>
