<script setup>
/**
 * LookupPage — DESIGN §7.1 + mockup drawer-lookup.html.
 *
 * Renders the scrollable body of the Drawer when `page === 'lookup'`. Search
 * input and footer actions live in the parent App.vue (they vary per page,
 * so Drawer slots are filled at the App level).
 *
 * Sections (top to bottom):
 *   1. Word headline (lemma + lang chip)
 *   2. POS tag row (with optional "recognized" green tag)
 *   3. Morphology h-section + per-lemma elevated cards
 *   4. Short definitions h-section + numbered list
 *   5. Principal parts data card
 *   6. Providers list
 *
 * "Visual references" / bento grid is intentionally omitted (DESIGN §10
 * marks bento images as decorative, out of scope for the v3 functional UI).
 */

import { ref, computed } from 'vue'
import Button from '../primitives/Button.vue'
import Chip from '../primitives/Chip.vue'
import Icon from '../primitives/Icon.vue'
import { definitionSenseItems } from './lookup-definitions.js'

const props = defineProps({
  /** Lookup payload from live data or an explicit empty state. */
  data: { type: Object, required: true }
})

const morphExpanded = ref(props.data.morph?.map(m => !!m.expanded) ?? [])
function toggleMorph (i) { morphExpanded.value[i] = !morphExpanded.value[i] }
const showShortDefs = ref(true)
function toggleShortDefs () { showShortDefs.value = !showShortDefs.value }

const recognizedPos = computed(() => props.data.recognized)
const definitionSenses = computed(() => definitionSenseItems(props.data.definitions))
</script>

