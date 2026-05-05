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

import { ref, computed, reactive, onMounted, onScopeDispose } from 'vue'
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
  // Feature options
  'enableLemmaTranslations': { group: 'feature', key: 'enableLemmaTranslations' },
  'locale':           { group: 'feature', key: 'locale' },
  'modUsage':         { group: 'feature', key: 'enableWordUsageExamples' }
}

const tab = ref(props.data.tabs[0].value)
const liveResources = ref(null)
const resourceMeta = reactive({})

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
async function reset () {
  if (controller) {
    try { await controller.api.settings.resetAllOptions() } catch { /* swallow */ }
    populateFromApi()
    saveState.value = 'saved'
    setTimeout(() => { saveState.value = 'idle' }, 2000)
  } else {
    Object.assign(values, JSON.parse(initialSnapshot))
  }
}

const dirtyCount = computed(() => {
  const cur = values
  const init = JSON.parse(initialSnapshot)
  return Object.keys(cur).filter(k => cur[k] !== init[k]).length
})

/* ── Live settings wiring ── */
const saveState = ref('idle') // 'idle' | 'saved'
const lastSavedKey = ref(null)

const settingsData = computed(() => ({
  ...props.data,
  resources: liveResources.value || props.data.resources
}))

function normalizeValueForLocal (fixtureId, value) {
  const existing = values[fixtureId]
  if (typeof existing === 'boolean') {
    return value === true || value === 'true' || value === 'Yes'
  }
  if (typeof existing === 'number') {
    const n = Number(value)
    return Number.isFinite(n) ? n : existing
  }
  return value !== undefined ? value : existing
}

function markSaved (key) {
  lastSavedKey.value = key
  saveState.value = 'saved'
  setTimeout(() => { saveState.value = 'idle' }, 2000)
}

function currentAsArray (value) {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === false) return []
  return [value]
}

function resourceId (fullName, value) {
  return `${fullName}::${value}`
}

function buildLiveResources (resOpts) {
  if (!resOpts || !resOpts.items) {
    liveResources.value = null
    return
  }
  const types = ['lexicons', 'lexiconsShort', 'grammars']
  const groups = []
  Object.keys(resourceMeta).forEach(k => { delete resourceMeta[k] })

  for (const type of types) {
    const optionItems = Array.isArray(resOpts.items[type]) ? resOpts.items[type] : []
    const typeDefaults = resOpts.defaults && resOpts.defaults.items && resOpts.defaults.items[type]
    const typeTitle = (typeDefaults && (typeDefaults.labelText || typeDefaults.labelL10n)) || type
    for (const opt of optionItems) {
      if (!opt || !Array.isArray(opt.values) || opt.values.length === 0) continue
      const current = currentAsArray(opt.currentValue)
      const title = [typeTitle, opt.labelText || opt.label || opt.name].filter(Boolean).join(' · ')
      groups.push({
        title,
        desc: opt.multiValue === false ? 'Choose one provider.' : 'Enabled providers are tried in order.',
        draggable: false,
        items: opt.values.map(choice => {
          const id = resourceId(opt.name, choice.value)
          const checked = current.includes(choice.value)
          values[`res.${id}`] = checked
          resourceMeta[id] = {
            fullName: opt.name,
            value: choice.value,
            multiValue: opt.multiValue !== false,
            current
          }
          return {
            id,
            name: choice.text || choice.value,
            meta: opt.name,
            checked
          }
        })
      })
    }
  }

  const enabled = Object.keys(resourceMeta).filter(id => values[`res.${id}`]).length
  liveResources.value = {
    ...props.data.resources,
    groups,
    footerMeta: `${enabled} resources enabled`
  }
}

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
        values[fixtureId] = normalizeValueForLocal(fixtureId, found.value)
      }
    }
    const resOpts = controller.api.settings.getResourceOptions && controller.api.settings.getResourceOptions()
    buildLiveResources(resOpts)
    snapshotInitial()
  } catch { /* silent fallback to fixture */ }
}

function updateSetting (key, value) {
  values[key] = value
  if (!controller) return
  const mapping = OPTION_MAP[key]
  if (!mapping) return
  try {
    if (mapping.group === 'ui') {
      controller.api.settings.uiOptionChange(mapping.key, value)
    } else if (mapping.group === 'feature') {
      controller.api.settings.featureOptionChange(mapping.key, value)
    }
    markSaved(key)
  } catch { /* swallow */ }
}

function toggleResource (item) {
  const meta = resourceMeta[item.id]
  const key = `res.${item.id}`
  const nextChecked = !values[key]
  values[key] = nextChecked
  if (!controller || !meta) return

  const current = currentAsArray(meta.current)
  let nextValue
  if (meta.multiValue) {
    nextValue = nextChecked
      ? Array.from(new Set([...current, meta.value]))
      : current.filter(v => v !== meta.value)
  } else {
    nextValue = meta.value
    values[key] = true
  }

  try {
    controller.api.settings.resourceOptionChange(meta.fullName, nextValue)
    if (controller.api.app && controller.api.app.applyResourceOption) {
      controller.api.app.applyResourceOption(meta.fullName, nextValue)
    }
    markSaved(key)
    populateFromApi()
  } catch { /* swallow */ }
}

