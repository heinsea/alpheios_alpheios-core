<script setup>
/**
 * InflectionsPage — DESIGN §7 + mockup drawer-inflections.html.
 *
 * Two modes:
 *   matched  — paradigm of the currently looked-up word, with the
 *              queried form (case×number cell) highlighted.
 *   browser  — three-step picker (Language → POS → Paradigm) +
 *              live preview table; voice / mood toggled via chips.
 *
 * Mode is local to this page (Stage 4 will bind it to data: if a
 * lookup result is present, default to `matched`; otherwise `browser`).
 */

import { ref, computed } from 'vue'
import Button from '../primitives/Button.vue'
import Chip from '../primitives/Chip.vue'
import Icon from '../primitives/Icon.vue'
import Segmented from '../primitives/Segmented.vue'

const props = defineProps({
  data: { type: Object, required: true }
})

/* ─── Mode state ─── */
const mode = ref('matched')
function toMatched () { mode.value = 'matched' }
function toBrowser () { mode.value = 'browser' }

/* ─── Matched mode local state ─── */
const matched = props.data.matched
const wordClass    = ref(matched.wordClass)        // 'verb' | 'noun'
const density      = ref(matched.density)          // 'wide' | 'narrow'
const filterId     = ref(matched.filterChips.find(c => c.active)?.id ?? matched.filterChips[0].id)
const highlight    = ref(matched.highlightMatches)
const wordClassOpts = [
  { value: 'verb', label: 'Verb' },
  { value: 'noun', label: 'Noun' }
]
const densityOpts = [
  { value: 'wide',   label: 'Wide' },
  { value: 'narrow', label: 'Narrow' }
]

/* ─── Browser mode local state ─── */
const browser    = props.data.browser
const lang       = ref(browser.language)
const pos        = ref(browser.pos)
const paradigm   = ref(browser.paradigm)
const voice      = ref(browser.voice)
const mood       = ref(browser.mood)
const voiceOpts  = ['Active', 'Passive']
const moodOpts   = ['Indicative', 'Subjunctive', 'Imperative']

const footerMeta = computed(() =>
  mode.value === 'matched' ? matched.footerMeta : browser.footerMeta
)
defineExpose({ footerMeta, mode })
</script>

