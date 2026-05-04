<script setup>
/**
 * SettingsPage — DESIGN §7 + mockup drawer-settings.html.
 *
 * Top-level Segmented switches between four sub-tabs: UI, Features,
 * Resources, Advanced. Within each tab the row layout is uniform:
 *   { kind: 'toggle'    } → Toggle (32×18 pill)
 *   { kind: 'slider'    } → Slider (numeric read-out)
 *   { kind: 'segInline' } → inline Segmented
 *   { kind: 'select'    } → static select-pill (Stage 4 wires real menus)
 *
 * Footer is rendered by App.vue and shows Save/Reset whenever
 * `dirty` is true.
 */

import { ref, computed, reactive, watch, onMounted } from 'vue'
import Button from '../primitives/Button.vue'
import Icon from '../primitives/Icon.vue'
import Toggle from '../primitives/Toggle.vue'
import Slider from '../primitives/Slider.vue'
import Segmented from '../primitives/Segmented.vue'
import { useAppController } from '../composables/use-app-controller.js'

const props = defineProps({
  data: { type: Object, required: true }
})

const controller = useAppController()

/** Mapping from fixture row IDs → real option keys in alpheios-core settings. */
const OPTION_MAP = {
  // UI options
  'fontSize':        { group: 'ui', key: 'fontSize' },
  'panelPosition':   { group: 'ui', key: 'panelPosition' },
  'popupMaxWidth':   { group: 'ui', key: 'maxPopupWidth' },
  'hideLogin':       { group: 'ui', key: 'hideLoginPrompt' },
  'logLevel':        { group: 'ui', key: 'verboseMode' },
  // Feature options
  'enableLemmaTranslations': { group: 'feature', key: 'enableLemmaTranslations' },
  'locale':           { group: 'feature', key: 'locale' },
  'modUsage':         { group: 'feature', key: 'enableWordUsageExamples' },
  'preferredLanguage': { group: 'feature', key: 'preferredLanguage' },
  // Resource options (no direct fixture mapping; handled by items section)
}

function optionGroup (rowId) { return OPTION_MAP[rowId] }
function optionKey (rowId) { return OPTION_MAP[rowId] ? OPTION_MAP[rowId].key : rowId }

const tab = ref(props.data.tabs[0].value)

/* ─── Mutable copy of fixture rows so v-model just works ─── */
function freshValues () {
  const map = {}
  for (const t of ['ui', 'features', 'advanced']) {
    for (const g of props.data[t].groups) {
      if (!g.rows) continue
      for (const r of g.rows) map[r.id] = r.value
    }
  }
  for (const g of props.data.resources.groups) {
    for (const it of g.items) map[`res.${it.id}`] = it.checked
  }
  return map
}
const values = reactive(freshValues())
let initialSnapshot = JSON.stringify(values)
function snapshotInitial () { initialSnapshot = JSON.stringify(values) }
const dirty = computed(() => JSON.stringify(values) !== initialSnapshot)
function reset () {
  Object.assign(values, JSON.parse(initialSnapshot))
  if (controller) {
    try { controller.api.settings.resetAllOptions() } catch { /* swallow */ }
    setTimeout(() => populateFromApi(), 200)
  }
}

const dirtyCount = computed(() => {
  const cur = values
  const init = JSON.parse(initialSnapshot)
  return Object.keys(cur).filter(k => cur[k] !== init[k]).length
})

/* ── Live settings wiring ── */
const saveState = ref('idle') // 'idle' | 'saved'

function populateFromApi () {
  if (!controller) return
  try {
    const ui = controller.api.settings.getUiOptions()
    const feat = controller.api.settings.getFeatureOptions()
    const allOpts = [
      ...Object.entries(ui ? ui.items || {} : {}).map(([k, v]) => ({ group: 'ui', key: k, value: v.currentValue })),
      ...Object.entries(feat ? feat.items || {} : {}).map(([k, v]) => ({ group: 'feature', key: k, value: v.currentValue }))
    ]
    // Map real option values back to fixture row IDs
    for (const [fixtureId, mapping] of Object.entries(OPTION_MAP)) {
      const found = allOpts.find(o => o.key === mapping.key && o.group === mapping.group)
      if (found !== undefined) {
        // Normalize value — some options are strings, some booleans
        const val = found.value
        const existing = values[fixtureId]
        if (typeof existing === 'boolean') {
          values[fixtureId] = val === true || val === 'true' || val === 'Yes'
        } else if (typeof existing === 'number') {
          values[fixtureId] = Number(val) || existing
        } else {
          values[fixtureId] = val !== undefined ? val : existing
        }
      }
    }
    // Resource options: checkbox items
    const resOpts = controller.api.settings.getResourceOptions && controller.api.settings.getResourceOptions()
    if (resOpts && resOpts.items) {
      for (const [key, opt] of Object.entries(resOpts.items)) {
        const fk = `res.${key}`
        if (fk in values) values[fk] = !!opt.currentValue
      }
    }
    // Update initial snapshot after populating from API
    snapshotInitial()
  } catch { /* silent fallback to fixture */ }
}

