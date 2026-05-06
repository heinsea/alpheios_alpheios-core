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
 *   3. Definitions h-section + numbered list
 *   4. Principal parts data card
 *   5. Providers list
 *
 * "Visual references" / bento grid is intentionally omitted (DESIGN §10
 * marks bento images as decorative, out of scope for the v3 functional UI).
 */

import { ref, computed, watch } from 'vue'
import Chip from '../primitives/Chip.vue'
import Icon from '../primitives/Icon.vue'
import { definitionSenseItems } from './lookup-definitions.js'

const props = defineProps({
  /** Lookup payload from live data or an explicit empty state. */
  data: { type: Object, required: true }
})

const definitionMode = ref('short')
function setDefinitionMode (mode) { definitionMode.value = mode }
watch(
  () => `${props.data.lemma || ''}|${(props.data.shortDefinitions || []).length}|${(props.data.fullDefinitions || []).length}`,
  () => { definitionMode.value = 'short' }
)

const recognizedPos = computed(() => props.data.recognized && (props.data.pos || []).length > 0)
const shortDefinitionSenses = computed(() => definitionSenseItems(props.data.shortDefinitions || props.data.definitions || []))
const fullDefinitionSenses = computed(() => definitionSenseItems(props.data.fullDefinitions || []))
const definitionSenses = computed(() => (
  definitionMode.value === 'full' ? fullDefinitionSenses.value : shortDefinitionSenses.value
))
const hasShortDefinitions = computed(() => shortDefinitionSenses.value.length > 0)
const hasFullDefinitions = computed(() => fullDefinitionSenses.value.length > 0)
const definitionTitle = computed(() => definitionMode.value === 'full' ? 'Full definitions' : 'Short definitions')
const emptyDefinitionText = computed(() => (
  definitionMode.value === 'full'
    ? 'No full definition is available for this lookup.'
    : 'No short definition is available for this lookup.'
))
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

    <!-- ─── Definitions ─── -->
    <header class="alph-lookup__h-section">
      <span>{{ definitionTitle }}</span>
      <div class="alph-lookup__definition-toggle" role="group" aria-label="Definition detail">
        <button
          type="button"
          class="alph-lookup__definition-toggle-btn"
          :class="{ 'alph-lookup__definition-toggle-btn--active': definitionMode === 'short' }"
          :aria-pressed="definitionMode === 'short'"
          :disabled="!hasShortDefinitions"
          @click="setDefinitionMode('short')"
        >
          Short
        </button>
        <button
          type="button"
          class="alph-lookup__definition-toggle-btn"
          :class="{ 'alph-lookup__definition-toggle-btn--active': definitionMode === 'full' }"
          :aria-pressed="definitionMode === 'full'"
          :disabled="!hasFullDefinitions"
          @click="setDefinitionMode('full')"
        >
          Full
        </button>
      </div>
    </header>
    <div class="alph-lookup__pad">
      <div class="alph-lookup__defs">
        <article v-for="(def, i) in definitionSenses" :key="i" class="alph-lookup__def">
          <span class="alph-lookup__def-num">{{ def.label }}</span>
          <div class="alph-lookup__def-body">
            <!-- ── Entry header: headword : (frequency) ── -->
            <div v-if="def.headword || def.frequency" class="alph-lookup__def-entry-head">
              <span class="alph-lookup__def-headword lang-classical">{{ def.headword }}</span><span
                v-if="def.headword" class="alph-lookup__def-entry-sep"> :</span><span
                v-if="def.frequency" class="alph-lookup__def-freq"> ({{ def.frequency }})</span>
            </div>
            <!-- ── Morphology: e.g. "neuter noun; 2nd declension" ── -->
            <p v-if="def.morphology" class="alph-lookup__def-morph">{{ def.morphology }}</p>
            <!-- ── Definition text ── -->
            <div v-if="def.blocks" class="alph-lookup__def-text alph-lookup__def-rich">
              <p
                v-for="(block, blockIndex) in def.blocks"
                :key="blockIndex"
                class="alph-lookup__dict-block"
                :class="[
                  {
                    'alph-lookup__dict-block--roman': block.kind === 'roman',
                    'alph-lookup__dict-block--major': block.kind === 'major',
                    'alph-lookup__dict-block--sub': block.kind === 'sub',
                    'alph-lookup__dict-source': block.kind === 'source'
                  },
                  `alph-lookup__dict-block--depth-${block.depth || 0}`
                ]"
              >
                <span
                  v-if="block.heading"
                  :class="(block.kind === 'roman' || block.kind === 'major') ? 'alph-lookup__dict-heading' : 'alph-lookup__dict-subheading'"
                >{{ block.heading }}</span>
                <span v-if="block.html" v-html="block.html" />
              </p>
            </div>
            <div v-else class="alph-lookup__def-text">
              <span v-if="def.lemma" class="alph-lookup__def-lemma-pfx lang-classical">{{ def.lemma }}: </span><strong
                v-if="def.html" class="alph-lookup__def-bold" v-html="def.html" />
            </div>
            <!-- ── Inflection: form line + number/case rows ── -->
            <div v-if="def.form || (def.inflections && def.inflections.length)" class="alph-lookup__def-inflect">
              <span v-if="def.form" class="alph-lookup__def-form lang-classical">{{ def.form }}</span>
              <div v-for="(row, ri) in def.inflections" :key="ri" class="alph-lookup__def-infl-row">
                <span v-if="row.label" class="alph-lookup__def-infl-cat">{{ row.label }}.</span>
                <span v-for="(v, vi) in row.values" :key="vi" class="alph-lookup__def-infl-val">{{ v }}.</span>
              </div>
            </div>
          </div>
        </article>
        <p v-if="!definitionSenses.length" class="alph-lookup__def-empty">
          {{ emptyDefinitionText }}
        </p>
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
.alph-lookup__definition-toggle {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface-container-lowest);
}
.alph-lookup__definition-toggle-btn {
  height: 24px;
  min-width: 48px;
  padding: 0 8px;
  border: 0;
  border-left: 1px solid var(--outline-variant);
  background: transparent;
  color: var(--on-surface-variant);
  cursor: pointer;
  font: inherit;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.alph-lookup__definition-toggle-btn:first-child { border-left: 0; }
.alph-lookup__definition-toggle-btn--active {
  background: var(--primary);
  color: var(--on-primary);
}
.alph-lookup__definition-toggle-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.alph-lookup__pad { padding: 0 12px; }

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
.alph-lookup__def-empty {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-lg);
  background: var(--surface-container-lowest);
  color: var(--on-surface-variant);
  font-size: 12px;
  line-height: 18px;
}
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
/* entry header: headword : (freq) [provider] */
.alph-lookup__def-entry-head {
  margin-bottom: 3px;
  font-size: 11px;
  line-height: 16px;
  color: var(--on-surface);
}
.alph-lookup__def-headword {
  font-weight: 600;
}
.alph-lookup__def-entry-sep,
.alph-lookup__def-freq {
  color: var(--on-surface-variant);
}
.alph-lookup__def-prov {
  color: var(--on-surface-variant);
  font-size: 10px;
}
.alph-lookup__def-text {
  font-size: 12px; line-height: 18px;
  color: var(--on-surface);
}
.alph-lookup__def-morph {
  margin: 2px 0 4px;
  color: var(--on-surface-variant);
  font-size: 11px;
  line-height: 16px;
}
/* lemma prefix + bold short def */
.alph-lookup__def-lemma-pfx {
  color: var(--on-surface-variant);
  font-size: 12px;
}
.alph-lookup__def-bold {
  font-weight: 700;
  color: var(--on-surface);
}
/* inflection block below definition */
.alph-lookup__def-inflect {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.alph-lookup__def-form {
  font-size: 11px;
  color: var(--on-surface);
  letter-spacing: 0.02em;
}
.alph-lookup__def-infl-row {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: var(--on-surface-variant);
}
.alph-lookup__def-infl-cat {
  font-style: italic;
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
/* Roman numeral blocks — top-level major sections (I, II, III) */
.alph-lookup__dict-block--roman {
  margin-top: 6px;
  padding: 8px 10px 8px 12px;
  border-left: 3px solid var(--primary, #5b4fcf);
  background: var(--surface-container-low);
  border-radius: var(--radius-md);
}
/* Capital-letter sub-sections (A, B, C) */
.alph-lookup__dict-block--major {
  margin-top: 4px;
  padding: 6px 10px 6px 10px;
  border-left: 2px solid var(--outline);
  background: transparent;
  border-radius: var(--radius-sm);
}
.alph-lookup__dict-block--sub {
  padding: 4px 0 4px 12px;
  border-left-color: var(--outline-variant);
}
/* Per-depth left indentation */
.alph-lookup__dict-block--depth-0 { margin-left: 0; }
.alph-lookup__dict-block--depth-1 { margin-left: 12px; }
.alph-lookup__dict-block--depth-2 { margin-left: 24px; }
.alph-lookup__dict-block--depth-3 { margin-left: 36px; }
.alph-lookup__dict-block--depth-4 { margin-left: 48px; }
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
