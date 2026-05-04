<script setup>
/**
 * v3 surface router.
 *
 * Reads URL overrides on mount (?surface=popup&state=loading&theme=dark) and
 * renders the appropriate surface — Popup, Drawer, or Toolbar. Toast renders
 * on top of any of these. State lives in `ui-store.js`; this file is dumb
 * routing + slot wiring.
 *
 * Stage 2:    Lookup page only
 * Stage 3:    + Morph / Inflections / Usage / Tree / Grammar / WordList /
 *             User (Auth) / Opts (Settings) — every sidebar tab routable.
 *             Each page lives in `pages/`, owns its sub-state, and is fed
 *             a fixture for now. Footer slot content varies per page.
 * Stage 4:    swaps fixtures for real `useLookup()` etc. composables and
 *             toggles surface based on selection / FAB clicks.
 */

import { ref, computed, onMounted, watch } from 'vue'

import Popup from './surfaces/Popup.vue'
import Drawer from './surfaces/Drawer.vue'
import Toolbar from './surfaces/Toolbar.vue'
import Toast from './surfaces/Toast.vue'

import LookupPage      from './pages/LookupPage.vue'
import MorphPage       from './pages/MorphPage.vue'
import InflectionsPage from './pages/InflectionsPage.vue'
import WordListPage    from './pages/WordListPage.vue'
import ResourcesPage   from './pages/ResourcesPage.vue'
import SettingsPage    from './pages/SettingsPage.vue'
import AuthPage        from './pages/AuthPage.vue'

import RecessedInput from './primitives/RecessedInput.vue'
import Button from './primitives/Button.vue'
import Chip from './primitives/Chip.vue'
import Icon from './primitives/Icon.vue'

import { uiStore, applyUrlOverrides } from './store/ui-store.js'
import { useLookup } from './composables/use-lookup.js'
import { useAppController } from './composables/use-app-controller.js'
import { useWordList } from './composables/use-wordlist.js'
import { useInflections } from './composables/use-inflections.js'
import { useResources } from './composables/use-resources.js'

import armaFixture        from './fixtures/arma.json'
import emptyStatesFixture from './fixtures/empty-states.json'
import inflectionsFixture from './fixtures/inflections.json'
import wordListFixture    from './fixtures/wordlist.json'
import resourcesFixture   from './fixtures/resources.json'
import settingsFixture    from './fixtures/settings.json'
import authFixture        from './fixtures/auth.json'

/* ── Stage 4b live data wiring ──
 * `useLookup()` exposes a state machine: idle / loading / success /
 * no-result. lookupData branches on it so users can clearly tell whether
 * a query landed:
 *   idle      → arma fixture (acts as a demo so the page never looks empty
 *               in Sandbox / before any lookup happens).
 *   loading   → echo the targetWord with a placeholder definition while
 *               the lexical request is in flight.
 *   success   → live homonym data (citation / principal parts still come
 *               from the fixture until Stage 4c populates them).
 *   no-result → echo the targetWord with an explicit "No entry found" line
 *               and recognized=false; the fixture is NOT shown so the
 *               state is unambiguous (user feedback, 2026-05-05).
 */
const live = useLookup()

function emptyShape (lemma, lang, definitionLine) {
  return {
    lemma: lemma || '',
    lang: lang || armaFixture.lang,
    langCode: '',
    selectedText: '',
    recognized: false,
    pos: [],
    morph: [],
    definitions: definitionLine ? [definitionLine] : [],
    citation: null,
    principalParts: [],
    providers: []
  }
}

const lookupData = computed(() => {
  if (live.state.value === 'success' && live.data.value) {
    // Merge live over fixture so demo citation / principal parts persist
    // until Stage 4c. Empty arrays fall through to fixture so the section
    // stays visually filled.
    return {
      ...armaFixture,
      ...Object.fromEntries(
        Object.entries(live.data.value).filter(([, v]) =>
          v !== null && !(Array.isArray(v) && v.length === 0)
        )
      )
    }
  }
  if (live.state.value === 'loading') {
    return emptyShape(live.targetWord.value, live.lang.value, 'Looking up…')
  }
  if (live.state.value === 'no-result') {
    return emptyShape(live.targetWord.value, live.lang.value,
      `No entry found for ${live.targetWord.value || 'this word'} in any lexicon.`)
  }
  // idle — show fixture as demo
  return armaFixture
})