<template>
  <div class="alph-infl">

    <!-- ─── Page-head + mode switch ─── -->
    <header class="alph-infl__head">
      <h2 v-if="mode === 'matched'">
        <span class="lang-classical">{{ matched.lemma }}</span> · {{ matched.pos }}
      </h2>
      <h2 v-else>Browse paradigms</h2>
      <p class="alph-infl__sub" v-html="mode === 'matched'
          ? matched.subhead
          : 'No lookup needed. Pick a language, a part of speech, and a paradigm to inspect.'" />

      <div class="alph-infl__mode-switch">
        <Chip variant="default" clickable :active="mode === 'matched'" @click="toMatched">From lookup</Chip>
        <Chip variant="default" clickable :active="mode === 'browser'" @click="toBrowser">Browser</Chip>
      </div>
    </header>

    <!-- ============ MATCHED MODE ============ -->
    <template v-if="mode === 'matched'">
      <div class="alph-infl__seg-row">
        <Segmented v-model="wordClass" :options="wordClassOpts" size="inline" aria-label="Word class" />
        <Segmented v-model="density"   :options="densityOpts"   size="inline" aria-label="Density" />
      </div>

      <div class="alph-infl__chip-row">
        <Chip v-for="c in matched.filterChips" :key="c.id"
              variant="default" clickable
              :active="filterId === c.id"
              @click="filterId = c.id">{{ c.label }}</Chip>
        <Chip variant="tertiary" clickable :active="highlight" @click="highlight = !highlight">
          Highlight matches
        </Chip>
      </div>

      <div class="alph-infl__table-wrap">
        <table class="alph-infl__table">
          <thead>
            <tr><th v-for="col in matched.table.columns" :key="col">{{ col }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in matched.table.rows" :key="row.head">
              <th class="alph-infl__row-head">{{ row.head }}</th>
              <td v-for="(cell, i) in row.cells" :key="i"
                  :class="[
                    { 'alph-infl__cell-match': cell.match && highlight },
                    { 'lang-classical': cell.lang }
                  ]">
                {{ cell.value }}
                <span v-if="cell.secondary" class="alph-infl__form-secondary">— {{ cell.secondary }}</span>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="matched.table.tfoot">
            <tr><td :colspan="matched.table.columns.length">{{ matched.table.tfoot }}</td></tr>
          </tfoot>
        </table>
      </div>

      <div class="alph-infl__legend">
        <span class="alph-infl__legend-swatch" /> highlighted = matches the queried form
      </div>

      <header class="alph-infl__h-section"><span>Footnotes</span></header>
      <ol class="alph-infl__footnotes">
        <li v-for="(n, i) in matched.footnotes" :key="i">
          <span class="alph-infl__footnote-num">{{ i + 1 }}.</span>
          <span v-html="n" />
        </li>
      </ol>

      <header class="alph-infl__h-section"><span>Credits</span></header>
      <p class="alph-infl__credits" v-html="matched.credits" />
    </template>

    <!-- ============ BROWSER MODE ============ -->
    <template v-else>
      <article class="alph-infl__step">
        <h4><span class="alph-infl__step-num">1</span>Language</h4>
        <div class="alph-infl__opts">
          <button v-for="l in browser.languages" :key="l"
                  type="button"
                  class="alph-infl__opt"
                  :class="{ 'alph-infl__opt--selected': lang === l }"
                  @click="lang = l">{{ l }}</button>
        </div>
      </article>

      <article class="alph-infl__step">
        <h4><span class="alph-infl__step-num">2</span>Part of speech</h4>
        <div class="alph-infl__opts">
          <button v-for="p in browser.posOptions" :key="p"
                  type="button"
                  class="alph-infl__opt"
                  :class="{ 'alph-infl__opt--selected': pos === p }"
                  @click="pos = p">{{ p }}</button>
        </div>
      </article>

      <article class="alph-infl__step">
        <h4><span class="alph-infl__step-num">3</span>Paradigm</h4>
        <div class="alph-infl__opts">
          <button v-for="p in browser.paradigmOptions" :key="p"
                  type="button"
                  class="alph-infl__opt"
                  :class="{ 'alph-infl__opt--selected': paradigm === p }"
                  v-html="p === paradigm ? p : p"
                  @click="paradigm = p" />
        </div>
        <p class="alph-infl__step-meta" v-html="browser.paradigmMeta" />
      </article>

      <header class="alph-infl__h-section"><span>Preview</span></header>

      <div class="alph-infl__table-wrap">
        <table class="alph-infl__table">
          <thead>
            <tr><th v-for="col in browser.preview.columns" :key="col">{{ col }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in browser.preview.rows" :key="row.head">
              <th class="alph-infl__row-head">{{ row.head }}</th>
              <td v-for="(cell, i) in row.cells" :key="i"
                  :class="{ 'lang-classical': cell.lang }">{{ cell.value }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="alph-infl__chip-row">
        <Chip v-for="v in voiceOpts" :key="v"
              variant="default" clickable :active="voice === v"
              @click="voice = v">{{ v }}</Chip>
        <span class="alph-infl__chip-spacer" />
        <Chip v-for="m in moodOpts" :key="m"
              variant="default" clickable :active="mood === m"
              @click="mood = m">{{ m }}</Chip>
      </div>
    </template>
  </div>
</template>

<style scoped>
.alph-infl { font-size: 12px; color: var(--on-surface); }

/* head */
.alph-infl__head {
  padding: 12px;
  border-bottom: 1px solid var(--divider);
}
.alph-infl__head h2 {
  margin: 0 0 4px;
  font-size: 16px; font-weight: 600; letter-spacing: -0.01em;
}
.alph-infl__sub {
  margin: 0; font-size: 11px;
  color: var(--on-surface-variant);
}
.alph-infl__sub :deep(strong) { color: var(--tertiary); font-weight: 600; }
.alph-infl__sub :deep(em) { font-style: italic; }
.alph-infl__mode-switch {
  margin-top: 8px;
  display: flex; gap: 4px;
}

/* segmented row */
.alph-infl__seg-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px;
  gap: 8px;
}

/* chips row */
.alph-infl__chip-row {
  display: flex; gap: 4px; flex-wrap: wrap;
  padding: 8px 12px;
}
.alph-infl__chip-spacer { width: 8px; flex-shrink: 0; }

/* table */
.alph-infl__table-wrap {
  margin: 12px;
  overflow-x: auto;
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-lg);
}
.alph-infl__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.alph-infl__table th,
.alph-infl__table td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid var(--divider);
  border-right: 1px solid var(--divider);
}
.alph-infl__table th:last-child,
.alph-infl__table td:last-child { border-right: 0; }
.alph-infl__table thead th {
  background: var(--surface-container-high);
  font-weight: 600;
  font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--on-surface-variant);
}
.alph-infl__table tbody tr:nth-child(even) { background: var(--surface-container-low); }
.alph-infl__row-head {
  background: var(--surface-container);
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--on-surface-variant);
}
.alph-infl__table tbody td {
  font-family: 'Lato', serif;
  color: var(--on-surface);
}
.alph-infl__cell-match {
  background: var(--tertiary-container);
  border-left: 1.5px solid var(--tertiary);
  font-weight: 700;
  color: var(--tertiary);
  position: relative;
}
.alph-infl__form-secondary {
  display: block;
  color: var(--on-surface-variant);
  font-size: 10px;
  font-style: italic;
}
.alph-infl__table tfoot td {
  background: var(--surface-container-low);
  font-size: 10px;
  color: var(--on-surface-variant);
  font-style: italic;
}

