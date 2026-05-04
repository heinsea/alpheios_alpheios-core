<script setup>
/**
 * Toast — DESIGN §6.12. Right-bottom glass card with a 3 px coloured stripe
 * indicating kind: success (tertiary), error (error), info (secondary).
 */

import { computed } from 'vue'
import Icon from '../primitives/Icon.vue'
import { uiStore } from '../store/ui-store.js'

const toast = computed(() => uiStore.state.toast)

function iconFor (kind) {
  return ({ success: 'check_circle', error: 'error', info: 'info' })[kind] || 'info'
}
</script>

<template>
  <Transition name="alph-toast-fade">
    <aside
      v-if="toast"
      class="alph-toast alpheios-v3-scope"
      :class="`alph-toast--${toast.kind}`"
      role="status"
      aria-live="polite"
      @click="uiStore.dismissToast()"
    >
      <span class="alph-toast__stripe" />
      <Icon :name="iconFor(toast.kind)" :size="18" class="alph-toast__icon" />
      <div class="alph-toast__copy">
        <strong>{{ toast.title }}</strong>
        <span v-if="toast.body" class="alph-toast__body">{{ toast.body }}</span>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.alph-toast {
  position: fixed;
  right: 24px; bottom: 88px;
  z-index: 60;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px 12px 14px;
  min-width: 240px;
  max-width: 360px;
  background: var(--glass-surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.5),
    0 12px 40px 0 var(--glass-shadow);
  cursor: pointer;
  pointer-events: auto;
  overflow: hidden;
}

.alph-toast__stripe {
  position: absolute;
  top: 0; bottom: 0; left: 0;
  width: 3px;
  background: var(--secondary);
}
.alph-toast--success .alph-toast__stripe { background: var(--tertiary); }
.alph-toast--error   .alph-toast__stripe { background: var(--error); }
.alph-toast--info    .alph-toast__stripe { background: var(--secondary); }

.alph-toast__icon { color: var(--on-surface-variant); margin-top: 1px; }
.alph-toast--success .alph-toast__icon { color: var(--tertiary); }
.alph-toast--error   .alph-toast__icon { color: var(--error); }

.alph-toast__copy {
  display: flex; flex-direction: column;
  gap: 2px;
  font-size: 12px; line-height: 16px;
  color: var(--on-surface);
}
.alph-toast__copy strong { font-weight: 600; }
.alph-toast__body { color: var(--on-surface-variant); font-size: 11px; }

.alph-toast-fade-enter-active,
.alph-toast-fade-leave-active {
  transition: opacity var(--motion-base), transform var(--motion-base);
}
.alph-toast-fade-enter-from,
.alph-toast-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