// Save individual changes to API immediately (instant persistence)
const lastSavedKey = ref(null)
watch(values, (newVals, oldVals) => {
  if (!controller) return
  for (const key of Object.keys(newVals)) {
    if (newVals[key] === oldVals[key]) continue
    const mapping = OPTION_MAP[key]
    if (!mapping) continue
    try {
      if (mapping.group === 'ui') {
        controller.api.settings.uiOptionChange(mapping.key, newVals[key])
      } else if (mapping.group === 'feature') {
        controller.api.settings.featureOptionChange(mapping.key, newVals[key])
      }
      lastSavedKey.value = key
      saveState.value = 'saved'
      setTimeout(() => { saveState.value = 'idle' }, 2000)
    } catch { /* swallow */ }
  }
}, { deep: true })

onMounted(() => {
  if (controller) populateFromApi()
})

const footerMeta = computed(() => {
  if (tab.value === 'resources') return props.data.resources.footerMeta
  if (tab.value === 'advanced')  return props.data.advanced.footerMeta
  if (controller) {
    return saveState.value === 'saved' ? 'Saved · just now' : 'No changes'
  }
  return dirty.value ? `${dirtyCount.value} changes · unsaved` : 'No changes'
})
defineExpose({ footerMeta, dirty, dirtyCount, reset })
</script>

<template>
  <div class="alph-settings">

    <div class="alph-settings__seg-row">
      <Segmented v-model="tab" :options="data.tabs" aria-label="Settings tabs" />
    </div>

    <!-- ============ UI ============ -->
    <template v-if="tab === 'ui'">
      <section v-for="g in data.ui.groups" :key="g.title" class="alph-settings__group">
        <h4>{{ g.title }}</h4>
        <p v-if="g.desc" class="alph-settings__desc">{{ g.desc }}</p>
        <div v-for="r in g.rows" :key="r.id" class="alph-settings__row">
          <div class="alph-settings__row-label">
            <span class="alph-settings__name">{{ r.label }}</span>
            <span v-if="r.help" class="alph-settings__help" v-html="r.help" />
          </div>
          <div class="alph-settings__row-ctl">
            <Toggle v-if="r.kind === 'toggle'" v-model="values[r.id]" :aria-label="r.label" />
            <Slider v-else-if="r.kind === 'slider'" v-model="values[r.id]"
                    :min="r.min" :max="r.max" :unit="r.unit" :aria-label="r.label" />
            <Segmented v-else-if="r.kind === 'segInline'"
                       v-model="values[r.id]" :options="r.options" size="inline" :aria-label="r.label" />
            <button v-else-if="r.kind === 'select'" type="button" class="alph-settings__select">
              <span>{{ values[r.id] ?? r.value }}</span>
              <Icon name="expand_more" :size="14" />
            </button>
          </div>
        </div>
      </section>
    </template>

    <!-- ============ FEATURES ============ -->
    <template v-else-if="tab === 'features'">
      <section v-for="g in data.features.groups" :key="g.title" class="alph-settings__group">
        <h4>{{ g.title }}</h4>
        <p v-if="g.desc" class="alph-settings__desc">{{ g.desc }}</p>
        <div v-for="r in g.rows" :key="r.id" class="alph-settings__row">
          <div class="alph-settings__row-label">
            <span class="alph-settings__name">{{ r.label }}</span>
            <span v-if="r.help" class="alph-settings__help" v-html="r.help" />
          </div>
          <div class="alph-settings__row-ctl">
            <Toggle v-model="values[r.id]" :aria-label="r.label" />
          </div>
        </div>
      </section>
    </template>

    <!-- ============ RESOURCES ============ -->
    <template v-else-if="tab === 'resources'">
      <section v-for="g in data.resources.groups" :key="g.title" class="alph-settings__group">
        <h4>{{ g.title }}</h4>
        <p v-if="g.desc" class="alph-settings__desc">{{ g.desc }}</p>
        <div v-for="it in g.items" :key="it.id" class="alph-settings__pick">
          <span class="alph-settings__check"
                :class="{ 'alph-settings__check--on': values[`res.${it.id}`] }"
                @click="values[`res.${it.id}`] = !values[`res.${it.id}`]">
            <Icon v-if="values[`res.${it.id}`]" name="check" :size="10" />
          </span>
          <div class="alph-settings__pick-body">
            <div class="alph-settings__pick-name" v-html="it.name" />
            <div class="alph-settings__pick-meta" v-html="it.meta" />
          </div>
          <Icon v-if="g.draggable" name="drag_indicator" :size="14" class="alph-settings__drag" />
        </div>
      </section>
    </template>

    <!-- ============ ADVANCED ============ -->
    <template v-else-if="tab === 'advanced'">
      <section v-for="g in data.advanced.groups" :key="g.title" class="alph-settings__group">
        <h4>{{ g.title }}</h4>
        <p v-if="g.desc" class="alph-settings__desc">{{ g.desc }}</p>
        <div v-for="r in g.rows" :key="r.id" class="alph-settings__row">
          <div class="alph-settings__row-label">
            <span class="alph-settings__name">{{ r.label }}</span>
            <span v-if="r.help" class="alph-settings__help" v-html="r.help" />
          </div>
          <div class="alph-settings__row-ctl">
            <Toggle v-if="r.kind === 'toggle'" v-model="values[r.id]" :aria-label="r.label" />
            <Segmented v-else-if="r.kind === 'segInline'"
                       v-model="values[r.id]" :options="r.options" size="inline" :aria-label="r.label" />
            <span v-else-if="r.kind === 'select'" class="alph-settings__select alph-settings__select--ro">
              {{ r.value }}
            </span>
          </div>
        </div>
      </section>

      <div class="alph-settings__danger">
        <div>
          <div class="alph-settings__danger-name">{{ data.advanced.danger.name }}</div>
          <div class="alph-settings__danger-help">{{ data.advanced.danger.help }}</div>
        </div>
        <button class="alph-settings__danger-btn">{{ data.advanced.danger.label }}</button>
      </div>

      <section class="alph-settings__group">
        <h4>About</h4>
      </section>
      <div class="alph-settings__about">
        <div v-for="row in data.advanced.about" :key="row.name" class="alph-settings__about-row">
          <span>{{ row.name }}</span>
          <span class="alph-settings__about-v">{{ row.value }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.alph-settings { font-size: 12px; color: var(--on-surface); }

.alph-settings__seg-row {
  padding: 10px 12px;
  border-bottom: 1px solid var(--divider);
}
.alph-settings__seg-row :deep(.alph-segmented) {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  width: 100%;
}
.alph-settings__seg-row :deep(.alph-segmented__item) { padding: 0 4px; }

/* group */
.alph-settings__group {
  padding: 12px;
  border-bottom: 1px solid var(--divider);
}
.alph-settings__group h4 {
  margin: 0 0 6px;
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--on-surface-variant);
}
.alph-settings__desc {
  margin: 0 0 8px;
  font-size: 11px; color: var(--on-surface-variant);
}

