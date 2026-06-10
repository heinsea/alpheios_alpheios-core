<script setup>
import { ref, computed, watch } from 'vue'
import DependencyTree from '../primitives/DependencyTree.vue'
import { getWorkIndex, getSentence, getWorkInfo } from '../lib/treebank-service.js'
import { buildTreebankResource } from '../lib/treebank-data.js'

const props = defineProps({
  docId: { type: String, default: '' },
  sentenceId: { type: String, default: '' },
  wordIds: { type: Array, default: () => [] },
  providers: { type: Array, default: null }
})

const emit = defineEmits(['navigate', 'token-select'])

const workIndex = ref(null)
const position = ref(0) // 0-based offset into workIndex.sentences (array order, NOT cite/id arithmetic)
const currentSentence = ref(null)
const dataSource = ref(null)
const loading = ref(false)
const error = ref(null)
const highlightIds = ref([])
const selectedPos = ref([])

const loadOptions = computed(() => (props.providers ? { providers: props.providers } : {}))

const total = computed(() => workIndex.value?.sentences?.length || 0)

const treeResource = computed(() => {
  if (!currentSentence.value) return null
  return buildTreebankResource(currentSentence.value, { wordIds: highlightIds.value })
})

const pagerInfo = computed(() => (total.value ? `${position.value + 1} / ${total.value}` : ''))

const workTitle = computed(() => {
  if (!props.docId) return ''
  const info = getWorkInfo(props.docId)
  if (!info) return props.docId
  return info.author ? `${info.author} — ${info.title}` : info.title
})

const SOURCE_LABELS = {
  local: 'Offline',
  cdn: 'CDN',
  api: 'API',
  embedded: 'Built-in'
}

const footerMeta = computed(() => {
  if (!currentSentence.value) return ''
  const cite = currentSentence.value.cite || ''
  const provider = currentSentence.value.provider || 'Perseus AGLDT'
  const tokenCount = Math.max(0, (currentSentence.value.nodes?.length || 1) - 1)
  return `${cite} · ${tokenCount} tokens · ${provider}`
})

let loadGeneration = 0

async function loadWork (docId, sentenceId) {
  if (!docId) return
  const generation = ++loadGeneration
  loading.value = true
  error.value = null

  try {
    const { index, source } = await getWorkIndex(docId, loadOptions.value)
    if (generation !== loadGeneration) return
    if (!index?.sentences?.length) {
      workIndex.value = null
      currentSentence.value = null
      error.value = `Unable to load treebank data for ${docId}`
      return
    }
    workIndex.value = index
    dataSource.value = source

    let startAt = 0
    if (sentenceId) {
      const found = index.sentences.findIndex(s => String(s.id) === String(sentenceId))
      if (found >= 0) startAt = found
    }
    position.value = startAt
    await loadSentenceAt(startAt, generation)
  } catch (err) {
    if (generation !== loadGeneration) return
    console.error('[TreebankPage] Load error:', err)
    error.value = `Failed to load: ${err.message}`
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}

async function loadSentenceAt (pos, generation = loadGeneration) {
  const entry = workIndex.value?.sentences?.[pos]
  if (!entry) return

  loading.value = true
  error.value = null
  try {
    const { sentence, source } = await getSentence(props.docId, entry.id, loadOptions.value)
    if (generation !== loadGeneration) return
    if (!sentence) {
      currentSentence.value = null
      error.value = `Unable to load sentence ${entry.id}`
      return
    }
    currentSentence.value = sentence
    dataSource.value = source
    emit('navigate', { docId: props.docId, sentenceId: entry.id })

    const next = workIndex.value.sentences[pos + 1]
    if (next) getSentence(props.docId, next.id, loadOptions.value).catch(() => {})
  } catch (err) {
    if (generation !== loadGeneration) return
    console.error('[TreebankPage] Sentence load error:', err)
    error.value = `Failed to load: ${err.message}`
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}

function goTo (pos) {
  if (pos < 0 || pos >= total.value || pos === position.value) return
  position.value = pos
  loadSentenceAt(pos)
}

const goToFirst = () => goTo(0)
const goToPrevious = () => goTo(position.value - 1)
const goToNext = () => goTo(position.value + 1)
const goToLast = () => goTo(total.value - 1)

function handleTokenSelect (tokenId) {
  highlightIds.value = highlightIds.value.includes(tokenId) ? [] : [tokenId]
  emit('token-select', tokenId)
}

function togglePosFilter (pos) {
  const index = selectedPos.value.indexOf(pos)
  if (index >= 0) {
    selectedPos.value.splice(index, 1)
  } else {
    selectedPos.value.push(pos)
  }
}

const availablePos = computed(() => {
  if (!currentSentence.value?.nodes) return []
  const posSet = new Set()
  currentSentence.value.nodes.forEach(node => {
    if (node.pos && node.id > 0) posSet.add(node.pos)
  })
  return Array.from(posSet).sort()
})

watch(() => [props.docId, props.sentenceId], ([docId, sentenceId]) => {
  if (docId) loadWork(docId, sentenceId)
}, { immediate: true })

watch(() => props.wordIds, (wordIds) => {
  highlightIds.value = wordIds || []
}, { immediate: true })
</script>

<template>
  <div class="alph-treebank-page">
    <div class="alph-treebank-page__header">
      <h2 class="alph-treebank-page__title">{{ workTitle }}</h2>
      <div class="alph-treebank-page__controls">
        <div class="alph-treebank-page__pager">
          <button @click="goToFirst" :disabled="position === 0 || loading" aria-label="First sentence">⇤</button>
          <button @click="goToPrevious" :disabled="position === 0 || loading" aria-label="Previous sentence">←</button>
          <span class="alph-treebank-page__pager-info">{{ pagerInfo }}</span>
          <button @click="goToNext" :disabled="position >= total - 1 || loading" aria-label="Next sentence">→</button>
          <button @click="goToLast" :disabled="position >= total - 1 || loading" aria-label="Last sentence">⇥</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alph-treebank-page__loading">
      <div class="alph-treebank-page__spinner"></div>
      <p>Loading…</p>
    </div>

    <div v-else-if="error" class="alph-treebank-page__error">
      <p>{{ error }}</p>
      <button class="alph-treebank-page__retry" @click="loadWork(props.docId, props.sentenceId)">Retry</button>
    </div>

    <div v-else-if="treeResource" class="alph-treebank-page__content">
      <div v-if="availablePos.length" class="alph-treebank-page__pos-filter">
        <span class="alph-treebank-page__pos-label">POS filter:</span>
        <button
          v-for="pos in availablePos"
          :key="pos"
          class="alph-treebank-page__pos-chip"
          :class="{ 'alph-treebank-page__pos-chip--active': selectedPos.includes(pos) }"
          @click="togglePosFilter(pos)"
        >
          {{ pos }}
        </button>
        <button
          v-if="selectedPos.length > 0"
          class="alph-treebank-page__pos-clear"
          @click="selectedPos = []"
        >
          Clear
        </button>
      </div>

      <div class="alph-treebank-page__tree-wrapper">
        <DependencyTree
          :nodes="treeResource.nodes"
          :edges="treeResource.edges"
          :highlight-ids="highlightIds"
          :selected-pos="selectedPos"
          @select="handleTokenSelect"
        />
      </div>

      <div class="alph-treebank-page__text">
        <p>{{ treeResource.text }}</p>
      </div>

      <div class="alph-treebank-page__footer">
        <span class="alph-treebank-page__meta">{{ footerMeta }}</span>
        <span v-if="dataSource" class="alph-treebank-page__source-badge">{{ SOURCE_LABELS[dataSource] || dataSource }}</span>
      </div>
    </div>

    <div v-else class="alph-treebank-page__empty">
      <p>Select a text to start browsing</p>
    </div>
  </div>
</template>

<style scoped>
.alph-treebank-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-container-lowest);
  color: var(--on-surface);
  font-family: 'Inter', sans-serif;
}

