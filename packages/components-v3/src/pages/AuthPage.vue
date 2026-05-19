<script setup>
/**
 * AuthPage — DESIGN §7 + mockup drawer-auth.html.
 *
 * Two states:
 *   loggedOut — feature pitch + Auth0 CTA
 *   loggedIn  — avatar + email + plan chip + 3 stat cards + recent
 *               activity + active sessions list.
 *
 * When an AppController is available (live auth), state is driven by the
 * Vuex auth store. In sandbox mode (no controller) a local flip() toggles
 * between the two states for demo purposes.
 */

import { ref, computed, onMounted, onScopeDispose } from 'vue'
import Button from '../primitives/Button.vue'
import Chip from '../primitives/Chip.vue'
import Icon from '../primitives/Icon.vue'
import StatCard from '../primitives/StatCard.vue'
import { useAppController } from '../composables/use-app-controller.js'

const props = defineProps({
  data: { type: Object, required: true }
})

const controller = useAppController()

const state = ref('loggedOut')
const authState = ref(null)
const liveUserData = ref(null)
const authLoading = ref(false)
const authError = ref('')

async function loginIn () {
  if (!controller) { state.value = 'loggedIn'; return }
  authLoading.value = true
  authError.value = ''
  try {
    await controller.api.auth.authenticate()
    // On success the Vuex watcher flips state → loggedIn
  } catch (err) {
    authError.value = (err && err.message)
      ? err.message
      : 'Authentication failed. Please try again.'
  } finally {
    authLoading.value = false
  }
}

async function logout () {
  if (!controller) { state.value = 'loggedOut'; return }
  try {
    await controller.api.auth.logout()
  } catch { /* swallow */ }
}

function flip () { state.value = state.value === 'loggedOut' ? 'loggedIn' : 'loggedOut' }

const out = computed(() => props.data.loggedOut)