<template>
  <div class="alph-lookup">

    <!-- ─── Word headline ─── -->
    <div class="alph-lookup__word">
      <div class="alph-lookup__headline">
        <h2 class="lang-classical">{{ data.lemma }}</h2>
        <Chip variant="filled">{{ data.lang }}</Chip>
      </div>
      <div class="alph-lookup__pos">
        <Chip v-for="(p, i) in data.pos" :key="i" variant="default">
          {{ p.label }}
        </Chip>
        <Chip v-if="recognizedPos" variant="tertiary">
          <Icon name="check" :size="12" />
          recognized
        </Chip>
      </div>
    </div>

    <hr class="alph-lookup__divider" />

    <!-- ─── Morphology ─── -->
    <header class="alph-lookup__h-section">
      <span>Morphology</span>
      <Button variant="icon" aria-label="Expand all">
        <Icon name="unfold_more" :size="14" />
      </Button>
    </header>
    <div class="alph-lookup__pad">
      <article
        v-for="(m, i) in data.morph"
        :key="m.lemma"
        class="alph-lookup__morph"
      >
        <header class="alph-lookup__morph-head">
          <div class="alph-lookup__morph-head-l">
            <strong class="lang-classical">{{ m.lemma }}</strong>
            <span class="alph-lookup__morph-head-meta">{{ m.meta }}</span>
          </div>
          <Button variant="icon" :aria-label="morphExpanded[i] ? 'Collapse' : 'Expand'" @click="toggleMorph(i)">
            <Icon :name="morphExpanded[i] ? 'expand_less' : 'expand_more'" :size="16" />
          </Button>
        </header>
        <div v-if="morphExpanded[i] && m.rows?.length" class="alph-lookup__morph-rows">
          <div v-for="row in m.rows" :key="row.label" class="alph-lookup__morph-row">
            <span class="alph-lookup__morph-label">{{ row.label }}</span>
            <span class="alph-lookup__morph-value" :class="{ 'lang-classical': row.lang }">{{ row.value }}</span>
          </div>
        </div>
      </article>
    </div>

    <!-- ─── Short definitions ─── -->
    <header class="alph-lookup__h-section">
      <span>Short definitions</span>
      <Button variant="icon" aria-label="Show full" @click="toggleShortDefs">
        <Icon name="read_more" :size="14" />
      </Button>
    </header>
    <div v-if="showShortDefs" class="alph-lookup__pad">
      <div class="alph-lookup__defs">
        <article v-for="(def, i) in definitionSenses" :key="i" class="alph-lookup__def">
          <span class="alph-lookup__def-num">{{ def.label }}</span>
          <div class="alph-lookup__def-body">
            <span class="alph-lookup__def-label">Sense</span>
            <div v-if="def.blocks" class="alph-lookup__def-text alph-lookup__def-rich">
              <p
                v-for="(block, blockIndex) in def.blocks"
                :key="blockIndex"
                class="alph-lookup__dict-block"
                :class="{
                  'alph-lookup__dict-block--major': block.kind === 'major',
                  'alph-lookup__dict-block--sub': block.kind === 'sub',
                  'alph-lookup__dict-source': block.kind === 'source'
                }"
              >
                <span
                  v-if="block.heading"
                  :class="block.kind === 'sub' ? 'alph-lookup__dict-subheading' : 'alph-lookup__dict-heading'"
                >{{ block.heading }}</span>
                <span v-if="block.html" v-html="block.html" />
              </p>
            </div>
            <div v-else class="alph-lookup__def-text" v-html="def.html" />
          </div>
        </article>
      </div>
    </div>

    <!-- ─── Principal parts ─── -->
    <header v-if="data.principalParts?.length" class="alph-lookup__h-section">
      <span>Principal parts</span>
    </header>
    <div v-if="data.principalParts?.length" class="alph-lookup__data-card">
      <div v-for="row in data.principalParts" :key="row.label" class="alph-lookup__morph-row">
        <span class="alph-lookup__morph-label">{{ row.label }}</span>
        <span class="alph-lookup__morph-value" :class="{ 'lang-classical': row.lang }">{{ row.value }}</span>
      </div>
    </div>

    <!-- ─── Providers ─── -->
    <header v-if="data.providers?.length" class="alph-lookup__h-section">
      <span>Providers</span>
    </header>
    <div v-if="data.providers?.length" class="alph-lookup__data-card alph-lookup__data-card--small">
      <div v-for="p in data.providers" :key="p.name" class="alph-lookup__provider-row">
        <span class="alph-lookup__provider-name">{{ p.name }}</span>
        <span class="alph-lookup__provider-scope">{{ p.scope }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alph-lookup { padding-top: 0; }

/* word section */
.alph-lookup__word { padding: 0 12px 8px; }
.alph-lookup__headline {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px;
}
.alph-lookup__headline h2 {
  margin: 0;
  font-size: 22px; font-weight: 600; letter-spacing: -0.02em;
  color: var(--on-surface);
}
.alph-lookup__pos {
  display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; align-items: center;
}
/* override default chip rounded corners — mockup uses sharp 2px tags here */
.alph-lookup__pos :deep(.alph-chip--default) {
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  letter-spacing: 0.05em;
}

.alph-lookup__divider {
  margin: 8px 12px;
  height: 1px; border: 0;
  background: var(--divider);
}

/* h-section header */
.alph-lookup__h-section {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px 6px;
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--on-surface-variant);
}
.alph-lookup__h-section :deep(.alph-btn--icon) { width: 24px; height: 24px; }

.alph-lookup__pad { padding: 0 12px; }

/* morph cards */
.alph-lookup__morph {
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.alph-lookup__morph + .alph-lookup__morph { margin-top: 6px; }

.alph-lookup__morph-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  background: var(--surface-container-low);
}
.alph-lookup__morph-head-l { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.alph-lookup__morph-head-l strong { font-size: 13px; font-weight: 600; color: var(--on-surface); }
.alph-lookup__morph-head-meta { color: var(--on-surface-variant); font-size: 11px; }
.alph-lookup__morph-head :deep(.alph-btn--icon) { width: 24px; height: 24px; }

.alph-lookup__morph-rows { padding: 4px 12px 8px; }
.alph-lookup__morph-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0;
  border-top: 1px solid var(--divider);
  font-size: 11px;
  gap: 8px;
}
.alph-lookup__morph-row:first-child { border-top: 0; }
.alph-lookup__morph-label {
  color: var(--on-surface-variant);
  font-size: 10px; font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase;
  flex-shrink: 0;
}
.alph-lookup__morph-value {
  font-size: 11px; font-weight: 500;
  color: var(--on-surface);
  text-align: right;
}

