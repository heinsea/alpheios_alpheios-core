<script setup>
import { computed, ref } from 'vue'
import { layoutDependencyTree } from '../lib/treebank-layout.js'

const props = defineProps({
  nodes: { type: Array, required: true },
  edges: { type: Array, default: () => [] },
  highlightId: { type: [Number, String], default: null },
  highlightIds: { type: Array, default: null },
  selectedPos: { type: Array, default: () => [] }
})

const emit = defineEmits(['select'])

const layout = computed(() => layoutDependencyTree(
  { nodes: props.nodes, edges: props.edges },
  { highlightId: props.highlightId, highlightIds: props.highlightIds }
))

const ariaLabel = computed(() => `Dependency tree with ${layout.value.tokens.length} tokens`)
const selectedPosSet = computed(() => new Set(props.selectedPos))
const hasActiveHighlight = computed(() => {
  if (Array.isArray(props.highlightIds)) return props.highlightIds.length > 0
  return props.highlightId !== null
})

// Zoom/pan state
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const lastMouseX = ref(0)
const lastMouseY = ref(0)
const dragStartX = ref(0)
const dragStartY = ref(0)
const hasDragged = ref(false)

function handleWheel(event) {
  event.preventDefault()
  const delta = -event.deltaY * 0.001
  const newZoom = Math.min(Math.max(0.5, zoom.value + delta), 3)

  // Zoom toward mouse position
  const rect = event.currentTarget.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  const factor = newZoom / zoom.value
  panX.value = mouseX - (mouseX - panX.value) * factor
  panY.value = mouseY - (mouseY - panY.value) * factor

  zoom.value = newZoom
}

function handleMouseDown(event) {
  if (event.button === 0) { // Left button
    isPanning.value = true
    lastMouseX.value = event.clientX
    lastMouseY.value = event.clientY
    dragStartX.value = event.clientX
    dragStartY.value = event.clientY
    hasDragged.value = false
    event.preventDefault()
  }
}

function handleMouseMove(event) {
  if (isPanning.value) {
    const dx = event.clientX - lastMouseX.value
    const dy = event.clientY - lastMouseY.value

    // Check if dragged more than 3px (to distinguish from click)
    const totalDrag = Math.abs(event.clientX - dragStartX.value) + Math.abs(event.clientY - dragStartY.value)
    if (totalDrag > 3) {
      hasDragged.value = true
    }

    panX.value += dx
    panY.value += dy
    lastMouseX.value = event.clientX
    lastMouseY.value = event.clientY
  }
}

function handleMouseUp(event) {
  isPanning.value = false

  // If didn't drag much, treat as click and propagate to token
  if (!hasDragged.value) {
    // Let the event propagate naturally to token click handlers
  }
}

function handleDoubleClick(event) {
  // Double click on background to reset zoom/pan
  if (event.target.tagName === 'svg' || event.target.tagName === 'g') {
    resetZoom()
  }
}

function resetZoom() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

// Expose methods for parent
defineExpose({
  zoomIn() { zoom.value = Math.min(3, zoom.value + 0.2) },
  zoomOut() { zoom.value = Math.max(0.5, zoom.value - 0.2) },
  resetZoom
})

function selectToken (id) {
  // Don't select if user was dragging
  if (hasDragged.value) return
  emit('select', id)
}

function isTokenDimmed (token) {
  if (selectedPosSet.value.size) {
    return !selectedPosSet.value.has(token.pos) && !token.focusRole
  }
  return hasActiveHighlight.value && !token.focusRole
}

</script>

