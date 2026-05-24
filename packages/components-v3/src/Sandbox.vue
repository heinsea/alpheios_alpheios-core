<script setup>
/**
 * Sandbox preview page (Stage 1). Demos all 9 primitives in light + dark
 * variants. Open via `npm run dev` inside packages/components-v3.
 *
 * Not bundled into dist/ — sandbox.html is excluded by vite.config.js's
 * library mode (entry is src/index.js, not src/Sandbox.vue).
 */

import { ref, computed } from 'vue'
import Button from './primitives/Button.vue'
import Toggle from './primitives/Toggle.vue'
import Segmented from './primitives/Segmented.vue'
import Chip from './primitives/Chip.vue'
import Slider from './primitives/Slider.vue'
import StatCard from './primitives/StatCard.vue'
import ElevatedCard from './primitives/ElevatedCard.vue'
import RecessedInput from './primitives/RecessedInput.vue'
import FrostedGlass from './primitives/FrostedGlass.vue'
import Icon from './primitives/Icon.vue'

const theme = ref('light')
function toggleTheme () { theme.value = theme.value === 'light' ? 'dark' : 'light' }

const toggleA = ref(true)
const toggleB = ref(false)
const segValue = ref('ui')
const segOpts = [
  { value: 'ui', label: 'UI' },
  { value: 'features', label: 'Features' },
  { value: 'resources', label: 'Resources' },
  { value: 'advanced', label: 'Advanced' }
]
const sliderValue = ref(360)
const inputValue = ref('arma')

const bgFromTheme = computed(() =>
  theme.value === 'dark' ? 'linear-gradient(135deg, #1a1c1d, #0a0b0c)' : 'linear-gradient(135deg, #fafbfc, #e8ecef)'
)
</script>

<template>
  <div class="sandbox alpheios-v3-scope" :data-theme="theme" :style="{ background: bgFromTheme }">
    <header class="sandbox__head">
      <div class="brand alph-brand">α</div>
      <div>
        <h1>Scholarly Glass · Stage 1 Sandbox</h1>
        <p>9 primitives · live preview · token-driven</p>
      </div>
      <Button variant="secondary" @click="toggleTheme">
        {{ theme === 'light' ? 'Dark' : 'Light' }}
      </Button>
    </header>

    <section class="card">
      <h2>Buttons</h2>
      <div class="row">
        <Button variant="primary">Add to list</Button>
        <Button variant="secondary">View Full</Button>
        <Button variant="ghost">Switch language</Button>
        <Button variant="icon" aria-label="More">
          <Icon name="more_horiz" :size="18" />
        </Button>
        <Button variant="fab" aria-label="Open">
          <Icon name="menu_book" :size="22" />
        </Button>
        <Button variant="primary" disabled>Disabled</Button>
      </div>
    </section>

    <section class="card">
      <h2>Toggle</h2>
      <div class="row">
        <Toggle v-model="toggleA" aria-label="Auto-open popup" />
        <span>Auto-open popup ({{ toggleA }})</span>
        <Toggle v-model="toggleB" aria-label="Hide login" />
        <span>Hide login prompt ({{ toggleB }})</span>
        <Toggle :model-value="false" disabled aria-label="Disabled" />
        <span>Disabled</span>
      </div>
    </section>

    <section class="card">
      <h2>Segmented</h2>
      <div class="row">
        <Segmented v-model="segValue" :options="segOpts" aria-label="Settings tabs" />
      </div>
      <div class="row" style="margin-top: 8px;">
        <Segmented v-model="segValue" :options="segOpts" size="inline" aria-label="Inline" />
      </div>
      <p>Active: <code>{{ segValue }}</code></p>
    </section>

    <section class="card">
      <h2>Chip</h2>
      <div class="row">
        <Chip variant="default">NOUN</Chip>
        <Chip variant="default">NEUTER · PLURAL</Chip>
        <Chip variant="filled">LATIN</Chip>
        <Chip variant="filled">GREEK</Chip>
        <Chip variant="tertiary">
          <Icon name="check" :size="12" />
          recognized
        </Chip>
        <Chip variant="error">ERROR</Chip>
        <Chip variant="default" clickable>Filter A</Chip>
        <Chip variant="default" clickable active>Filter B (active)</Chip>
      </div>
    </section>

    <section class="card">
      <h2>Slider</h2>
      <div class="row" style="width: 360px;">
        <Slider v-model="sliderValue" :min="240" :max="600" unit="px" aria-label="Popup max width" />
      </div>
    </section>

    <section class="card">
      <h2>RecessedInput</h2>
      <div class="row" style="max-width: 360px;">
        <RecessedInput v-model="inputValue" icon="search" placeholder="Lookup a word..." clearable aria-label="Search" />
      </div>
    </section>

    <section class="card">
      <h2>StatCard</h2>
      <div class="row">
        <StatCard :value="24" label="Words saved" />
        <StatCard :value="3" label="Languages" />
        <StatCard value="—" label="Active sessions" />
      </div>
    </section>

    <section class="card">
      <h2>ElevatedCard</h2>
      <div class="row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 720px;">
        <ElevatedCard>
          <template #eyebrow>IN CONTEXT</template>
          <em class="lang-classical">Arma virumque cano, Troiae qui primus ab oris…</em>
          <template #footer>
            <span>— Virgil, Aeneid 1.1</span>
            <a href="#">View full →</a>
          </template>
        </ElevatedCard>
        <ElevatedCard accent>
          <template #eyebrow>LEMMA · disambiguated</template>
          <strong class="lang-classical">arma · NOUN · 2nd declension</strong>
          <p>The accent stripe marks the disambiguated lemma in morph view.</p>
        </ElevatedCard>
      </div>
    </section>

    <section class="card">
      <h2>FrostedGlass</h2>
      <div class="row">
        <FrostedGlass tone="standard" radius="var(--radius-xl)">
          <div style="padding: 24px; width: 280px;">
            <strong>Standard glass (65% opacity)</strong>
            <p>Used for Popup, Drawer, Toast.</p>
          </div>
        </FrostedGlass>
        <FrostedGlass tone="low" radius="var(--radius-lg)">
          <div style="padding: 16px; width: 240px;">
            <strong>Low glass (35%)</strong>
            <p>For embedded panels.</p>
          </div>
        </FrostedGlass>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sandbox {
  min-height: 100vh;
  padding: 32px 48px 96px;
  transition: background 200ms;
}
.sandbox__head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--divider);
}
.sandbox__head h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.sandbox__head p {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--on-surface-variant);
}
.brand {
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--primary); color: var(--on-primary);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 22px;
  /* lowercase α optical centring; rest of brand styling lives in fonts.css
   * via .alph-brand (Lato + 700). */
  padding-bottom: 4px;
  box-sizing: border-box;
}
.card {
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-xl);
  padding: 24px;
  margin-bottom: 16px;
}
.card h2 {
  margin: 0 0 12px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--on-surface-variant);
}
.row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.card p { margin: 8px 0 0; font-size: 12px; color: var(--on-surface-variant); }
.card code { background: var(--surface-container); padding: 1px 6px; border-radius: 3px; font-size: 11px; }
</style>