/* Search input ref — starts at arma demo, then auto-syncs to whatever
 * target word a real lookup produced. The user can still freely type and
 * their typed value persists until the next lookup overwrites it. */
const search = ref(armaFixture.lemma)
watch(() => live.targetWord.value, (w) => { if (w) search.value = w })

const controller = useAppController()
function onSearchEnter (value) {
  if (!controller || !value || !value.trim()) return
  const languageID = controller._store.state.app.currentLanguageID
  if (languageID) {
    controller.api.app.newLexicalRequest(value.trim(), languageID, null, 'lookup')
  }
}

const wl = useWordList()
const infl = useInflections()
const resources = useResources()

/* ── Inflections data: merge live matched with fixture fallback ── */
const inflectionsData = computed(() => {
  if (infl.hasData.value && infl.matchedData.value) {
    return {
      matched: { ...inflectionsFixture.matched, ...infl.matchedData.value },
      browser: inflectionsFixture.browser
    }
  }
  return inflectionsFixture
})

/* ── Wordlist data: merge live groups/context with fixture fallback ── */
const wordlistData = computed(() => {
  const ctxData = wl.contextData.value
  if (ctxData) {
    return { list: { ...wordListFixture.list, groups: wl.groups.value.length ? wl.groups.value : wordListFixture.list.groups }, context: ctxData }
  }
  if (wl.hasData.value && wl.groups.value.length) {
    return { list: { ...wordListFixture.list, groups: wl.groups.value, footerMeta: `${wl.groups.value.reduce((s, g) => s + g.count, 0)} saved · ${wl.groups.value.length} languages` }, context: wordListFixture.context }
  }
  return wordListFixture
})

/* ── Resources data: composable live data + fixture fallback ── */
const usagePageData = computed(() => ({
  ...resourcesFixture,
  usage: {
    ...resourcesFixture.usage,
    ...(resources.usageData.value || {})
  }
}))

const grammarPageData = computed(() => ({
  ...resourcesFixture,
  grammar: {
    ...resourcesFixture.grammar,
    ...(resources.grammarData.value || {})
  }
}))

const treePageData = computed(() => ({
  ...resourcesFixture,
  tree: {
    ...resourcesFixture.tree,
    ...(resources.treeData.value || {})
  }
}))

/* ── Trigger data fetches on page navigation ── */
watch(() => uiStore.state.page, async (newPage) => {
  if (!controller) return
  const store = controller._store
  if (newPage === 'usage') {
    try {
      await resources.refreshUsage()
    } catch { /* swallow */ }
  } else if (newPage === 'grammar') {
    try {
      await resources.refreshGrammar()
    } catch { /* swallow */ }
  } else if (newPage === 'tree') {
    try {
      await resources.refreshTree()
    } catch { /* swallow */ }
  } else if (newPage === 'inflections') {
    store.state.app.hasInflData && infl.rebuild && infl.rebuild()
  }
})

onMounted(() => {
  applyUrlOverrides()
})


/* ───── Surface visibility ───── */
const showPopup   = computed(() => uiStore.state.surface === 'popup')
const showDrawer  = computed(() => uiStore.state.surface === 'drawer')
const showToolbar = computed(() => uiStore.state.surface === 'toolbar')

const page = computed(() => uiStore.state.page)

/* ───── Drawer page → topbar lang label ─────
 * Pages with a primary lemma show the language; settings / auth show the
 * page name itself. */
const langLabel = computed(() => {
  switch (page.value) {
    case 'lookup':
    case 'morph':       return lookupData.value.lang || armaFixture.lang
    case 'inflections': return 'Inflections'
    case 'usage':       return 'Word Usage'
    case 'tree':        return 'Treebank'
    case 'grammar':     return 'Grammar'
    case 'wordlist':    return 'Word List'
    case 'user':        return 'Account'
    case 'opts':        return 'Settings'
    default:            return ''
  }
})

