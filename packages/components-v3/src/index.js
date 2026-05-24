/**
 * Public entry for alpheios-components-v3.
 *
 * The CSS imports below are *side-effect* — Vite extracts them into
 * `dist/style.css` so a single `<style>` injection covers tokens, fonts and
 * every component's scoped CSS. Consumers should still import the css
 * explicitly:
 *
 *     import 'alpheios-components-v3/style.css'
 *
 * Stage 0:    App, MountPlaceholder
 * Stage 1:    tokens / fonts (CSS-only) + 9 primitives
 * Stage 2:    4 surfaces + LookupPage + ui-store
 * Stage 3:    + 6 more pages (Morph, Inflections, WordList, Resources,
 *             Settings, Auth) routed by `uiStore.state.page` in App.vue.
 *             Resources is one component for the Usage / Grammar / Tree
 *             sub-modes (mockup `drawer-resources.html`).
 * Stage 4a:   + composables/use-app-controller — provide / inject helper
 *             for the alpheios-core AppController instance. content-v3.js
 *             instantiates the controller, mount.js provides it, pages
 *             call useAppController() to read it (Sandbox returns null).
 */

// CSS side effects — order: tokens → fonts → component scoped styles.
import './tokens/tokens.css'
import './tokens/fonts.css'

import App from './App.vue'
import MountPlaceholder from './MountPlaceholder.vue'

// Primitives
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

// Surfaces
import Popup from './surfaces/Popup.vue'
import Drawer from './surfaces/Drawer.vue'
import Toolbar from './surfaces/Toolbar.vue'
import Toast from './surfaces/Toast.vue'

// Pages
import LookupPage      from './pages/LookupPage.vue'
import MorphPage       from './pages/MorphPage.vue'
import InflectionsPage from './pages/InflectionsPage.vue'
import WordListPage    from './pages/WordListPage.vue'
import ResourcesPage   from './pages/ResourcesPage.vue'
import SettingsPage    from './pages/SettingsPage.vue'
import AuthPage        from './pages/AuthPage.vue'

// Store
import { uiStore, applyUrlOverrides, SURFACES, PAGES, POPUP_STATES } from './store/ui-store.js'

// Composables — Stage 4 data-layer bridges. Sandbox / unit-test consumers
// can ignore these; pages call `useAppController()` to read injected
// controller and gracefully render explicit empty states when it's null.
import { APP_CONTROLLER_KEY, useAppController, useStore } from './composables/use-app-controller.js'
import { useLookup } from './composables/use-lookup.js'
import { useWordList } from './composables/use-wordlist.js'
import { useInflections } from './composables/use-inflections.js'
import { useResources } from './composables/use-resources.js'

export {
  App,
  MountPlaceholder,
  // primitives
  Button,
  Toggle,
  Segmented,
  Chip,
  Slider,
  StatCard,
  ElevatedCard,
  RecessedInput,
  FrostedGlass,
  Icon,
  // surfaces
  Popup,
  Drawer,
  Toolbar,
  Toast,
  // pages
  LookupPage,
  MorphPage,
  InflectionsPage,
  WordListPage,
  ResourcesPage,
  SettingsPage,
  AuthPage,
  // store
  uiStore,
  applyUrlOverrides,
  SURFACES,
  PAGES,
  POPUP_STATES,
  // composables
  APP_CONTROLLER_KEY,
  useAppController,
  useStore,
  useLookup,
  useWordList,
  useInflections,
  useResources
}

export default App
