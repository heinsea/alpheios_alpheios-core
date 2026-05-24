/**
 * use-app-controller — provide / inject helpers for the alpheios-core
 * AppController instance.
 *
 * Stage 4a wires `content-v3.js` to instantiate AppController + AuthModule,
 * then passes the instance into mount() which calls
 * `app.provide(APP_CONTROLLER_KEY, appController)`. Pages and surfaces inside
 * the v3 tree can then call `useAppController()` to read it. The Sandbox
 * preview environment never provides one, so this composable returns
 * `null` there — pages must render explicit empty/unavailable states when
 * the controller is missing.
 *
 * We deliberately use a Symbol key so an outsider can't accidentally
 * overwrite the binding via string-keyed provide().
 */

import { inject } from 'vue'

export const APP_CONTROLLER_KEY = Symbol('alpheios:appController')

/**
 * @returns {object|null} The injected AppController, or null when running
 *   outside an extension context (Sandbox, unit tests).
 */
export function useAppController () {
  return inject(APP_CONTROLLER_KEY, null)
}

/**
 * Convenience: get the Vuex store (Vuex 3) attached to the controller.
 * Returns null when the controller is not provided.
 *
 * The Vuex store is exposed on the controller as `_store` — there is no
 * public getter in alpheios-core's AppController for this. We accept the
 * underscore-prefixed access here so consumers don't have to repeat the
 * comment about why they're poking a private field. Stage 5 should land a
 * `controller.store` getter upstream.
 */
export function useStore () {
  const c = useAppController()
  return c ? c._store : null
}
