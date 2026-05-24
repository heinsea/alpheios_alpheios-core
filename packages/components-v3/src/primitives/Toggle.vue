<script setup>
/**
 * Pill toggle — DESIGN §6.8 row control. Used for boolean settings.
 *
 * 32×18 track with a 14×14 thumb. v-model ready (`modelValue` + `update:`).
 * Disabled state dims to 0.5; cursor not-allowed.
 */
defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])
function flip (e) {
  if (e.currentTarget.disabled) return
  emit('update:modelValue', !e.currentTarget.checked ? false : true)
}
</script>

<template>
  <label
    class="alph-toggle"
    :class="{ 'alph-toggle--on': modelValue, 'alph-toggle--disabled': disabled }"
  >
    <input
      type="checkbox"
      class="alph-toggle__native"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @change="flip"
    />
    <span class="alph-toggle__track">
      <span class="alph-toggle__thumb" />
    </span>
  </label>
</template>

<style scoped>
.alph-toggle {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}
.alph-toggle--disabled { opacity: 0.5; cursor: not-allowed; }

.alph-toggle__native {
  /* Visually hidden but keyboard-focusable for a11y. */
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0);
  white-space: nowrap; border: 0;
}

.alph-toggle__track {
  position: relative;
  width: 32px; height: 18px;
  border-radius: var(--radius-full);
  background: var(--surface-container-high);
  border: 1px solid var(--outline-variant);
  transition: background-color var(--motion-base);
}
.alph-toggle--on .alph-toggle__track {
  background: var(--primary);
  border-color: var(--primary);
}

.alph-toggle__thumb {
  position: absolute;
  top: 1px; left: 1px;
  width: 14px; height: 14px;
  border-radius: var(--radius-full);
  background: var(--surface-container-lowest);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  transition: transform var(--motion-base);
}
.alph-toggle--on .alph-toggle__thumb { transform: translateX(14px); }

.alph-toggle__native:focus-visible + .alph-toggle__track {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
</style>
