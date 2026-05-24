<script setup>
/**
 * Range slider — DESIGN §4 token + §7.8 settings (popup max width, font size).
 *
 * 4 px track + 14 px thumb. Tick marks supported via the `ticks` prop.
 * Native `<input type=range>` for keyboard / a11y; custom track and thumb
 * styled via ::-webkit-slider-* and ::-moz-range-*. The label and the
 * read-out are rendered inline so the consumer can omit them for headless
 * use.
 */
defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  /** Optional unit suffix shown next to the read-out, e.g. "px", "%" */
  unit: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])
function onInput (e) { emit('update:modelValue', Number(e.target.value)) }
</script>

<template>
  <div class="alph-slider" :class="{ 'alph-slider--disabled': disabled }">
    <input
      type="range"
      class="alph-slider__input"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @input="onInput"
    />
    <span class="alph-slider__readout">{{ modelValue }}{{ unit }}</span>
  </div>
</template>

<style scoped>
.alph-slider {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.alph-slider--disabled { opacity: 0.5; }

.alph-slider__readout {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 11px;
  color: var(--on-surface-variant);
  min-width: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.alph-slider__input {
  flex: 1;
  /* Without an explicit min-width, a flex child of a `<input type=range>`
   * inherits its UA-default minimum (~129 px in WebKit / Blink). Inside the
   * drawer's narrow 380 px panel that minimum prevents the input from
   * shrinking, pushing the readout span past the right edge and triggering
   * a horizontal scrollbar. min-width: 0 lets it collapse to whatever the
   * parent width allows. */
  min-width: 0;
  -webkit-appearance: none;
  appearance: none;
  height: 14px;
  background: transparent;
  outline: none;
}
.alph-slider__input:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* WebKit / Blink */
.alph-slider__input::-webkit-slider-runnable-track {
  height: 4px;
  background: var(--surface-container-high);
  border-radius: var(--radius-full);
}
.alph-slider__input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px; height: 14px;
  border-radius: var(--radius-full);
  background: var(--primary);
  margin-top: -5px;
  cursor: pointer;
}

/* Firefox */
.alph-slider__input::-moz-range-track {
  height: 4px;
  background: var(--surface-container-high);
  border-radius: var(--radius-full);
}
.alph-slider__input::-moz-range-thumb {
  width: 14px; height: 14px;
  border-radius: var(--radius-full);
  background: var(--primary);
  border: 0;
  cursor: pointer;
}
</style>