/* row */
.alph-settings__row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0;
  border-top: 1px solid var(--divider);
  gap: 8px;
}
.alph-settings__row:first-of-type { border-top: 0; }
.alph-settings__row-label { flex: 1; min-width: 0; }
.alph-settings__name { font-size: 12px; line-height: 16px; }
.alph-settings__help {
  display: block;
  font-size: 10px;
  color: var(--on-surface-variant);
  margin-top: 2px;
}
.alph-settings__help :deep(code) {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  background: var(--surface-container);
  padding: 1px 4px; border-radius: 3px; font-size: 10px;
}
.alph-settings__row-ctl { flex-shrink: 0; }
.alph-settings__row-ctl :deep(.alph-slider) { width: 140px; }

/* select pill */
.alph-settings__select {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-md);
  padding: 4px 8px 4px 10px;
  font-family: inherit;
  font-size: 11px;
  color: var(--on-surface);
  cursor: pointer;
}
.alph-settings__select--ro { cursor: default; }

/* resource pick */
.alph-settings__pick {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 0;
  border-top: 1px solid var(--divider);
}
.alph-settings__pick:first-of-type { border-top: 0; }
.alph-settings__check {
  width: 16px; height: 16px; flex-shrink: 0;
  border: 1.5px solid var(--outline-variant);
  border-radius: 3px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.alph-settings__check--on {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}
.alph-settings__pick-body { flex: 1; min-width: 0; }
.alph-settings__pick-name { font-size: 12px; }
.alph-settings__pick-meta { font-size: 10px; color: var(--on-surface-variant); }
.alph-settings__drag { color: var(--on-surface-variant); }

/* danger */
.alph-settings__danger {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px;
  background: var(--error-container);
  border: 1px solid var(--error);
  border-radius: var(--radius-lg);
  margin: 0 12px 12px;
  gap: 12px;
}
[data-theme="light"] .alph-settings__danger,
.alpheios-v3-scope:not([data-theme="dark"]) .alph-settings__danger {
  background: rgba(186, 26, 26, 0.04);
  border-color: rgba(186, 26, 26, 0.18);
}
.alph-settings__danger-name {
  font-size: 12px; color: var(--on-surface); font-weight: 500;
}
.alph-settings__danger-help {
  font-size: 10px; color: var(--on-surface-variant); margin-top: 2px;
}
.alph-settings__danger-btn {
  background: transparent;
  color: var(--error);
  border: 1px solid var(--error);
  border-radius: var(--radius-md);
  padding: 6px 10px;
  font-family: inherit;
  font-size: 10px; font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase;
  cursor: pointer;
}
.alph-settings__danger-btn:hover { background: rgba(186, 26, 26, 0.08); }

/* about */
.alph-settings__about {
  padding: 12px;
  background: var(--recessed-bg);
  border-radius: var(--radius-lg);
  margin: 0 12px 12px;
  font-size: 11px;
}
.alph-settings__about-row {
  display: flex; justify-content: space-between;
  padding: 4px 0;
  border-top: 1px solid var(--divider);
}
.alph-settings__about-row:first-of-type { border-top: 0; }
.alph-settings__about-v {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  color: var(--on-surface-variant);
  font-size: 10px;
}
</style>
