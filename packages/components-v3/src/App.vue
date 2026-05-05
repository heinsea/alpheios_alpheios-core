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
 *             live data or explicit empty state objects. Footer slot content
 *             varies per page.
 * Stage 4:    wires real `useLookup()` etc. composables and
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

const EMPTY_POPUP_STATES = {
  loading: { lemma: '', lang: '', title: 'Looking up', desc: 'Alpheios is querying lexical data.' },
  noResult: {
    lemma: '',
    lang: '',
    title: 'No result',
    desc: 'No lexical entry was returned for this lookup.',
    links: []
  },
  error: {
    lemma: '',
    lang: '',
    banner: { title: 'Lookup failed', desc: 'The data layer reported an error.' },
    cachedPos: [],
    cachedDefs: []
  }
}

const EMPTY_INFLECTIONS = {
  matched: {
    lemma: '',
    pos: '',
    subhead: 'Run a lookup to load inflection data.',
    wordClass: 'noun',
    density: 'wide',
    filterChips: [{ id: 'all', label: 'All', active: true }],
    highlightMatches: true,
    table: { columns: [], rows: [], tfoot: '' },
    footnotes: [],
    credits: '',
    footerMeta: 'No inflection data'
  },
  browser: {
    language: '',
    languages: [],
    pos: '',
    posOptions: [],
    paradigm: '',
    paradigmOptions: [],
    paradigmMeta: '',
    voice: '',
    mood: '',
    preview: { columns: [], rows: [] },
    footerMeta: 'No browser data'
  }
}

const EMPTY_WORDLIST = {
  list: { groups: [], footerMeta: 'No saved words' },
  context: { word: '', lang: '', count: 0, items: [], footerMeta: 'No context selected' }
}

const OFFICIAL_READER_URL = 'https://texts.alpheios.net/text/urn%3Acts%3AlatinLit%3Aphi0959.phi006.alpheios-text-lat1/passage/1.163-1.183'
const OFFICIAL_GRAMMAR_URL = 'https://grammars.alpheios.net/allen-greenough/index.htm?ts=1777980366365#table-of-contents'

const SETTINGS_SHELL = {
  tabs: [
    { value: 'ui', label: 'UI' },
    { value: 'features', label: 'Features' },
    { value: 'resources', label: 'Resources' },
    { value: 'advanced', label: 'Advanced' }
  ],
  ui: {
    groups: [
      { title: 'Typography', rows: [{ id: 'fontSize', kind: 'slider', label: 'Font size', min: 12, max: 20, value: 16, unit: '' }] },
      {
        title: 'Layout',
        rows: [
          { id: 'panelPosition', kind: 'segInline', label: 'Panel position', value: 'right', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] },
          { id: 'popupMaxWidth', kind: 'slider', label: 'Popup max width', min: 400, max: 1200, value: 800, unit: '' },
          { id: 'hideLogin', kind: 'toggle', label: 'Hide login prompt', value: false }
        ]
      }
    ]
  },
  features: {
    groups: [
      { title: 'Lookup modules', rows: [
        { id: 'enableLemmaTranslations', kind: 'toggle', label: 'Latin lemma translations', value: false },
        { id: 'modUsage', kind: 'toggle', label: 'Word usage examples', value: true }
      ] }
    ]
  },
  resources: { groups: [], footerMeta: 'No resource options loaded' },
  advanced: {
    groups: [],
    danger: { name: 'Reset options', help: 'Restore configurable options to defaults.', label: 'Reset' },
    about: [],
    footerMeta: 'Data layer status'
  }
}

const AUTH_SHELL = {
  loggedOut: {
    title: 'Sign in to sync',
    sub: 'Authentication is connected to the extension background service.',
    ctaLabel: 'Continue',
    features: [],
    footnote: ''
  },
  loggedIn: {
    avatarInitials: '?',
    name: '',
    email: '',
    plan: 'Alpheios user',
    stats: [],
    activity: [],
    sessions: [],
    lastSync: 'Auth state loaded'
  }
}

/* ── Stage 4b live data wiring ──
 * `useLookup()` exposes a state machine: idle / loading / success /
 * no-result. lookupData branches on it so users can clearly tell whether
 * a query landed:
 *   idle      → explicit no-lookup state.
 *   loading   → echo the targetWord with a placeholder definition while
 *               the lexical request is in flight.
 *   success   → live homonym data only.
 *   no-result → echo the targetWord with an explicit "No entry found" line
 *               and recognized=false.
 */
