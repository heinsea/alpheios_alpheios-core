import { createApp } from 'vue'
import Sandbox from './Sandbox.vue'
import App from './App.vue'
import './tokens/tokens.css'
import './tokens/fonts.css'

function shouldMountAppPreview () {
  const params = new URL(window.location.href).searchParams
  return params.has('alpheios') || params.has('surface') || params.has('page') || params.has('state')
}

createApp(shouldMountAppPreview() ? App : Sandbox).mount('#sandbox-root')