let unwatchSettings = []

onMounted(() => {
  if (controller) {
    populateFromApi()
    unwatchSettings = [
      controller._store.watch((st) => st.settings && st.settings.uiResetCounter, populateFromApi),
      controller._store.watch((st) => st.settings && st.settings.featureResetCounter, populateFromApi),
      controller._store.watch((st) => st.settings && st.settings.resourceResetCounter, populateFromApi)
    ]
  }
})

onScopeDispose(() => {
  unwatchSettings.forEach(u => { try { u() } catch { /* swallow */ } })
})

const footerMeta = computed(() => {
  if (tab.value === 'resources') return settingsData.value.resources.footerMeta
  if (tab.value === 'advanced')  return settingsData.value.advanced.footerMeta
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
      <Segmented v-model="tab" :options="settingsData.tabs" aria-label="Settings tabs" />
    </div>

    <!-- ============ UI ============ -->
    <template v-if="tab === 'ui'">
      <section v-for="g in settingsData.ui.groups" :key="g.title" class="alph-settings__group">
        <h4>{{ g.title }}</h4>
        <p v-if="g.desc" class="alph-settings__desc">{{ g.desc }}</p>
        <div v-for="r in g.rows" :key="r.id" class="alph-settings__row">
          <div class="alph-settings__row-label">
            <span class="alph-settings__name">{{ r.label }}</span>
            <span v-if="r.help" class="alph-settings__help" v-html="r.help" />
          </div>
          <div class="alph-settings__row-ctl">
            <Toggle v-if="r.kind === 'toggle'"
                    :model-value="values[r.id]"
                    :aria-label="r.label"
                    @update:model-value="v => updateSetting(r.id, v)" />
            <Slider v-else-if="r.kind === 'slider'"
                    :model-value="values[r.id]"
                    :min="r.min" :max="r.max" :unit="r.unit" :aria-label="r.label"
                    @update:model-value="v => updateSetting(r.id, v)" />
            <Segmented v-else-if="r.kind === 'segInline'"
                       :model-value="values[r.id]"
                       :options="r.options" size="inline" :aria-label="r.label"
                       @update:model-value="v => updateSetting(r.id, v)" />
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
      <section v-for="g in settingsData.features.groups" :key="g.title" class="alph-settings__group">
        <h4>{{ g.title }}</h4>
        <p v-if="g.desc" class="alph-settings__desc">{{ g.desc }}</p>
        <div v-for="r in g.rows" :key="r.id" class="alph-settings__row">
          <div class="alph-settings__row-label">
            <span class="alph-settings__name">{{ r.label }}</span>
            <span v-if="r.help" class="alph-settings__help" v-html="r.help" />
          </div>
          <div class="alph-settings__row-ctl">
            <Toggle
              :model-value="values[r.id]"
              :aria-label="r.label"
              @update:model-value="v => updateSetting(r.id, v)"
            />
          </div>
        </div>
      </section>
    </template>

    <!-- ============ RESOURCES ============ -->
    <template v-else-if="tab === 'resources'">
      <section v-for="g in settingsData.resources.groups" :key="g.title" class="alph-settings__group">
        <h4>{{ g.title }}</h4>
        <p v-if="g.desc" class="alph-settings__desc">{{ g.desc }}</p>
        <div v-for="it in g.items" :key="it.id" class="alph-settings__pick">
          <span class="alph-settings__check"
                :class="{ 'alph-settings__check--on': values[`res.${it.id}`] }"
                @click="toggleResource(it)">
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
      <section v-for="g in settingsData.advanced.groups" :key="g.title" class="alph-settings__group">
        <h4>{{ g.title }}</h4>
        <p v-if="g.desc" class="alph-settings__desc">{{ g.desc }}</p>
        <div v-for="r in g.rows" :key="r.id" class="alph-settings__row">
          <div class="alph-settings__row-label">
            <span class="alph-settings__name">{{ r.label }}</span>
            <span v-if="r.help" class="alph-settings__help" v-html="r.help" />
          </div>
          <div class="alph-settings__row-ctl">
            <Toggle v-if="r.kind === 'toggle'"
                    :model-value="values[r.id]"
                    :aria-label="r.label"
                    @update:model-value="v => updateSetting(r.id, v)" />
            <Segmented v-else-if="r.kind === 'segInline'"
                       :model-value="values[r.id]"
                       :options="r.options" size="inline" :aria-label="r.label"
                       @update:model-value="v => updateSetting(r.id, v)" />
            <span v-else-if="r.kind === 'select'" class="alph-settings__select alph-settings__select--ro">
              {{ r.value }}
            </span>
          </div>
        </div>
      </section>

      <div class="alph-settings__danger">
        <div>
          <div class="alph-settings__danger-name">{{ settingsData.advanced.danger.name }}</div>
          <div class="alph-settings__danger-help">{{ settingsData.advanced.danger.help }}</div>
        </div>
        <button class="alph-settings__danger-btn">{{ settingsData.advanced.danger.label }}</button>
      </div>

      <section class="alph-settings__group">
        <h4>About</h4>
      </section>
      <div class="alph-settings__about">
        <div v-for="row in settingsData.advanced.about" :key="row.name" class="alph-settings__about-row">
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