/* definitions */
.alph-lookup__defs { margin: 0; padding: 0; list-style: none; }
.alph-lookup__def {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 8px;
  padding: 10px 10px 10px 8px;
  border: 1px solid var(--outline-variant);
  border-left: 3px solid var(--on-surface);
  border-radius: var(--radius-lg);
  background: var(--surface-container-lowest);
}
.alph-lookup__def + .alph-lookup__def { margin-top: 7px; }
.alph-lookup__def-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-md);
  background: var(--surface-container);
  color: var(--on-surface);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.alph-lookup__def-body { min-width: 0; }
.alph-lookup__def-label {
  display: inline-block;
  margin-bottom: 3px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--on-surface-variant);
}
.alph-lookup__def-text {
  font-size: 12px; line-height: 18px;
  color: var(--on-surface);
}
.alph-lookup__def-text :deep(em) { font-style: italic; color: var(--on-surface-variant); }
.alph-lookup__def-text :deep(br) { content: ""; display: block; margin-top: 6px; }
.alph-lookup__def-text :deep(p) { margin: 0 0 6px; }
.alph-lookup__def-text :deep(p:last-child) { margin-bottom: 0; }
.alph-lookup__def-text :deep(ol),
.alph-lookup__def-text :deep(ul) {
  margin: 6px 0 0;
  padding-left: 18px;
}
.alph-lookup__def-text :deep(li + li) { margin-top: 3px; }
.alph-lookup__def-rich {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 2px;
}
.alph-lookup__dict-block {
  margin: 0;
  padding: 0 0 0 10px;
  border-left: 2px solid var(--divider);
}
.alph-lookup__dict-block--major {
  margin-top: 4px;
  padding: 10px 10px 10px 12px;
  border-left-color: var(--on-surface);
  background: var(--surface-container-low);
  border-radius: var(--radius-md);
}
.alph-lookup__dict-block--sub {
  padding: 2px 0 2px 12px;
  border-left-color: var(--outline-variant);
}
.alph-lookup__dict-heading {
  display: block;
  margin-bottom: 5px;
  color: var(--on-surface);
  font-weight: 700;
}
.alph-lookup__dict-subheading {
  display: inline-block;
  margin-right: 4px;
  color: var(--on-surface);
  font-weight: 700;
}
.alph-lookup__def-text :deep(.alph-lookup__dict-quote) {
  color: var(--on-surface-variant);
  font-weight: 600;
  font-style: italic;
}
.alph-lookup__dict-source {
  margin: 4px 0 0;
  padding: 9px 10px;
  border-left: 0;
  border-radius: var(--radius-md);
  background: var(--surface-container);
  color: var(--on-surface-variant);
  font-size: 10px;
  line-height: 15px;
  font-weight: 600;
}

/* data-card */
.alph-lookup__data-card {
  margin: 0 12px 12px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: var(--radius-lg);
  padding: 10px 12px;
}
[data-theme="dark"] .alph-lookup__data-card { background: rgba(255, 255, 255, 0.04); }
.alph-lookup__data-card--small { font-size: 10px; }

.alph-lookup__provider-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 0;
  font-size: 11px;
}
.alph-lookup__provider-row + .alph-lookup__provider-row { border-top: 1px solid var(--divider); }
.alph-lookup__provider-name { color: var(--on-surface-variant); }
.alph-lookup__provider-scope {
  color: var(--on-surface);
  font-weight: 400;
  font-size: 10px;
}
</style>
