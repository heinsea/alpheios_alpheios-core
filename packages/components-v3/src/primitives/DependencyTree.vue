<script setup>
import { computed } from 'vue'
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

function selectToken (id) {
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
  <svg
    class="alph-dependency-tree"
    :width="layout.width"
    :height="layout.height"
    :viewBox="`0 0 ${layout.width} ${layout.height}`"
    role="img"
    :aria-label="ariaLabel"
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
</template>

<style scoped>
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
