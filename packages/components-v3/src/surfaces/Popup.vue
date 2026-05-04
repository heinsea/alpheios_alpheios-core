<script setup>
/**
 * Popup surface — DESIGN §3.1 + mockup popup-states.html.
 *
 * 360 × auto, max-h 480, anchored to a caret position. Renders 4 states
 * driven by `state` prop:
 *
 *   default    : word meta + numbered defs + verified chip + dual footer
 *   loading    : 2 px indeterminate progress + 3 skeleton rows + disabled CTAs
 *   no-result  : centred empty text + two outbound links + close button
 *   error      : error banner above cached body (still useful) + retry footer
 *
 * `data` provides the lookup payload for default + error (cached) states.
 * `emptyStates` provides copy for the no-result + loading + error scenes.
 * The arrow is a 12 × 12 rotated ::before — colour matches glass background.
 */

import { computed } from 'vue'
import Button from '../primitives/Button.vue'
import Chip from '../primitives/Chip.vue'
import Icon from '../primitives/Icon.vue'

const props = defineProps({
  state: { type: String, default: 'default' },
  data: { type: Object, default: () => ({}) },
  emptyStates: { type: Object, default: () => ({}) },
  arrowDir: { type: String, default: 'up' }
})
const emit = defineEmits(['close', 'expand', 'add', 'retry', 'login', 'switchLanguage', 'lookupVariants'])

const targetWord = computed(() => {
  // Prefer live data (data.lemma has the actual queried word) over fixture stubs.
  if (props.state === 'loading') return props.data.lemma || props.emptyStates.loading?.lemma || ''
  if (props.state === 'no-result') return props.data.lemma || props.emptyStates.noResult?.lemma || ''
  if (props.state === 'error') return props.data.lemma || props.emptyStates.error?.lemma || ''
  return props.data.selectedText || props.data.lemma || ''
})
const targetLang = computed(() => {
  // Prefer live data.lang over fixture stubs.
  const liveLang = props.data.lang
  if (props.state === 'loading') return liveLang || props.emptyStates.loading?.lang
  if (props.state === 'no-result') return liveLang || props.emptyStates.noResult?.lang
  if (props.state === 'error') return liveLang || props.emptyStates.error?.lang
  return liveLang
})
const errorBanner = computed(() => props.emptyStates.error?.banner)
const noResultData = computed(() => {
  const raw = props.emptyStates.noResult || {}
  // Substitute the fixture's placeholder word with the actual queried word.
  if (targetWord.value && raw.desc) {
    const escaped = raw.lemma ? raw.lemma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''
    const re = escaped ? new RegExp(escaped, 'g') : null
    return {
      ...raw,
      desc: re ? raw.desc.replace(re, targetWord.value) : raw.desc
    }
  }
  return raw
})
const cachedPos = computed(() => props.emptyStates.error?.cachedPos || [])
const cachedDefs = computed(() => props.emptyStates.error?.cachedDefs || [])

const showFullBody = computed(() => props.state === 'default' || props.state === 'error')
</script>

