<script setup>
/**
 * Horizontal segmented control — DESIGN §6.10. Used for Settings top tabs
 * (UI / Features / Resources / Advanced) and inflection table view density.
 *
 * Two sizes: default (32px) and inline (24px). Active item is "lifted"
 * (lowest surface + outline-variant border) over a recessed-well track.
 */
import Icon from './Icon.vue'

defineProps({
  modelValue: { type: [String, Number], required: true },
  options: {
    type: Array,
    required: true,
    /* Each option: { value, label } | { value, label, icon } */
  },
  size: {
    type: String,
    default: 'default', // 'default' | 'inline'
    validator: (v) => ['default', 'inline'].includes(v)
  },
  ariaLabel: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div
    class="alph-segmented"
    :class="`alph-segmented--${size}`"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="tab"
      :aria-selected="modelValue === opt.value"
      class="alph-segmented__item"
      :class="{ 'alph-segmented__item--active': modelValue === opt.value }"
      @click="emit('update:modelValue', opt.value)"
    >
      <Icon v-if="opt.icon" :name="opt.icon" :size="14" />
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.alph-segmented {
  display: inline-flex;
  background: var(--recessed-bg);
  box-shadow: var(--recessed-shadow);
  border-radius: var(--radius-md);
  padding: 2px;
  gap: 2px;
}
.alph-segmented--default { height: 32px; }
.alph-segmented--inline { height: 24px; }

.alph-segmented__item {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid transparent;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  color: var(--on-surface-variant);
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  padding: 0 12px;
  transition: background-color var(--motion-fast),
              border-color var(--motion-fast),
              color var(--motion-fast);
}
.alph-segmented--inline .alph-segmented__item { padding: 0 8px; font-size: 10px; }

.alph-segmented__item:hover:not(.alph-segmented__item--active) {
  color: var(--on-surface);
}
.alph-segmented__item--active {
  background: var(--surface-container-lowest);
  border-color: var(--outline-variant);
  color: var(--on-surface);
}
.alph-segmented__item:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}
</style>