const inn = computed(() => {
  if (authState.value && authState.value.isAuthenticated) {
    const displayName = authState.value.userNickName || authState.value.userId || props.data.loggedIn.name
    const userMeta = authState.value.userId || props.data.loggedIn.email
    const endpoints = liveUserData.value && liveUserData.value.endpoints
    const exp = authState.value.expirationDateTime
    const sessionTxt = exp
      ? new Date(exp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—'
    return {
      ...props.data.loggedIn,
      avatarInitials: (displayName || '?').charAt(0).toUpperCase(),
      name: displayName,
      email: userMeta,
      plan: 'Alpheios user',
      stats: [
        { value: endpoints ? Object.keys(endpoints).length : 0, label: 'Endpoints' },
        { value: sessionTxt, label: 'Session until' },
        { value: authState.value.isSessionExpired ? 'Expired' : 'Current', label: 'Status' }
      ],
      activity: props.data.loggedIn.activity,
      sessions: props.data.loggedIn.sessions
    }
  }
  return props.data.loggedIn
})

const footerMeta = computed(() =>
  state.value === 'loggedIn' ? inn.value.lastSync : ''
)

/* ── Vuex auth watcher ── */
let unwatchAuth = null
onMounted(() => {
  if (controller) {
    // Restore any existing session
    try { controller.api.auth.session() } catch { /* swallow */ }
    unwatchAuth = controller._store.watch(
      (st) => st.auth && {
        isAuthenticated: st.auth.isAuthenticated,
        isSessionExpired: st.auth.isSessionExpired,
        userId: st.auth.userId,
        userNickName: st.auth.userNickName,
        expirationDateTime: st.auth.expirationDateTime,
        notification: st.auth.notification
      },
      (nextAuthState) => {
        authState.value = nextAuthState
        if (nextAuthState && nextAuthState.isAuthenticated) {
          state.value = 'loggedIn'
          authLoading.value = false
          authError.value = ''
          controller.api.auth.getUserData().then(d => {
            liveUserData.value = d || null
          }).catch(() => {})
        } else {
          state.value = 'loggedOut'
          liveUserData.value = null
          // Show login-failure notification text as error, if present
          const n = nextAuthState && nextAuthState.notification
          if (n && n.text && n.visible && n.text.toLowerCase().indexOf('fail') > -1) {
            authError.value = n.text
          }
        }
      },
      { immediate: true }
    )
  }
})

onScopeDispose(() => {
  if (unwatchAuth) { try { unwatchAuth() } catch { /* swallow */ } }
})

defineExpose({ footerMeta, state, loginIn, logout, flip })
</script>

<template>
  <div class="alph-auth">

    <!-- ============ LOGGED-OUT ============ -->
    <template v-if="state === 'loggedOut'">
      <div class="alph-auth__hero">
        <div class="alph-auth__icon-wrap">
          <Icon name="login" :size="22" />
        </div>
        <h2 class="alph-auth__title">{{ out.title }}</h2>
        <p class="alph-auth__sub">{{ out.sub }}</p>

        <ul class="alph-auth__features">
          <li v-for="f in out.features" :key="f.title" class="alph-auth__feature">
            <Icon :name="f.icon" :size="14" class="alph-auth__feature-icon" />
            <div class="alph-auth__feature-body">
              <strong>{{ f.title }}</strong>
              <span>{{ f.desc }}</span>
            </div>
          </li>
        </ul>

        <button
          class="alph-auth__cta"
          :class="{ 'alph-auth__cta--loading': authLoading }"
          :disabled="authLoading"
          @click="loginIn"
        >
          <span v-if="authLoading" class="alph-auth__cta-spinner" />
          <Icon v-else name="login" :size="14" />
          {{ authLoading ? 'Signing in…' : out.ctaLabel }}
        </button>

        <p v-if="authError" class="alph-auth__error">
          <Icon name="error" :size="12" />
          {{ authError }}
        </p>

        <p class="alph-auth__foot" v-html="out.footnote" />
      </div>
    </template>

    <!-- ============ LOGGED-IN ============ -->
    <template v-else>
      <div class="alph-auth__profile">
        <div class="alph-auth__avatar">{{ inn.avatarInitials }}</div>
        <div class="alph-auth__profile-meta">
          <h2 class="alph-auth__name">{{ inn.name }}</h2>
          <p class="alph-auth__email">{{ inn.email }}</p>
          <span class="alph-auth__plan">
            <Icon name="verified" :size="12" />
            {{ inn.plan }}
          </span>
        </div>
      </div>

      <div class="alph-auth__stats">
        <StatCard v-for="s in inn.stats" :key="s.label" :value="s.value" :label="s.label" />
      </div>

      <header class="alph-auth__h-section">Recent activity</header>
      <article v-for="(a, i) in inn.activity" :key="i" class="alph-auth__activity">
        <span class="alph-auth__activity-icon"><Icon :name="a.icon" :size="12" /></span>
        <div class="alph-auth__activity-body">
          <p class="alph-auth__activity-text" v-html="a.html" />
          <span class="alph-auth__activity-when">{{ a.when }}</span>
        </div>
      </article>

      <header class="alph-auth__h-section">Active sessions</header>
      <div v-for="(s, i) in inn.sessions" :key="i" class="alph-auth__session">
        <span class="alph-auth__activity-icon"><Icon :name="s.icon" :size="12" /></span>
        <div class="alph-auth__session-body">
          <div class="alph-auth__session-name">{{ s.name }}</div>
          <div class="alph-auth__session-meta">{{ s.meta }}</div>
        </div>
        <Chip v-if="s.current" variant="tertiary">This device</Chip>
        <Button v-else variant="secondary">Sign out</Button>
      </div>

      <p v-if="!controller" class="alph-auth__demo-hint">
        Demo: <a @click.prevent="flip">switch to logged-out</a>
      </p>
      <p v-else class="alph-auth__demo-hint">
        <Icon name="verified" :size="10" /> live auth wired
      </p>
    </template>
  </div>
</template>

<style scoped>
.alph-auth { font-size: 12px; color: var(--on-surface); }

/* ── Logged out ── */
.alph-auth__hero {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
  padding: 24px 24px 32px;
  gap: 16px;
}
.alph-auth__icon-wrap {
  width: 64px; height: 64px;
  border-radius: var(--radius-2xl);
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--on-surface);
}
.alph-auth__title {
  margin: 0;
  font-size: 18px; font-weight: 600;
  letter-spacing: -0.02em;
}
.alph-auth__sub {
  margin: 0;
  font-size: 12px; line-height: 18px;
  color: var(--on-surface-variant);
  max-width: 30ch;
}
.alph-auth__features {
  width: 100%; max-width: 280px;
  margin: 4px 0;
  padding: 0;
  list-style: none;
  text-align: left;
}
.alph-auth__feature {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 6px 0;
  font-size: 12px;
}
.alph-auth__feature-icon {
  color: var(--tertiary);
  flex-shrink: 0;
  margin-top: 2px;
}
.alph-auth__feature-body strong {
  display: block;
  font-weight: 600;
  margin-bottom: 1px;
}
.alph-auth__feature-body span {
  color: var(--on-surface-variant);
  font-size: 11px;
}

