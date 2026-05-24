<script setup>
/**
 * Recessed-well text input — DESIGN §6.2, §7.4 word-list filter, §7.1 search.
 *
 * No external border; inset shadow makes it look "sunken" into the surface.
 * Optional prefix icon (Icon.vue name) + optional clear button when value
 * is non-empty. Use v-model:value to keep the value in sync.
 *
 * The Lookup search uses a variant with a language chip on the right; that
 * is achieved via the `<template #suffix>` slot rather than a prop, to keep
 * this primitive flexible.
 */
import Icon from './Icon.vue'

defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  /** Icon name (see Icon.vue ICON_PATHS). '' to omit the prefix. */
  icon: { type: String, default: '' },
  /** Whether to show a clear "✕" button when the input has content. */
  clearable: { type: Boolean, default: false },
  type: { type: String, default: 'text' },
  ariaLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'enter', 'clear'])
function onInput (e) { emit('update:modelValue', e.target.value) }
function onKey (e) { if (e.key === 'Enter') emit('enter', e.target.value) }
function onClear () { emit('update:modelValue', ''); emit('clear') }
</script>

<template>
  <div
    class="alph-recessed"
    :class="{ 'alph-recessed--disabled': disabled }"
  >
    <Icon v-if="icon" :name="icon" :size="16" class="alph-recessed__icon" />
    <input
      class="alph-recessed__input"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @input="onInput"
      @keydown="onKey"
    />
    <button
      v-if="clearable && modelValue"
      type="button"
      class="alph-recessed__clear"
      aria-label="Clear"
      @click="onClear"
    >
      <Icon name="close" :size="14" />
    </button>
    <slot name="suffix" />
  </div>
</template>

<style scoped>
.alph-recessed {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  background: var(--recessed-bg);
  box-shadow: var(--recessed-shadow);
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}
.alph-recessed:focus-within {
  border-color: rgba(0, 0, 0, 0.15);
  box-shadow: var(--recessed-shadow), 0 0 0 1px rgba(0, 0, 0, 0.08);
}
[data-theme="dark"] .alph-recessed:focus-within {
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: var(--recessed-shadow), 0 0 0 1px rgba(255, 255, 255, 0.10);
}
.alph-recessed--disabled { opacity: 0.5; }

.alph-recessed__icon { color: var(--on-surface-variant); }

.alph-recessed__input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  outline: none;
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  color: var(--on-surface);
}
.alph-recessed__input::placeholder { color: var(--on-surface-variant); }

.alph-recessed__clear {
  width: 20px; height: 20px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: 0; cursor: pointer;
  color: var(--on-surface-variant);
  border-radius: var(--radius);
}
.alph-recessed__clear:hover { background: rgba(0, 0, 0, 0.05); color: var(--on-surface); }
</style>