.alph-treebank-page__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--surface-container);
  border-bottom: 1px solid var(--outline-variant);
}

.alph-treebank-page__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--on-surface);
}

.alph-treebank-page__controls {
  display: flex;
  gap: 16px;
  align-items: center;
}

.alph-treebank-page__pager {
  display: flex;
  gap: 8px;
  align-items: center;
}

.alph-treebank-page__pager button {
  padding: 6px 12px;
  background: var(--surface-container-high);
  border: 1px solid var(--outline-variant);
  border-radius: 6px;
  color: var(--on-surface);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s ease;
}

.alph-treebank-page__pager button:hover:not(:disabled) {
  background: var(--primary);
  color: var(--on-primary);
  border-color: var(--primary);
}

.alph-treebank-page__pager button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.alph-treebank-page__pager-info {
  min-width: 80px;
  text-align: center;
  font-size: 13px;
  color: var(--on-surface-variant);
  font-variant-numeric: tabular-nums;
}

.alph-treebank-page__loading,
.alph-treebank-page__error,
.alph-treebank-page__empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  flex: 1;
  padding: 48px;
  color: var(--on-surface-variant);
}

.alph-treebank-page__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--outline-variant);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.alph-treebank-page__error {
  color: var(--error);
  gap: 12px;
}

.alph-treebank-page__retry {
  padding: 6px 16px;
  background: var(--surface-container-high);
  border: 1px solid var(--outline-variant);
  border-radius: 6px;
  color: var(--on-surface);
  cursor: pointer;
  font-size: 13px;
}

.alph-treebank-page__retry:hover {
  background: var(--primary);
  color: var(--on-primary);
  border-color: var(--primary);
}

.alph-treebank-page__content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: auto;
  padding: 24px;
  gap: 24px;
}

.alph-treebank-page__pos-filter {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  padding: 12px 16px;
  background: var(--surface-container);
  border-radius: 8px;
}

.alph-treebank-page__pos-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.alph-treebank-page__pos-chip {
  padding: 4px 12px;
  background: var(--surface-container-high);
  border: 1px solid var(--outline-variant);
  border-radius: 16px;
  color: var(--on-surface-variant);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s ease;
}

.alph-treebank-page__pos-chip:hover {
  background: var(--surface-container-highest);
  border-color: var(--outline);
}

.alph-treebank-page__pos-chip--active {
  background: var(--primary);
  color: var(--on-primary);
  border-color: var(--primary);
}

.alph-treebank-page__pos-clear {
  padding: 4px 12px;
  background: transparent;
  border: none;
  color: var(--primary);
  font-size: 11px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.alph-treebank-page__tree-wrapper {
  display: flex;
  justify-content: center;
  padding: 24px;
  background: var(--surface);
  border: 1px solid var(--outline-variant);
  border-radius: 12px;
  overflow-x: auto;
}

.alph-treebank-page__text {
  padding: 16px 24px;
  background: var(--surface-container);
  border-radius: 8px;
  border-left: 3px solid var(--primary);
}

.alph-treebank-page__text p {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--on-surface);
  font-family: 'Lato', 'Noto Serif', serif;
}

.alph-treebank-page__footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--outline-variant);
}

.alph-treebank-page__meta {
  font-size: 11px;
  color: var(--on-surface-variant);
  letter-spacing: 0.03em;
}

.alph-treebank-page__source-badge {
  padding: 2px 8px;
  background: var(--surface-container-high);
  border: 1px solid var(--outline-variant);
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--on-surface-variant);
}
</style>