<template>
  <div class="alph-dependency-tree-container">
    <svg
      class="alph-dependency-tree"
      :width="layout.width"
      :height="layout.height"
      :viewBox="`0 0 ${layout.width} ${layout.height}`"
      role="img"
      :aria-label="ariaLabel"
      @wheel="handleWheel"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @dblclick="handleDoubleClick"
      :style="{
        cursor: isPanning ? 'grabbing' : 'grab',
        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
        transformOrigin: 'top left'
      }"
    >
    <g class="alph-dependency-tree__arcs">
      <g
        v-for="arc in layout.arcs"
        :key="`${arc.from}-${arc.to}-${arc.relation}`"
        class="alph-dependency-tree__arc"
        :class="{
          'alph-dependency-tree__arc--focused': arc.isFocused,
          'alph-dependency-tree__arc--dimmed': hasActiveHighlight && !arc.isFocused
        }"
      >
        <path
          class="alph-dependency-tree__arc-path"
          :d="arc.pathD"
        />
        <circle
          class="alph-dependency-tree__head-port"
          :cx="arc.headPortX"
          :cy="arc.headPortY"
          :r="arc.isFocused ? 3.2 : 2.5"
        />
        <circle
          class="alph-dependency-tree__dependent-port"
          :cx="arc.dependentPortX"
          :cy="arc.dependentPortY"
          :r="arc.isFocused ? 3.2 : 2.5"
        />
        <rect
          class="alph-dependency-tree__arc-label-bg"
          :x="arc.labelX - (arc.relation.length * 3.2) - 4"
          :y="arc.labelY - 8"
          :width="arc.relation.length * 6.4 + 8"
          height="11"
          rx="3"
        />
        <text class="alph-dependency-tree__arc-label" :x="arc.labelX" :y="arc.labelY" text-anchor="middle">
          {{ arc.relation }}
        </text>
      </g>
    </g>

    <g class="alph-dependency-tree__roots">
      <g v-for="root in layout.rootMarks" :key="`root-${root.tokenId}`" class="alph-dependency-tree__root">
        <line
          class="alph-dependency-tree__root-line"
          :x1="root.x"
          :x2="root.x"
          :y1="layout.baselineY - 18"
          :y2="layout.baselineY - 6"
        />
        <text
          class="alph-dependency-tree__root-label"
          :x="root.x"
          :y="layout.baselineY - 22"
          text-anchor="middle"
        >
          {{ root.relation }}
        </text>
      </g>
    </g>

    <g class="alph-dependency-tree__tokens">
      <g
        v-for="token in layout.tokens"
        :key="token.id"
        class="alph-dependency-tree__token"
        :class="{
          'alph-dependency-tree__token--root': token.isRoot,
          'alph-dependency-tree__token--highlight': token.isHighlighted,
          'alph-dependency-tree__token--self': token.focusRole === 'self',
          'alph-dependency-tree__token--head': token.focusRole === 'head',
          'alph-dependency-tree__token--dependent': token.focusRole === 'dependent',
          'alph-dependency-tree__token--pos-selected': selectedPosSet.has(token.pos),
          'alph-dependency-tree__token--dimmed': isTokenDimmed(token)
        }"
        tabindex="0"
        role="button"
        :aria-label="`${token.form}, ${token.label}`"
        @click="selectToken(token.id)"
        @keydown.enter="selectToken(token.id)"
        @keydown.space.prevent="selectToken(token.id)"
      >
        <text
          class="alph-dependency-tree__form"
          :x="token.cx"
          :y="layout.baselineY"
          text-anchor="middle"
          :font-weight="token.formWeight"
        >
          {{ token.form }}
        </text>
        <text
          class="alph-dependency-tree__label"
          :x="token.cx"
          :y="layout.baselineY + 16"
          text-anchor="middle"
        >
          {{ token.labelLines[0] || token.label }}
        </text>
        <text
          v-if="token.labelLines[1]"
          class="alph-dependency-tree__morph"
          :x="token.cx"
          :y="layout.baselineY + 28"
          text-anchor="middle"
        >
          {{ token.labelLines[1] }}
        </text>
      </g>
    </g>
  </svg>
  </div>
</template>

<style scoped>
.alph-dependency-tree-container {
  display: inline-block;
}

.alph-dependency-tree {
  --alph-tree-accent: #00695C;
  --alph-tree-pos-accent: #F4511E;
  display: block;
  flex: 0 0 auto;
  font-family: 'Inter', sans-serif;
}

.alph-dependency-tree__arc-path {
  fill: none;
  stroke: var(--outline-variant);
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.alph-dependency-tree__head-port {
  fill: var(--surface-container-lowest);
  stroke: var(--outline-variant);
  stroke-width: 1;
  opacity: 0.42;
}

.alph-dependency-tree__dependent-port {
  fill: var(--outline-variant);
  opacity: 0.36;
}

.alph-dependency-tree__arc-label-bg {
  fill: var(--surface-container-lowest);
  opacity: 0.92;
}

.alph-dependency-tree__arc-label {
  fill: var(--outline);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.alph-dependency-tree__arc--focused .alph-dependency-tree__arc-path {
  stroke: var(--alph-tree-accent);
  stroke-width: 2;
}

.alph-dependency-tree__arc--focused .alph-dependency-tree__arc-label {
  fill: var(--alph-tree-accent);
}

.alph-dependency-tree__arc--focused .alph-dependency-tree__head-port {
  stroke: var(--alph-tree-accent);
  stroke-width: 1.5;
  opacity: 1;
}

.alph-dependency-tree__arc--focused .alph-dependency-tree__dependent-port {
  fill: var(--alph-tree-accent);
  opacity: 1;
}

.alph-dependency-tree__arc--dimmed {
  opacity: 0.34;
}

.alph-dependency-tree__root-line {
  stroke: var(--alph-tree-accent);
  stroke-width: 1.4;
  stroke-linecap: round;
}

.alph-dependency-tree__root-label {
  fill: var(--alph-tree-accent);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.alph-dependency-tree__token {
  cursor: pointer;
  outline: none;
}

.alph-dependency-tree__token--dimmed {
  opacity: 0.42;
}

.alph-dependency-tree__token--pos-selected .alph-dependency-tree__form {
  fill: var(--alph-tree-pos-accent);
  font-weight: 700;
}

.alph-dependency-tree__token--pos-selected .alph-dependency-tree__label {
  fill: var(--alph-tree-pos-accent);
}

.alph-dependency-tree__token:focus .alph-dependency-tree__form {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.alph-dependency-tree__form {
  fill: var(--on-surface);
  font-family: 'Lato', 'Noto Serif', serif;
  font-size: 14px;
}

.alph-dependency-tree__token--self .alph-dependency-tree__form {
  fill: var(--alph-tree-accent);
}

.alph-dependency-tree__token--head .alph-dependency-tree__form {
  text-decoration: underline;
  text-decoration-thickness: 1.2px;
  text-underline-offset: 3px;
}

.alph-dependency-tree__token--dependent .alph-dependency-tree__form {
  font-weight: 700;
}

.alph-dependency-tree__label {
  fill: var(--on-surface-variant);
  font-size: 9px;
  letter-spacing: 0.08em;
}

.alph-dependency-tree__morph {
  fill: var(--on-surface-variant);
  font-size: 8px;
}
</style>