const controller = useAppController()
const live = useLookup()

function emptyShape (lemma, lang, definitionLine) {
  return {
    lemma: lemma || '',
    lang: lang || '',
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
    return live.data.value
  }
  if (live.state.value === 'loading') {
    return emptyShape(live.targetWord.value, live.lang.value, 'Looking up…')
  }
  if (live.state.value === 'no-result') {
    return emptyShape(live.targetWord.value, live.lang.value,
      `No entry found for ${live.targetWord.value || 'this word'} in any lexicon.`)
  }
  if (!controller) {
    return emptyShape('', '', 'The Alpheios data controller is unavailable on this page.')
  }
  return emptyShape('', '', 'Run a lookup or select a word to load lexical data.')
})

/* Search input ref — auto-syncs to whatever target word a real lookup
 * produced. The user can still freely type and their typed value persists
 * until the next lookup overwrites it. */
const search = ref('')
watch(() => live.targetWord.value, (w) => { if (w) search.value = w })

function onSearchEnter (value) {
  if (!controller || !value || !value.trim()) return
  // Match v2 lookup.vue: typed lookups are driven by the lookup-language
  // option, not by the language of whatever homonym happened to be current.
  // Reusing currentLanguageCode first can send a Latin search like `quamquam`
  // to the wrong analyzer after a previous non-Latin lookup.
  const s = controller._store.state.app
  const lookupLanguage = controller.api.settings &&
    controller.api.settings.getFeatureOptions().items.lookupLanguage
  const code =
    s.selectedLookupLangCode ||
    (lookupLanguage && lookupLanguage.currentValue) ||
    s.currentLanguageCode ||
    'lat'
  if (typeof controller.runLookup === 'function') {
    controller.runLookup(value, code)
  }
}

const wl = useWordList()
const infl = useInflections()
const resources = useResources()
const settingsPageRef = ref(null)
const authPageRef = ref(null)

/* ── Inflections data: live matched data or explicit empty state ── */
const inflectionsData = computed(() => {
  if (infl.hasData.value && infl.matchedData.value) {
    return {
      matched: { ...EMPTY_INFLECTIONS.matched, ...infl.matchedData.value },
      browser: EMPTY_INFLECTIONS.browser
    }
  }
  return EMPTY_INFLECTIONS
})

/* ── Wordlist data: live groups/context or explicit empty state ── */
const wordlistData = computed(() => {
  const ctxData = wl.contextData.value
  const liveList = {
    ...EMPTY_WORDLIST.list,
    groups: wl.groups.value,
    footerMeta: `${wl.groups.value.reduce((s, g) => s + g.count, 0)} saved · ${wl.groups.value.length} languages`
  }
  if (ctxData) {
    return { list: wl.groups.value.length ? liveList : EMPTY_WORDLIST.list, context: ctxData }
  }
  if (wl.hasData.value && wl.groups.value.length) {
    return {
      list: liveList,
      context: {
        word: '',
        lang: '',
        count: 0,
        items: [],
        footerMeta: 'Select a saved word to view context'
      }
    }
  }
  return EMPTY_WORDLIST
})

function liveUsageFallback () {
  const word = live.targetWord.value || lookupData.value.lemma || ''
  const waiting = live.state.value === 'loading'
  const idle = live.state.value === 'idle'
  return {
    word,
    totalQuotes: 0,
    authorsCount: 0,
    filterAuthor: 'all',
    authorChips: [{ id: 'all', label: 'All authors', count: null }],
    groups: [],
    officialReaderUrl: OFFICIAL_READER_URL,
    isOfficialTextsPage: false,
    footerMeta: idle
      ? 'Look up a word to load usage examples'
      : waiting
        ? `${word || 'Lookup'} · loading usage examples`
        : `${word || 'Lookup'} · no usage examples`
  }
}

function liveGrammarFallback () {
  const lang = lookupData.value.lang || 'current language'
  return {
    language: lang,
    sourceCount: 0,
    linkedFrom: live.state.value === 'idle'
      ? 'Look up a word to load grammar resources.'
      : 'No grammar reference available for this lookup.',
    sources: [],
    browserUrl: OFFICIAL_GRAMMAR_URL,
    reading: {
      anchor: 'Grammar',
      title: live.state.value === 'idle' ? 'No lookup yet' : 'No grammar reference available',
      blocks: [
        {
          type: 'p',
          html: live.state.value === 'idle'
            ? 'Run a lookup first, then open Grammar again.'
            : 'Alpheios did not return a grammar resource for the current language and selection.'
        }
      ]
    },
    footerMeta: live.state.value === 'idle' ? 'No lookup yet' : 'No grammar data'
  }
}