<template>
  <div class="alph-popup alpheios-v3-scope" :class="`alph-popup--arrow-${arrowDir}`">
    <header class="alph-popup__header">
      <span class="alph-brand alph-brand--popup">α</span>
      <span class="alph-popup__target lang-classical">{{ targetWord }}</span>
      <div class="alph-popup__actions">
        <Button variant="icon" aria-label="Expand to drawer" @click="emit('expand')">
          <Icon name="open_in_full" :size="16" />
        </Button>
        <Button variant="icon" aria-label="Close" @click="emit('close')">
          <Icon name="close" :size="16" />
        </Button>
      </div>
    </header>

    <div v-if="state === 'loading'" class="alph-popup__progress" />

    <div class="alph-popup__body">
      <div v-if="state === 'error' && errorBanner" class="alph-popup__error-banner">
        <Icon name="error" :size="16" class="alph-popup__error-icon" />
        <div>
          <strong>{{ errorBanner.title }}</strong>
          {{ errorBanner.desc }}
        </div>
      </div>

      <div v-if="state === 'no-result'" class="alph-popup__empty">
        <p class="alph-popup__empty-title">{{ noResultData.title }}</p>
        <p class="alph-popup__empty-desc" v-html="noResultData.desc" />
        <div class="alph-popup__empty-links">
          <a v-for="l in noResultData.links" :key="l.label" :href="l.href" class="alph-popup__empty-link">{{ l.label }}</a>
        </div>
      </div>

      <template v-if="showFullBody || state === 'loading'">
        <div class="alph-popup__meta">
          <div class="alph-popup__pos">
            <template v-if="state === 'loading'">
              <span class="alph-popup__pos-text alph-popup__pos-text--muted">analyzing…</span>
            </template>
            <template v-else>
              <span class="alph-popup__pos-text">
                <template v-for="(p, idx) in (state === 'error' ? cachedPos : data.pos || [])" :key="idx">
                  <strong v-if="p.kind === 'primary'">{{ p.label.toUpperCase() }}</strong>
                  <span v-else>{{ p.label.toUpperCase() }}</span>
                  <span v-if="idx < (state === 'error' ? cachedPos : data.pos || []).length - 1"> · </span>
                </template>
              </span>
              <span v-if="state === 'error'" class="alph-popup__pos-text alph-popup__pos-text--muted">cached</span>
            </template>
          </div>
          <Chip v-if="targetLang" variant="filled">{{ targetLang }}</Chip>
        </div>

        <div class="alph-popup__defs">
          <template v-if="state === 'loading'">
            <div v-for="(w, i) in [90, 70, 80]" :key="i" class="alph-popup__def">
              <span class="alph-popup__def-num">{{ i + 1 }}.</span>
              <span class="alph-popup__skeleton" :style="{ width: w + '%' }" />
            </div>
          </template>
          <template v-else>
            <div v-for="(d, i) in (state === 'error' ? cachedDefs : data.definitions || []).slice(0, 3)" :key="i" class="alph-popup__def">
              <span class="alph-popup__def-num">{{ i + 1 }}.</span>
              <span class="alph-popup__def-text" v-html="d" />
            </div>
          </template>
        </div>

        <div v-if="state === 'default' && data.recognized" class="alph-popup__verified">
          <Icon name="check_circle" :size="12" />
          recognized
        </div>
      </template>
    </div>

    <footer class="alph-popup__footer">
      <template v-if="state === 'default'">
        <Button variant="primary" block @click="emit('add')">
          <Icon name="add" :size="14" />
          Add to list
        </Button>
        <Button variant="secondary" aria-label="Expand to drawer" @click="emit('expand')">
          <Icon name="open_in_full" :size="14" />
        </Button>
      </template>
      <template v-else-if="state === 'loading'">
        <Button variant="primary" block disabled>
          <Icon name="add" :size="14" />
          Add to list
        </Button>
        <Button variant="secondary" disabled aria-label="Expand">
          <Icon name="open_in_full" :size="14" />
        </Button>
      </template>
      <template v-else-if="state === 'no-result'">
        <Button variant="secondary" block @click="emit('close')">Close</Button>
      </template>
      <template v-else-if="state === 'error'">
        <Button variant="secondary" block @click="emit('retry')">
          <Icon name="refresh" :size="14" />
          Retry
        </Button>
        <Button variant="secondary" aria-label="Sign in" @click="emit('login')">
          <Icon name="login" :size="14" />
        </Button>
      </template>
    </footer>
  </div>
</template>

<style scoped>
.alph-popup {
  position: relative;
  width: var(--popup-width);
  max-height: 480px;
  border-radius: var(--radius-xl);
  background: var(--glass-surface);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.5),
    0 12px 40px 0 var(--glass-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}
[data-theme="dark"] .alph-popup {
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.06),
    0 12px 40px 0 var(--glass-shadow);
}

.alph-popup::before {
  content: '';
  position: absolute;
  width: 12px; height: 12px;
  background: var(--glass-surface);
  border-left: 1px solid var(--glass-border);
  border-top: 1px solid var(--glass-border);
}
.alph-popup--arrow-up::before { top: -6px; left: 64px; transform: rotate(45deg); }
.alph-popup--arrow-down::before { bottom: -6px; left: 64px; transform: rotate(225deg); }

