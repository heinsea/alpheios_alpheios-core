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

import { ref, computed, onMounted, onScopeDispose, watch } from 'vue'

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
import {
  lookupLanguageItems,
  resolveLookupLanguageCode,
  selectLookupLanguage
} from './lib/wordlist-helpers.js'
import { buildGrammarData } from './lib/resources-helpers.js'
import { buildTreebankResource } from './lib/treebank-data.js'
import { getSentence as getTreebankSentence } from './lib/treebank-service.js'

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
const USE_TREEBANK_API = true

// Treebank sentence state (loaded on demand via treebank-service)
const treebankSentence = ref(null)
const treebankSource = ref(null)
const treebankLoading = ref(false)
const treebankError = ref(null)

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
          { id: 'hideLogin', kind: 'toggle', label: 'Hide login prompt', value: false },
          { id: 'useClassicUI', kind: 'toggle', label: 'Use classic UI', value: false, help: 'Switch to the classic Alpheios interface. Takes effect on the next page load.' }
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
    disclaimer: `This version is a community fork maintained at
<a href="https://github.com/heinsea/alpheios_alpheios-core" target="_blank">alpheios-core</a>
and <a href="https://github.com/heinsea/alpheios_webextension" target="_blank">webextension</a>,
based on the excellent work of the
<a href="https://github.com/alpheios-project/alpheios-core" target="_blank">Alpheios core library</a>
and <a href="https://github.com/alpheios-project/webextension" target="_blank">Alpheios browser extension</a>.
<br><br>
The Alpheios name, logo, and original codebase are the intellectual property of
Alpheios Project, Ltd. This fork is an independent, unofficial modification and is
not endorsed by, affiliated with, or supported by the Alpheios Project or its contributors.
All trademarks remain the property of their respective owners.`,
    about: [],
    footerMeta: 'Data layer status'
  }
}

const AUTH_SHELL = {
  loggedOut: {
    title: 'Sign in to sync',
    sub: 'Authentication is connected to the extension background service.',
    ctaLabel: 'Continue with Auth0',
    features: [
      { icon: 'sync',       title: 'Cross-device sync',    desc: 'Word lists and settings sync between your devices.' },
      { icon: 'history',    title: 'Lookup history',       desc: 'Your word lookups are saved and searchable.' },
      { icon: 'bookmark',   title: 'Word list management', desc: 'Import, export, and review your saved words anywhere.' }
    ],
    footnote: 'By signing in you agree to the <a href="https://alpheios.net/pages/userterms" target="_blank">terms of service</a> and <a href="https://alpheios.net/pages/privacy-policy" target="_blank">privacy policy</a>.'
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
    shortDefinitions: definitionLine ? [definitionLine] : [],
    fullDefinitions: [],
    definitions: definitionLine ? [definitionLine] : [],
    citation: null,
    principalParts: [],
    providers: []
  }
}

const lookupActiveLang = computed(() => {
  // For success, use the homonym's actual language.
  // For loading / no-result / idle, use the currently selected lookup language.
  if (live.state.value === 'success' && live.data.value) return live.data.value.lang
  return selectedLookupLangLabel.value || 'Lookup'
})