.alph-auth__cta {
  background: var(--primary);
  color: var(--on-primary);
  border: 0;
  border-radius: var(--radius-lg);
  padding: 12px 24px;
  font-family: inherit;
  font-size: 12px; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; max-width: 280px;
  transition: opacity var(--motion-fast);
}
.alph-auth__cta:hover { opacity: 0.92; }
.alph-auth__cta:disabled { opacity: 0.7; cursor: not-allowed; }

.alph-auth__cta-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: alph-auth-spin 0.6s linear infinite;
  display: inline-block;
  flex-shrink: 0;
}
@keyframes alph-auth-spin { to { transform: rotate(360deg); } }

.alph-auth__error {
  display: flex; align-items: center; gap: 6px;
  max-width: 280px; width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-lg);
  background: var(--error-container);
  color: var(--on-error-container);
  font-size: 11px; line-height: 16px;
  margin: 0;
}

.alph-auth__foot {
  margin: 0;
  font-size: 10px;
  color: var(--on-surface-variant);
  letter-spacing: 0.05em;
}
.alph-auth__foot :deep(a) {
  color: var(--on-surface);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
}

/* ── Logged in ── */
.alph-auth__profile {
  display: flex; align-items: center; gap: 14px;
  padding: 24px 16px 16px;
}
.alph-auth__avatar {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2c2e30, #5e5e5e);
  color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 600;
  letter-spacing: -0.01em;
  flex-shrink: 0;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
}
.alph-auth__profile-meta { flex: 1; min-width: 0; }
.alph-auth__name {
  margin: 0 0 2px;
  font-size: 16px; font-weight: 600;
  letter-spacing: -0.01em;
}
.alph-auth__email {
  margin: 0;
  font-size: 11px;
  color: var(--on-surface-variant);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.alph-auth__plan {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--tertiary-container);
  color: var(--tertiary);
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase;
  padding: 2px 8px; border-radius: var(--radius-full);
  margin-top: 4px;
}

.alph-auth__stats {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 8px 12px;
}
.alph-auth__stats :deep(.alph-stat-card) { padding: 10px 12px; }

.alph-auth__h-section {
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--on-surface-variant);
  padding: 14px 12px 6px;
}

.alph-auth__activity {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  border-top: 1px solid var(--divider);
}
.alph-auth__activity:first-of-type { border-top: 0; }
.alph-auth__activity-icon {
  width: 28px; height: 28px;
  border-radius: var(--radius-md);
  background: var(--surface-container);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--on-surface-variant);
  flex-shrink: 0;
}
.alph-auth__activity-body { flex: 1; min-width: 0; }
.alph-auth__activity-text {
  margin: 0;
  font-size: 12px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.alph-auth__activity-text :deep(.lang-classical) { font-style: italic; font-size: 13px; }
.alph-auth__activity-when {
  font-size: 10px;
  color: var(--on-surface-variant);
  margin-top: 1px;
}

.alph-auth__session {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  border-top: 1px solid var(--divider);
}
.alph-auth__session:first-of-type { border-top: 0; }
.alph-auth__session-body { flex: 1; min-width: 0; }
.alph-auth__session-name { font-size: 12px; font-weight: 500; }
.alph-auth__session-meta { font-size: 10px; color: var(--on-surface-variant); }
.alph-auth__session :deep(.alph-btn--secondary) { height: 28px; padding: 0 10px; font-size: 9px; }

.alph-auth__demo-hint {
  margin: 16px 12px;
  padding: 8px 12px;
  border: 1px dashed var(--outline-variant);
  border-radius: var(--radius-lg);
  font-size: 10px;
  color: var(--on-surface-variant);
  letter-spacing: 0.08em; text-transform: uppercase;
  text-align: center;
}
.alph-auth__demo-hint a { color: var(--on-surface); cursor: pointer; border-bottom: 1px solid currentColor; }
</style>
