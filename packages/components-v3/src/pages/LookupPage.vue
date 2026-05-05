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

const props = defineProps({
  /** Lookup payload from live data or an explicit empty state. */
  data: { type: Object, required: true }
})

const morphExpanded = ref(props.data.morph?.map(m => !!m.expanded) ?? [])
function toggleMorph (i) { morphExpanded.value[i] = !morphExpanded.value[i] }
const showShortDefs = ref(true)
function toggleShortDefs () { showShortDefs.value = !showShortDefs.value }

const recognizedPos = computed(() => props.data.recognized)
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
      <ol class="alph-lookup__defs">
        <li v-for="(def, i) in data.definitions" :key="i" class="alph-lookup__def">
          <span class="alph-lookup__def-num">{{ i + 1 }}.</span>
          <span class="alph-lookup__def-text" v-html="def" />
        </li>
      </ol>
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
  display: flex; gap: 10px;
  padding: 8px 0;
  border-top: 1px solid var(--divider);
}
.alph-lookup__def:first-child { border-top: 0; }
.alph-lookup__def-num {
  font-size: 11px; color: var(--on-surface-variant);
  opacity: 0.6;
  width: 18px; flex-shrink: 0;
  font-weight: 500;
}
.alph-lookup__def-text {
  font-size: 12px; line-height: 17px;
  color: var(--on-surface);
}
.alph-lookup__def-text :deep(em) { font-style: italic; color: var(--on-surface-variant); }

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