const lookupData = computed(() => {
  if (live.state.value === 'success' && live.data.value) {
    return live.data.value
  }
  if (live.state.value === 'loading') {
    return emptyShape(live.targetWord.value, lookupActiveLang.value, 'Looking up…')
  }
  if (live.state.value === 'no-result') {
    return emptyShape(live.targetWord.value, lookupActiveLang.value,
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

const lookupLanguageOption = computed(() => controller && controller.api.settings
  ? controller.api.settings.getFeatureOptions().items.lookupLanguage
  : null
)
const lookupLanguageOptions = computed(() => lookupLanguageItems(lookupLanguageOption.value))
const selectedLookupLangValue = ref('')

/* ── Auto-detect language from text via Unicode script ── */
const SCRIPT_DETECT = [
  { range: /[\u0370-\u03FF\u1F00-\u1FFF]/, code: 'grc',  label: 'Greek' },
  { range: /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/, code: 'arafirst', label: '' },
  { range: /[\u2E80-\u2FDF\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/, code: 'zho', label: 'Chinese' },
  { range: /[\u1200-\u137F]/, code: 'gez',  label: 'Geez' },
  { range: /[\u0700-\u074F]/, code: 'syr',  label: 'Syriac' },
]
function detectLangFromText (text) {
  if (!text) return null
  for (const d of SCRIPT_DETECT) {
    if (d.range.test(text)) {
      // Arabic script is shared by Arabic and Persian — can't tell them
      // apart by character alone. Prefer the user's current selection if
      // it's one of them, otherwise default to Arabic.
      if (d.code === 'arafirst') {
        const cur = selectedLookupLang.value
        return { code: (cur === 'per' || cur === 'ara') ? cur : 'ara', label: cur === 'per' ? 'Persian' : 'Arabic' }
      }
      return d
    }
  }
  return null
}

const selectedLookupLang = computed(() => resolveLookupLanguageCode({
  selectedRefValue: selectedLookupLangValue.value,
  storeState: controller && controller._store && controller._store.state.app,
  option: lookupLanguageOption.value
}))
const selectedLookupLangLabel = computed(() => {
  const selected = lookupLanguageOptions.value.find(item => item.value === selectedLookupLang.value)
  return selected ? selected.label : selectedLookupLang.value
})

function onLookupLanguageChange (event) {
  if (!controller) return
  const code = event.target.value
  const option = lookupLanguageOptions.value.find(item => item.value === code)
  const selected = selectLookupLanguage({
    option: lookupLanguageOption.value,
    store: controller._store,
    selectedText: option ? option.label : code
  })
  selectedLookupLangValue.value = selected || code
}

function onSearchEnter (value) {
  if (!controller || !value || !value.trim()) return
  const text = value.trim()
  const s = controller._store.state.app
  const lookupLanguage = controller.api.settings &&
    controller.api.settings.getFeatureOptions().items.lookupLanguage

  // Auto-detect language from the input script FIRST, before any stored
  // preference — Greek text should always look up as Greek, etc.
  const detected = detectLangFromText(text)
  let code
  if (detected && lookupLanguageOptions.value.some(o => o.value === detected.code)) {
    code = detected.code
    // Sync the stored option so the dropdown reflects the auto-detected language
    selectLookupLanguage({
      option: lookupLanguage,
      store: controller._store,
      selectedText: detected.label
    })
    selectedLookupLangValue.value = code
  } else {
    // Latin-script text — use the stored preference
    code = resolveLookupLanguageCode({
      selectedRefValue: selectedLookupLangValue.value,
      storeState: s,
      option: lookupLanguage
    })
  }

  if (typeof controller.runLookup === 'function') {
    controller.runLookup(text, code)
  }
}

const wl = useWordList()
const infl = useInflections()
const resources = useResources({
  getLanguageCode: () => selectedLookupLang.value
})
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
  return buildGrammarData({
    langCode: selectedLookupLang.value,
    langName: selectedLookupLangLabel.value || lookupData.value.lang || 'current language',
    grammarEntry: null,
    hasLookup: live.state.value !== 'idle'
  })
}

async function loadTreebankFromAPI(docId, sentenceId) {
  if (!USE_TREEBANK_API) return null

  treebankLoading.value = true
  treebankError.value = null
  try {
    const { sentence, source } = await getTreebankSentence(docId, String(sentenceId), {
      providers: ['local', 'api', 'cdn', 'embedded']
    })
    if (!sentence) {
      treebankSentence.value = null
      treebankError.value = `Sentence ${sentenceId} of ${docId} is not available from any data source.`
      return null
    }
    treebankSentence.value = sentence
    treebankSource.value = source
    return sentence
  } catch (err) {
    console.warn('[App] Treebank load failed:', err)
    treebankSentence.value = null
    treebankError.value = err.message
    return null
  } finally {
    treebankLoading.value = false
  }
}

function liveTreeFallback () {
  if (USE_TREEBANK_API && treebankSentence.value) {
    return {
      ...buildTreebankResource(treebankSentence.value, { wordIds: [] }),
      officialReaderUrl: OFFICIAL_READER_URL,
      isOfficialTextsPage: false,
      suppressTree: false
    }
  }
  if (USE_TREEBANK_API && treebankError.value) {
    return {
      ref: '',
      textStrip: '',
      nodes: [],
      edges: [],
      footerMeta: treebankError.value,
      treebankSrc: null,
      officialReaderUrl: OFFICIAL_READER_URL,
      isOfficialTextsPage: false,
      suppressTree: false,
      kind: 'error'
    }
  }
  return {
    ref: '',
    textStrip: '',
    nodes: [],
    edges: [],
    footerMeta: 'Select a text to load treebank data',
    treebankSrc: null,
    officialReaderUrl: OFFICIAL_READER_URL,
    isOfficialTextsPage: false,
    suppressTree: false,
    kind: 'idle'
  }
}

/* ── Resources data: live data or explicit empty state ── */
const usagePageData = computed(() => ({
  usage: resources.usageData.value || liveUsageFallback()
}))

const grammarPageData = computed(() => ({
  grammar: resources.grammarData.value || liveGrammarFallback()
}))

const treePageData = computed(() => {
  const tree = resources.treeData.value || liveTreeFallback()
  // `loading` lets the tree panel show a spinner while a sentence request is
  // in flight but keep the previous tree visible (the nodes branch wins).
  return { tree: { ...tree, loading: !resources.treeData.value && treebankLoading.value } }
})

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
      await resources.refreshGrammar(selectedLookupLang.value)
    } catch { /* swallow */ }
  } else if (newPage === 'tree') {
    try {
      await resources.refreshTree()
    } catch { /* swallow */ }
  } else if (newPage === 'inflections') {
    store.state.app.hasInflData && infl.rebuild && infl.rebuild()
  }
})