const showSearchSlot = computed(() => page.value === 'lookup' || page.value === 'morph')

/* ───── Popup state ─────
 * URL override (?state=loading) drives the demo Stage 2 path. When a real
 * lookup is in flight the live state machine takes precedence so Popup
 * reflects the actual query lifecycle. */
const popupState = computed(() => {
  if (live.state.value === 'loading')   return 'loading'
  if (live.state.value === 'no-result') return 'no-result'
  if (live.state.value === 'success')   return 'default'
  return uiStore.state.popupState
})

/* ───── Handlers ───── */
function closeAll () { uiStore.setSurface('hidden') }
function collapseToToolbar () { uiStore.setSurface('toolbar') }
function expandToDrawer () { uiStore.setSurface('drawer') }
function showAddedToast () {
  uiStore.showToast({
    kind: 'success',
    title: 'Added to your list',
    body: `${lookupData.lemma} · ${lookupData.lang} · just now`
  })
}
function showRetryToast () {
  uiStore.showToast({ kind: 'info', title: 'Retrying lookup…' })
}
function showSavedToast () {
  uiStore.showToast({ kind: 'success', title: 'Settings saved' })
}
</script>

<template>
  <div class="alph-app alpheios-v3-scope" :data-theme="uiStore.state.theme">

    <!-- ─── Popup ─── -->
    <div v-if="showPopup" class="alph-app__popup-wrap">
      <Popup
        :state="popupState"
        :data="lookupData"
        :empty-states="emptyStatesFixture"
        @close="closeAll"
        @expand="expandToDrawer"
        @add="showAddedToast"
        @retry="showRetryToast"
      />
    </div>

    <!-- ─── Drawer ─── -->
    <Drawer
      v-if="showDrawer"
      :lang="langLabel"
      @close="closeAll"
      @collapse="collapseToToolbar"
    >
      <!-- Search slot — only on lookup / morph pages -->
      <template v-if="showSearchSlot" #search>
        <RecessedInput
          v-model="search"
          icon="search"
          placeholder="Lookup a word…"
          @enter="onSearchEnter"
        >
          <template #suffix>
            <Chip variant="filled">{{ lookupData.lang }}</Chip>
          </template>
        </RecessedInput>
      </template>

      <!-- Body — page router -->
      <LookupPage      v-if="page === 'lookup'"      :data="lookupData" />
      <MorphPage       v-else-if="page === 'morph'"  :data="lookupData" />
      <InflectionsPage v-else-if="page === 'inflections'" :data="inflectionsData" />
      <ResourcesPage   v-else-if="page === 'usage'"  mode="usage"   :data="usagePageData" />
      <ResourcesPage   v-else-if="page === 'tree'"   mode="tree"    :data="treePageData" />
      <ResourcesPage   v-else-if="page === 'grammar'" mode="grammar" :data="grammarPageData" />
      <WordListPage    v-else-if="page === 'wordlist'" :data="wordlistData" @select-word="(p) => wl.selectWord(p.langCode, p.targetWord)" />
      <AuthPage        v-else-if="page === 'user'"   :data="authFixture" />
      <SettingsPage    v-else-if="page === 'opts'"   :data="settingsFixture" />
      <div v-else class="alph-app__page-stub">
        <p>Unknown page <code>{{ page }}</code>.</p>
      </div>

      <!-- Footer — varies per page -->
      <template v-if="page === 'lookup'" #footer>
        <Button variant="primary" block @click="showAddedToast">
          <Icon name="add" :size="14" />
          Add to list
        </Button>
        <Button variant="secondary" aria-label="Share">
          <Icon name="share" :size="14" />
        </Button>
        <Button variant="secondary" aria-label="Speak">
          <Icon name="volume_up" :size="14" />
        </Button>
      </template>

      <template v-else-if="page === 'morph'" #footer>
        <span class="alph-app__footer-meta">
          {{ lookupData.lemma }} · {{ lookupData.morph?.length ?? 0 }} readings
        </span>
        <Button variant="secondary"><Icon name="link" :size="14" /></Button>
        <Button variant="secondary"><Icon name="more_horiz" :size="14" /></Button>
      </template>

      <template v-else-if="page === 'inflections'" #footer>
        <span class="alph-app__footer-meta">{{ inflectionsData.matched.footerMeta }}</span>
        <Button variant="secondary"><Icon name="download" :size="14" /> Export</Button>
        <Button variant="secondary"><Icon name="print" :size="14" /></Button>
      </template>

      <template v-else-if="page === 'usage'" #footer>
        <span class="alph-app__footer-meta">{{ usagePageData.usage.footerMeta }}</span>
        <Button variant="secondary"><Icon name="sync" :size="14" /></Button>
        <Button variant="secondary">Cite all</Button>
      </template>

      <template v-else-if="page === 'tree'" #footer>
        <span class="alph-app__footer-meta">{{ treePageData.tree.footerMeta }}</span>
        <Button variant="secondary"><Icon name="link" :size="14" /> Permalink</Button>
        <Button variant="secondary"><Icon name="help" :size="14" /></Button>
      </template>

      <template v-else-if="page === 'grammar'" #footer>
        <span class="alph-app__footer-meta">{{ grammarPageData.grammar.footerMeta }}</span>
        <Button variant="secondary"><Icon name="arrow_back_ios_new" :size="14" /></Button>
        <Button variant="secondary">§48 →</Button>
      </template>

      <template v-else-if="page === 'wordlist'" #footer>
        <span class="alph-app__footer-meta">{{ wordlistData.list.footerMeta }}</span>
        <Button variant="secondary">Import</Button>
        <Button variant="primary">Export all</Button>
      </template>

      <template v-else-if="page === 'user'" #footer>
        <span class="alph-app__footer-meta">{{ authFixture.loggedIn.lastSync }}</span>
        <Button variant="secondary"><Icon name="cloud_sync" :size="14" /> Sync</Button>
        <Button variant="secondary"><Icon name="logout" :size="14" /> Log out</Button>
      </template>

      <template v-else-if="page === 'opts'" #footer>
        <span class="alph-app__footer-meta">{{ controller ? 'Changes saved instantly' : '2 changes · unsaved' }}</span>
        <Button variant="secondary">Reset</Button>
        <Button v-if="!controller" variant="primary" @click="showSavedToast">Save</Button>
      </template>
    </Drawer>

    <!-- ─── Toolbar (FAB) ─── -->
    <Toolbar v-if="showToolbar" />

    <!-- ─── Toast — always rendered (visibility driven by store) ─── -->
    <Toast />
  </div>