.alph-popup__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  height: 36px;
  border-bottom: 1px solid var(--divider);
  background: rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
}
[data-theme="dark"] .alph-popup__header { background: rgba(0, 0, 0, 0.15); }

.alph-brand--popup {
  width: 22px; height: 22px; border-radius: var(--radius-md);
  background: var(--primary); color: var(--on-primary);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
  /* lowercase α optical centring */
  padding-bottom: 2px;
  flex-shrink: 0;
}
.alph-popup__target {
  flex: 1; min-width: 0;
  font-size: 13px; font-weight: 600; letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--on-surface);
}
.alph-popup__actions { display: flex; gap: 2px; }
/* shrink the Button:icon variant to 24×24 inside the popup header */
.alph-popup__actions :deep(.alph-btn--icon) { width: 24px; height: 24px; }

.alph-popup__progress {
  position: relative;
  overflow: hidden;
  height: 2px;
  background: rgba(0, 0, 0, 0.06);
}
.alph-popup__progress::after {
  content: '';
  position: absolute;
  top: 0; left: 0; height: 100%; width: 25%;
  background: var(--primary);
  animation: alph-popup-progress 1.6s infinite ease-in-out;
}
@keyframes alph-popup-progress {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

.alph-popup__body {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.alph-popup__meta {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}
.alph-popup__pos { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.alph-popup__pos-text {
  font-size: 10px; font-weight: 500; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--on-surface-variant);
}
.alph-popup__pos-text strong { color: var(--on-surface); font-weight: 600; }
.alph-popup__pos-text--muted { opacity: 0.6; }

.alph-popup__defs { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.alph-popup__def {
  display: flex; gap: 8px;
  padding: 6px 0;
  border-top: 1px solid var(--divider);
}
.alph-popup__def:first-child { border-top: 0; padding-top: 0; }
.alph-popup__def-num {
  font-size: 11px; font-weight: 500;
  color: var(--on-surface-variant);
  opacity: 0.6;
  width: 16px; flex-shrink: 0;
}
.alph-popup__def-text {
  font-size: 12px; line-height: 16px;
  color: var(--on-surface);
}
.alph-popup__skeleton {
  display: inline-block;
  height: 12px;
  border-radius: var(--radius);
  background: linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.10) 50%, rgba(0,0,0,0.04) 100%);
  background-size: 200% 100%;
  animation: alph-popup-shimmer 1.6s infinite;
}
@keyframes alph-popup-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

.alph-popup__verified {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--tertiary);
  font-size: 10px; font-weight: 500; letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-top: 4px;
}

.alph-popup__empty { text-align: center; padding: 12px 8px 0; }
.alph-popup__empty-title {
  font-size: 13px; font-weight: 600; letter-spacing: -0.01em;
  color: var(--on-surface);
  margin: 0 0 4px;
}
.alph-popup__empty-desc {
  font-size: 12px; line-height: 16px;
  color: var(--on-surface-variant);
  margin: 0 0 12px;
}
.alph-popup__empty-links {
  display: flex; justify-content: center; gap: 12px; margin-top: 8px;
}
.alph-popup__empty-link {
  font-size: 11px; font-weight: 500;
  color: var(--primary);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
}

.alph-popup__error-banner {
  display: flex; align-items: flex-start; gap: 8px;
  background: var(--error-container);
  color: var(--on-error-container);
  border-radius: var(--radius-lg);
  padding: 8px 10px;
  font-size: 11px; line-height: 14px;
  margin-bottom: 12px;
}
.alph-popup__error-icon { color: var(--error); margin-top: 1px; flex-shrink: 0; }
.alph-popup__error-banner strong { display: block; font-weight: 600; margin-bottom: 2px; }

.alph-popup__footer {
  display: flex; gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--divider);
  background: rgba(255, 255, 255, 0.20);
  flex-shrink: 0;
}
[data-theme="dark"] .alph-popup__footer { background: rgba(0, 0, 0, 0.12); }
.alph-popup__footer :deep(.alph-btn--secondary):not(.alph-btn--block) {
  height: 38px;
  padding: 0 12px;
}
</style>