function liveTreeFallback () {
  if (live.state.value === 'idle') {
    return {
      ref: '',
      textStrip: '',
      nodes: [],
      footerMeta: 'Look up or select a word to load treebank data',
      treebankSrc: null,
      officialReaderUrl: OFFICIAL_READER_URL,
      isOfficialTextsPage: false,
      suppressTree: false,
      kind: 'idle'
    }
  }
  return {
    ref: '',
    textStrip: '',
    nodes: [],
    footerMeta: 'No treebank for this page',
    treebankSrc: null,
    officialReaderUrl: OFFICIAL_READER_URL,
    isOfficialTextsPage: false,
    suppressTree: false,
    kind: 'no-metadata'
  }
}

/* ── Resources data: live data or explicit empty state ── */
const usagePageData = computed(() => ({
  usage: resources.usageData.value || liveUsageFallback()
}))

const grammarPageData = computed(() => ({
  grammar: resources.grammarData.value || liveGrammarFallback()
}))

const treePageData = computed(() => ({
  tree: resources.treeData.value || liveTreeFallback()
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
    case 'morph':       return lookupData.value.lang || 'Lookup'
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
    body: `${lookupData.value.lemma} · ${lookupData.value.lang} · just now`
  })
}
function showRetryToast () {
  uiStore.showToast({ kind: 'info', title: 'Retrying lookup…' })
}
function showSavedToast () {
  uiStore.showToast({ kind: 'success', title: 'Settings saved' })
}
function resetSettings () {
  if (settingsPageRef.value && typeof settingsPageRef.value.reset === 'function') {
    settingsPageRef.value.reset()
  }
}
function logoutAuth () {
  if (authPageRef.value && typeof authPageRef.value.logout === 'function') {
    authPageRef.value.logout()
  }
}
const settingsFooterMeta = computed(() =>
  settingsPageRef.value && settingsPageRef.value.footerMeta
    ? settingsPageRef.value.footerMeta
    : (controller ? 'No changes' : '2 changes · unsaved')
)
const authFooterMeta = computed(() =>
  authPageRef.value && authPageRef.value.footerMeta
    ? authPageRef.value.footerMeta
    : AUTH_SHELL.loggedIn.lastSync
)
</script>

<template>
  <div class="alph-app alpheios-v3-scope" :data-theme="uiStore.state.theme">

    <!-- ─── Popup ─── -->
    <div v-if="showPopup" class="alph-app__popup-wrap">
      <Popup
        :state="popupState"
        :data="lookupData"
        :empty-states="EMPTY_POPUP_STATES"
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
      <AuthPage        v-else-if="page === 'user'"   ref="authPageRef" :data="AUTH_SHELL" />
      <SettingsPage    v-else-if="page === 'opts'"   ref="settingsPageRef" :data="SETTINGS_SHELL" />
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
      </template>

      <template v-else-if="page === 'tree'" #footer>
        <span class="alph-app__footer-meta">{{ treePageData.tree.footerMeta }}</span>
        <Button variant="secondary"><Icon name="help" :size="14" /></Button>
      </template>

      <template v-else-if="page === 'grammar'" #footer>
        <span class="alph-app__footer-meta">{{ grammarPageData.grammar.footerMeta }}</span>
      </template>

      <template v-else-if="page === 'wordlist'" #footer>
        <span class="alph-app__footer-meta">{{ wordlistData.list.footerMeta }}</span>
        <Button variant="secondary">Import</Button>
        <Button variant="primary">Export all</Button>
      </template>

      <template v-else-if="page === 'user'" #footer>
        <span class="alph-app__footer-meta">{{ authFooterMeta }}</span>
        <Button variant="secondary"><Icon name="cloud_sync" :size="14" /> Sync</Button>
        <Button variant="secondary" @click="logoutAuth"><Icon name="logout" :size="14" /> Log out</Button>
      </template>

      <template v-else-if="page === 'opts'" #footer>
        <span class="alph-app__footer-meta">{{ settingsFooterMeta }}</span>
        <Button variant="secondary" @click="resetSettings">Reset</Button>
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