</template>

<style scoped>
.alph-app {
  /* The wrapper itself is invisible; surfaces position themselves. */
  pointer-events: none;
}
.alph-app__popup-wrap {
  /* Stage 2: popup floats fixed near top-right for preview. Stage 4 will
   * pin it to the actual selection rect. */
  position: fixed;
  top: 96px; right: 32px;
  z-index: 40;
  pointer-events: auto;
}
.alph-app__page-stub {
  padding: 24px;
  text-align: center;
  color: var(--on-surface-variant);
  font-size: 12px;
}
.alph-app__page-stub code {
  background: var(--surface-container);
  padding: 1px 6px; border-radius: 3px;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
}

/* Footer meta text — the per-page status string left-aligned in the footer. */
.alph-app__footer-meta {
  flex: 1;
  font-size: 10px;
  color: var(--on-surface-variant);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Footer button width tuning. The block primary takes the remaining row,
 * the icon-only secondaries are sized to comfortably fit a 14 px Icon SVG
 * with breathing space (40 × 38 — wider than tall so strokes don't graze
 * the rounded border).
 *
 * Stage 3: many pages mix icon-only secondaries with text-bearing
 * secondaries, so the universal "icon button = 40×38" rule no longer
 * applies. We only normalise the 100%-width primary on the lookup page;
 * other secondary buttons follow the Button primitive's default sizing
 * (38 × auto). */
:deep(.alph-drawer__footer) .alph-btn--secondary {
  height: 32px;
  padding: 0 10px;
  font-size: 10px;
}
</style>
