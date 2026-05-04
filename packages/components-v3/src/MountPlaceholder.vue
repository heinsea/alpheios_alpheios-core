<script setup>
/**
 * Stage 0 placeholder. Confirms the mount pipeline is live.
 * Replaced by App.vue + surface routing in Stage 2.
 */
import { ref } from 'vue'

const buildStamp = ref(new Date().toISOString().replace('T', ' ').slice(0, 19))
</script>

<template>
  <div class="alpheios-v3-placeholder alpheios-v3-scope" data-testid="v3-placeholder">
    <div class="brand alph-brand">α</div>
    <div class="copy">
      <h1>Alpheios v3 root mounted</h1>
      <p>
        Scholarly Glass UI placeholder · Stage 0 verified.<br />
        Mount stamp: <code>{{ buildStamp }}</code>
      </p>
    </div>
  </div>
</template>

<style scoped>
.alpheios-v3-placeholder {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483646; /* one below max so devtools overlays still win */
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  max-width: 360px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.4),
    0 8px 32px 0 rgba(0, 0, 0, 0.08);
  color: #1a1c1d;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.brand {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #000;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  /* lowercase α optical centring */
  padding-bottom: 4px;
  box-sizing: border-box;
}

.copy h1 {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.copy p {
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  color: #4c4546;
}

.copy code {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 3px;
}

@supports not (backdrop-filter: blur(20px)) {
  .alpheios-v3-placeholder {
    background: rgba(255, 255, 255, 0.92);
  }
}
</style>