/* legend */
.alph-infl__legend {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  font-size: 10px; color: var(--on-surface-variant);
}
.alph-infl__legend-swatch {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 2px;
  background: var(--tertiary);
  opacity: 0.6;
}

/* h-section reuse */
.alph-infl__h-section {
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--on-surface-variant);
  padding: 10px 12px 6px;
}

/* footnotes / credits */
.alph-infl__footnotes {
  list-style: none;
  margin: 0;
  padding: 0 12px 4px;
}
.alph-infl__footnotes li {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 8px;
  padding: 4px 0;
  font-size: 11px;
  color: var(--on-surface-variant);
}
.alph-infl__footnote-num { color: var(--tertiary); font-weight: 600; }
.alph-infl__credits {
  margin: 0; padding: 0 12px 12px;
  font-size: 11px;
  color: var(--on-surface-variant);
}
.alph-infl__credits :deep(em) { font-style: italic; }

/* picker steps */
.alph-infl__step {
  margin: 12px;
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-xl);
  padding: 12px;
}
.alph-infl__step + .alph-infl__step { margin-top: 8px; }
.alph-infl__step h4 {
  margin: 0 0 8px;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.05em;
  display: flex; align-items: center;
}
.alph-infl__step-num {
  display: inline-flex;
  align-items: center; justify-content: center;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--primary); color: var(--on-primary);
  font-size: 10px; font-weight: 700;
  margin-right: 8px;
}
.alph-infl__opts { display: flex; flex-wrap: wrap; gap: 4px; }
.alph-infl__opt {
  padding: 4px 10px;
  border: 1px solid var(--outline-variant);
  background: transparent;
  color: var(--on-surface);
  border-radius: var(--radius-full);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color var(--motion-fast),
              background-color var(--motion-fast),
              color var(--motion-fast);
}
.alph-infl__opt :deep(em) { font-style: italic; }
.alph-infl__opt:hover { border-color: var(--on-surface); }
.alph-infl__opt--selected {
  border-color: var(--on-surface);
  background: var(--on-surface);
  color: var(--on-primary);
}
.alph-infl__step-meta {
  margin: 8px 0 0;
  font-size: 10px;
  color: var(--on-surface-variant);
  font-style: italic;
}
.alph-infl__step-meta :deep(code) {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  background: var(--surface-container);
  padding: 1px 4px; border-radius: 3px; font-size: 10px;
}
</style>