watch(() => selectedLookupLang.value, async (langCode) => {
  if (!controller || page.value !== 'grammar' || !langCode) return
  try {
    await resources.refreshGrammar(langCode)
  } catch { /* swallow */ }
})

onMounted(() => {
  applyUrlOverrides()
})

// Mirror the Vuex 3 store's selectedLookupLangCode into the Vue 3 ref.
// Must use store.watch() because Vue 3's watch() cannot track Vuex 3 state.
onMounted(() => {
  const store = controller && controller._store
  if (!store) return
  const unwatch = store.watch(
    (st) => st.app.selectedLookupLangCode,
    (code) => {
      if (code && code !== selectedLookupLangValue.value) {
        selectedLookupLangValue.value = code
      }
    },
    { immediate: true }
  )
  onScopeDispose(() => { try { unwatch() } catch {} })
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
const drawerCollapseTarget = ref('popup')  // collapse always returns to popup lookup

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
function collapseDrawer () { uiStore.setSurface(drawerCollapseTarget.value) }
function expandToDrawer () {
  drawerCollapseTarget.value = uiStore.state.surface === 'popup' ? 'popup' : 'toolbar'
  uiStore.setSurface('drawer')
}
function openDrawerFromToolbar () {
  drawerCollapseTarget.value = 'popup'
}
function showAddedToast () {
  uiStore.showToast({
    kind: 'success',
    title: 'Added to your list',
    body: `${lookupData.value.lemma} · ${lookupData.value.lang} · just now`
  })
}
function addCurrentLookupToWordList () {
  if (!wl.addCurrentLookup()) {
    uiStore.showToast({
      kind: 'info',
      title: 'Nothing to add yet',
      body: 'Run a lookup first, then add the result to your list.'
    })
    return
  }
  showAddedToast()
}
async function importWordListFile (file) {
  const imported = await wl.importFile(file)
  uiStore.showToast(imported
    ? { kind: 'success', title: 'Word list imported' }
    : { kind: 'info', title: 'No words imported' }
  )
}
function exportWordList () {
  const exported = wl.exportList()
  uiStore.showToast(exported
    ? { kind: 'success', title: 'Word list exported' }
    : { kind: 'info', title: 'No saved words to export' }
  )
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
function syncAuth () {
  if (authPageRef.value && typeof authPageRef.value.sync === 'function') {
    authPageRef.value.sync()
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
const grammarFooterMetaLive = ref('')
const grammarFooterMeta = computed(() =>
  grammarFooterMetaLive.value || grammarPageData.value.grammar.footerMeta
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
        @add="addCurrentLookupToWordList"
        @retry="showRetryToast"
      />
    </div>

    <!-- ─── Drawer ─── -->
    <Drawer
      v-if="showDrawer"
      :lang="langLabel"
      @close="closeAll"
      @collapse="collapseDrawer"
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
            <select
              v-if="lookupLanguageOptions.length"
              class="alph-app__lookup-lang"
              :value="selectedLookupLang"
              :title="`Lookup language: ${selectedLookupLangLabel}`"
              @change="onLookupLanguageChange"
            >
              <option
                v-for="item in lookupLanguageOptions"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select>
            <Chip v-else variant="filled">{{ lookupData.lang }}</Chip>
          </template>
        </RecessedInput>
      </template>

      <!-- Body — page router -->
      <LookupPage      v-if="page === 'lookup'"      :data="lookupData" />
      <MorphPage       v-else-if="page === 'morph'"  :data="lookupData" />
      <InflectionsPage v-else-if="page === 'inflections'" :data="inflectionsData" />
      <ResourcesPage   v-else-if="page === 'usage'"  mode="usage"   :data="usagePageData" />
      <ResourcesPage   v-else-if="page === 'tree'"   mode="tree"    :data="treePageData" @load-treebank="loadTreebankFromAPI" />
      <ResourcesPage   v-else-if="page === 'grammar'" mode="grammar" :data="grammarPageData" @footer-meta="grammarFooterMetaLive = $event" />
      <WordListPage
        v-else-if="page === 'wordlist'"
        :data="wordlistData"
        @select-word="(p) => wl.selectWord(p.langCode, p.targetWord)"
        @import-file="importWordListFile"
        @export-list="exportWordList"
      />
      <AuthPage        v-else-if="page === 'user'"   ref="authPageRef" :data="AUTH_SHELL" />
      <SettingsPage    v-else-if="page === 'opts'"   ref="settingsPageRef" :data="SETTINGS_SHELL" />
      <div v-else class="alph-app__page-stub">
        <p>Unknown page <code>{{ page }}</code>.</p>
      </div>

      <!-- Footer — varies per page -->
      <template v-if="page === 'lookup'" #footer>
        <Button variant="primary" block @click="addCurrentLookupToWordList">
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
        <span class="alph-app__footer-meta" :title="grammarFooterMeta">{{ grammarFooterMeta }}</span>
      </template>

      <template v-else-if="page === 'wordlist'" #footer>
        <span class="alph-app__footer-meta">{{ wordlistData.list.footerMeta }}</span>
        <Button variant="primary" @click="exportWordList">Export all</Button>
      </template>

      <template v-else-if="page === 'user'" #footer>
        <span class="alph-app__footer-meta">{{ authFooterMeta }}</span>
        <Button variant="secondary" @click="syncAuth"><Icon name="cloud_sync" :size="14" /> Sync</Button>
        <Button variant="secondary" @click="logoutAuth"><Icon name="logout" :size="14" /> Log out</Button>
      </template>

      <template v-else-if="page === 'opts'" #footer>
        <span class="alph-app__footer-meta">{{ settingsFooterMeta }}</span>
        <Button variant="secondary" @click="resetSettings">Reset</Button>
        <Button v-if="!controller" variant="primary" @click="showSavedToast">Save</Button>
      </template>
    </Drawer>

    <!-- ─── Toolbar (FAB) ─── -->
    <Toolbar v-if="showToolbar" @open="openDrawerFromToolbar" />

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
  /* Popup manages its own position (drag + default top-right anchor).
   * The wrap only provides the stacking context. */
  position: fixed;
  top: 0; left: 0;
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

.alph-app__lookup-lang {
  max-width: 118px;
  height: 24px;
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius);
  background: var(--surface-container-lowest);
  color: var(--on-surface);
  font: inherit;
  font-size: 11px;
  padding: 0 22px 0 8px;
  cursor: pointer;
}
.alph-app__lookup-lang:focus {
  outline: 1px solid var(--primary);
  outline-offset: 1px;
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
