<script setup>
/**
 * MorphPage — full morphology view.
 *
 * No dedicated mockup — this page is the "expanded" sibling of the
 * morphology section embedded in LookupPage. It displays every morph
 * card fully expanded, plus principal parts and a per-form summary
 * matrix when available.
 *
 * Stage 4 wires `useLookup()` and feeds in disambiguated morph candidates.
 */

import { computed } from 'vue'
import Button from '../primitives/Button.vue'
import Chip from '../primitives/Chip.vue'
import Icon from '../primitives/Icon.vue'

const props = defineProps({
  data: { type: Object, required: true }
})

/* Always-expanded morph rows for the full view. */
const morphCards = computed(() =>
  props.data.morph?.map(m => ({ ...m, expanded: true })) ?? []
)
</script>

<template>
  <div class="alph-morph">

    <header class="alph-morph__head">
      <div class="alph-morph__headline">
        <h2 class="lang-classical">{{ data.lemma }}</h2>
        <Chip variant="filled">{{ data.lang }}</Chip>
      </div>
      <p class="alph-morph__sub">
        Showing every morphological reading for this token. Switch a card
        to see its principal parts &amp; usage.
      </p>
    </header>

    <header class="alph-morph__h-section"><span>Readings · {{ morphCards.length }}</span></header>

    <article v-for="(m, i) in morphCards" :key="i" class="alph-morph__card">
      <header class="alph-morph__card-head">
        <div class="alph-morph__card-head-l">
          <strong class="lang-classical">{{ m.lemma }}</strong>
          <span class="alph-morph__card-meta">{{ m.meta }}</span>
        </div>
        <Chip v-if="i === 0" variant="tertiary">primary</Chip>
      </header>
      <div v-if="m.rows?.length" class="alph-morph__rows">
        <div v-for="row in m.rows" :key="row.label" class="alph-morph__row">
          <span class="alph-morph__label">{{ row.label }}</span>
          <span class="alph-morph__value" :class="{ 'lang-classical': row.lang }">{{ row.value }}</span>
        </div>
      </div>
      <p v-else class="alph-morph__empty">
        No detailed analysis cached. Run a fresh lookup to populate.
      </p>
    </article>

    <header v-if="data.principalParts?.length" class="alph-morph__h-section">
      <span>Principal parts</span>
    </header>
    <div v-if="data.principalParts?.length" class="alph-morph__data-card">
      <div v-for="row in data.principalParts" :key="row.label" class="alph-morph__row">
        <span class="alph-morph__label">{{ row.label }}</span>
        <span class="alph-morph__value" :class="{ 'lang-classical': row.lang }">{{ row.value }}</span>
      </div>
    </div>

    <header v-if="data.providers?.length" class="alph-morph__h-section">
      <span>Source providers</span>
    </header>
    <div v-if="data.providers?.length" class="alph-morph__data-card alph-morph__data-card--small">
      <div v-for="p in data.providers" :key="p.name" class="alph-morph__provider-row">
        <span class="alph-morph__provider-name">{{ p.name }}</span>
        <span class="alph-morph__provider-scope">{{ p.scope }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alph-morph { font-size: 12px; color: var(--on-surface); }

.alph-morph__head { padding: 0 12px 8px; }
.alph-morph__headline {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px;
}
.alph-morph__headline h2 {
  margin: 0;
  font-size: 22px; font-weight: 600; letter-spacing: -0.02em;
  color: var(--on-surface);
}
.alph-morph__sub {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--on-surface-variant);
}

.alph-morph__h-section {
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--on-surface-variant);
  padding: 10px 12px 6px;
}

.alph-morph__card {
  margin: 0 12px;
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.alph-morph__card + .alph-morph__card { margin-top: 6px; }

.alph-morph__card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  background: var(--surface-container-low);
  gap: 8px;
}
.alph-morph__card-head-l {
  display: flex; align-items: baseline; gap: 8px;
  min-width: 0;
}
.alph-morph__card-head-l strong { font-size: 13px; font-weight: 600; color: var(--on-surface); }
.alph-morph__card-meta { color: var(--on-surface-variant); font-size: 11px; }

.alph-morph__rows { padding: 4px 12px 8px; }
.alph-morph__row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0;
  border-top: 1px solid var(--divider);
  font-size: 11px;
  gap: 8px;
}
.alph-morph__row:first-child { border-top: 0; }
.alph-morph__label {
  color: var(--on-surface-variant);
  font-size: 10px; font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase;
  flex-shrink: 0;
}
.alph-morph__value {
  font-size: 11px; font-weight: 500;
  color: var(--on-surface);
  text-align: right;
}

.alph-morph__empty {
  padding: 8px 12px 12px;
  font-size: 11px;
  color: var(--on-surface-variant);
  font-style: italic;
}

.alph-morph__data-card {
  margin: 0 12px 12px;
  background: var(--recessed-bg);
  border-radius: var(--radius-lg);
  padding: 10px 12px;
}
.alph-morph__data-card--small { font-size: 10px; }

.alph-morph__provider-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 0;
  font-size: 11px;
}
.alph-morph__provider-row + .alph-morph__provider-row { border-top: 1px solid var(--divider); }
.alph-morph__provider-name { color: var(--on-surface-variant); }
.alph-morph__provider-scope {
  color: var(--on-surface);
  font-weight: 400;
  font-size: 10px;
}
</style>
