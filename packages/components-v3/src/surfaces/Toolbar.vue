<script setup>
/**
 * Toolbar — DESIGN §2 (FAB). 44 × 44 fixed bottom-right when no other surface
 * is visible. Click → store.setSurface('drawer'). Stage 5 will respect a
 * `showToolbarFab` setting (default true).
 */

import Button from '../primitives/Button.vue'
import Icon from '../primitives/Icon.vue'
import { uiStore } from '../store/ui-store.js'

defineProps({
  /** Override icon (default: menu_book — Alpheios's classical-text glyph). */
  icon: { type: String, default: 'menu_book' }
})
const emit = defineEmits(['open'])

function open () {
  emit('open')
  uiStore.setSurface('drawer')
}
</script>

<template>
  <div class="alph-toolbar alpheios-v3-scope" role="presentation">
    <Button variant="fab" aria-label="Open Alpheios" @click="open">
      <Icon :name="icon" :size="22" />
    </Button>
  </div>
</template>

<style scoped>
.alph-toolbar {
  position: fixed;
  right: 24px; bottom: 24px;
  z-index: 30;
  pointer-events: auto;
}
</style>
