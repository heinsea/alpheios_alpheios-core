<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import DependencyTree from '../primitives/DependencyTree.vue'
import { loadTreebankData, getEmbeddedWorks } from '../lib/treebank-loader.js'
import { findTreebankSentence, buildTreebankResource } from '../lib/treebank-data.js'

const props = defineProps({
  docId: { type: String, default: '' },
  sentenceId: { type: String, default: '' },
  wordIds: { type: Array, default: () => [] },
  mode: { type: String, default: 'auto' }
})

const emit = defineEmits(['navigate', 'token-select'])

const sentences = ref([])
const currentIndex = ref(0)
const loading = ref(false)
const error = ref(null)
const highlightIds = ref([])
const selectedPos = ref([])

// 当前句子
const currentSentence = computed(() => sentences.value[currentIndex.value] || null)

// 构建渲染资源
const treeResource = computed(() => {
  if (!currentSentence.value) return null
  return buildTreebankResource(currentSentence.value, { wordIds: highlightIds.value })
})

// 分页信息
const pagerInfo = computed(() => {
  if (!currentSentence.value) return ''
  const { index = 1, total = 1 } = currentSentence.value
  return `${index} / ${total}`
})

// 作品信息
const workTitle = computed(() => {
  if (!currentSentence.value) return ''
  const docId = currentSentence.value.docId || ''
  // 简单的标题提取，实际应该从catalog映射
  if (docId.includes('phi0690.phi003')) return 'Vergil Aeneid'
  if (docId.includes('tlg0012.tlg001')) return 'Homer Iliad'
  return docId
})

// 底部元信息
const footerMeta = computed(() => {
  if (!currentSentence.value) return ''
  const cite = currentSentence.value.cite || ''
  const provider = currentSentence.value.provider || 'Perseus AGLDT'
  const tokenCount = Math.max(0, (currentSentence.value.nodes?.length || 1) - 1)
  return `${cite} · ${tokenCount} tokens · ${provider}`
})

// 加载数据
async function loadData (docId, sentenceId) {
  if (!docId) return

  loading.value = true
  error.value = null

  try {
    const data = await loadTreebankData({ docId, mode: props.mode })
    if (!data) {
      error.value = `Failed to load: ${docId}`
      sentences.value = []
      return
    }

    sentences.value = Array.isArray(data) ? data : [data]

    // 定位到指定句子
    if (sentenceId) {
      const index = sentences.value.findIndex(s => s.id === sentenceId)
      currentIndex.value = index >= 0 ? index : 0
    } else {
      currentIndex.value = 0
    }
  } catch (err) {
    console.error('[TreebankPage] Load error:', err)
    error.value = `加载失败: ${err.message}`
    sentences.value = []
  } finally {
    loading.value = false
  }
}

// 导航
function goToPrevious () {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

function goToNext () {
  if (currentIndex.value < sentences.value.length - 1) {
    currentIndex.value++
  }
}

function goToFirst () {
  currentIndex.value = 0
}

function goToLast () {
  currentIndex.value = sentences.value.length - 1
}

// Token选择
function handleTokenSelect (tokenId) {
  if (highlightIds.value.includes(tokenId)) {
    highlightIds.value = []
  } else {
    highlightIds.value = [tokenId]
  }
  emit('token-select', tokenId)
}

// 词性过滤
function togglePosFilter (pos) {
  const index = selectedPos.value.indexOf(pos)
  if (index >= 0) {
    selectedPos.value.splice(index, 1)
  } else {
    selectedPos.value.push(pos)
  }
}

// 获取所有词性
const availablePos = computed(() => {
  if (!currentSentence.value?.nodes) return []
  const posSet = new Set()
  currentSentence.value.nodes.forEach(node => {
    if (node.pos && node.id > 0) posSet.add(node.pos)
  })
  return Array.from(posSet).sort()
})

// 监听props变化
watch(() => [props.docId, props.sentenceId], ([docId, sentenceId]) => {
  if (docId) {
    loadData(docId, sentenceId)
  }
}, { immediate: true })

watch(() => props.wordIds, (wordIds) => {
  highlightIds.value = wordIds || []
}, { immediate: true })

onMounted(() => {
  // 初始加载
  if (props.docId) {
    loadData(props.docId, props.sentenceId)
  }
})
</script>

<template>
  <div class="alph-treebank-page">
    <div class="alph-treebank-page__header">
      <h2 class="alph-treebank-page__title">{{ workTitle }}</h2>
      <div class="alph-treebank-page__controls">
        <div class="alph-treebank-page__pager">
          <button @click="goToFirst" :disabled="currentIndex === 0 || loading">⇤</button>
          <button @click="goToPrevious" :disabled="currentIndex === 0 || loading">←</button>
          <span class="alph-treebank-page__pager-info">{{ pagerInfo }}</span>
          <button @click="goToNext" :disabled="currentIndex >= sentences.length - 1 || loading">→</button>
          <button @click="goToLast" :disabled="currentIndex >= sentences.length - 1 || loading">⇥</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alph-treebank-page__loading">
      <div class="alph-treebank-page__spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="error" class="alph-treebank-page__error">
      <p>{{ error }}</p>
    </div>

    <div v-else-if="treeResource" class="alph-treebank-page__content">
      <!-- 词性过滤器 -->
      <div v-if="availablePos.length" class="alph-treebank-page__pos-filter">
        <span class="alph-treebank-page__pos-label">词性筛选：</span>
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
          清除
        </button>
      </div>

      <!-- 依存树渲染 -->
      <div class="alph-treebank-page__tree-wrapper">
        <DependencyTree
          :nodes="treeResource.nodes"
          :edges="treeResource.edges"
          :highlight-ids="highlightIds"
          :selected-pos="selectedPos"
          @select="handleTokenSelect"
        />
      </div>

      <!-- 句子文本 -->
      <div class="alph-treebank-page__text">
        <p>{{ treeResource.text }}</p>
      </div>

      <!-- 底部元信息 -->
      <div class="alph-treebank-page__footer">
        <span class="alph-treebank-page__meta">{{ footerMeta }}</span>
      </div>
    </div>

    <div v-else class="alph-treebank-page__empty">
      <p>选择一个文本开始浏览</p>
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
  padding: 12px 0;
  border-top: 1px solid var(--outline-variant);
  text-align: center;
}

.alph-treebank-page__meta {
  font-size: 11px;
  color: var(--on-surface-variant);
  letter-spacing: 0.03em;
}
</style>
