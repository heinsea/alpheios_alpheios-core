<template>
  <div class="alpheios-ui-options__cont">
    <font-size></font-size>
    <div class="alpheios-ui-options__popup-size-item" v-show="!isMobile">
      <label
          class="alpheios-ui-options__popup-size-item_top-label"
          for="alpheios-ui-options-popup-max-width"
      >{{uiOptions.items.maxPopupWidth.labelText}}</label>
      <input
          type="range"
          id="alpheios-ui-options-popup-max-width"
          v-model="maxPopupWidth"
          name="volume"
          :min="uiOptions.items.maxPopupWidth.values.min"
          :max="uiOptions.items.maxPopupWidth.values.max"
          :step="uiOptions.items.maxPopupWidth.values.step"
      >
      <label
          class="alpheios-ui-options__popup-size-item_bottom-label"
          for="alpheios-ui-options-popup-max-width"
      >
        <span class="alpheios-ui-options__popup-size-item_bottom-label-item">{{uiOptions.items.maxPopupWidth.labels.min}}</span>
        <span class="alpheios-ui-options__popup-size-item_bottom-label-item">{{uiOptions.items.maxPopupWidth.labels.mid}}</span>
        <span class="alpheios-ui-options__popup-size-item_bottom-label-item">{{uiOptions.items.maxPopupWidth.labels.max}}</span>
      </label>
    </div>

    <setting
        :classes="['alpheios-ui-options__item']"
        :data="uiOptions.items.panelPosition"
        @change="uiOptionChanged"
    >
    </setting>
    <setting
        :classes="['alpheios-ui-options__item']"
        :data="uiOptions.items.hideLoginPrompt"
        @change="uiOptionChanged"
    >
    </setting>

    <!-- useLegacyUI is an extension-level preference stored in
         browser.storage.local, not an alpheios settings option.
         Rendered as a standalone checkbox outside the <setting> flow. -->
    <div class="alpheios-ui-options__item alpheios-legacy-ui-toggle" v-if="legacyUILoaded">
      <label class="alpheios-setting__label">Use legacy UI</label>
      <div class="alpheios-checkbox-block alpheios-setting__control">
        <input type="checkbox" v-model="useLegacyUI" id="alpheios-ui-legacy-toggle">
        <label for="alpheios-ui-legacy-toggle">Yes
          <span class="alpheios-legacy-ui-note">(takes effect on next page load)</span>
        </label>
      </div>
    </div>
  </div>
</template>
<script>
import { Options } from 'alpheios-data-models'

import FontSize from './font-size.vue'
import Setting from './setting.vue'
import DependencyCheck from '@/vue/vuex-modules/support/dependency-check.js'

export default {
  name: 'UISettings',
  // API modules that are required for this component
  inject: {
    app: 'app',
    l10n: 'l10n',
    settings: 'settings'
  },
  storeModules: ['app', 'ui'], // Store modules that are required by this component
  mixins: [DependencyCheck],
  components: {
    setting: Setting,
    fontSize: FontSize
  },
  data: function () {
    return {
      maxPopupWidth: this.settings.getUiOptions().items.maxPopupWidth.currentValue,
      useLegacyUI: false,
      legacyUILoaded: false
    }
  },
  computed: {
    isMobile: function () {
      return Boolean(this.app && this.app.platform && this.app.platform.isMobile)
    },

    uiOptions: function () {
      return this.settings.getUiOptions()
    }
  },
  watch: {
    maxPopupWidth: function (value) {
      this.settings.uiOptionChange('maxPopupWidth', value)
    },
    useLegacyUI: function (value) {
      if (this._legacyUIReady) {
        try {
          var b = (typeof browser !== 'undefined' && browser) || (typeof window !== 'undefined' && window.browser)
          if (b && b.storage && b.storage.local) {
            b.storage.local.set({ useLegacyUI: value })
          }
        } catch (_) { /* swallow */ }
      }
    }
  },
  mounted: function () {
    var self = this
    try {
      var b = (typeof browser !== 'undefined' && browser) || (typeof window !== 'undefined' && window.browser)
      if (b && b.storage && b.storage.local) {
        b.storage.local.get('useLegacyUI').then(function (stored) {
          if (stored && typeof stored.useLegacyUI === 'boolean') {
            self.useLegacyUI = stored.useLegacyUI
          }
          self._legacyUIReady = true
          self.legacyUILoaded = true
        }).catch(function () {
          self._legacyUIReady = true
          self.legacyUILoaded = true
        })
      } else {
        self._legacyUIReady = true
        self.legacyUILoaded = true
      }
    } catch (_) {
      self._legacyUIReady = true
      self.legacyUILoaded = true
    }
  },
  methods: {
    uiOptionChanged: function (name, value) {
      const keyinfo = Options.parseKey(name)
      this.settings.uiOptionChange(keyinfo.name, value)
    }
  }
}
</script>
<style lang="scss">
  @import "../../styles/variables";
  .alpheios-ui-options__cont {
    display: flex;
    flex-direction: column;
  }

  .alpheios-ui-options__item {
    margin-bottom: textsize(15px);
    display: flex;
    align-items: flex-start;
    flex: 1 1 auto;
  }

  .alpheios-ui-options__popup-size-item {
    display: flex;
    flex-direction: column;
    margin-bottom: textsize(20px);

    &_top-label {
      margin-bottom: textsize(5px);
    }

    &_bottom-label {
      // Needs an `important!` to override styles on https://scaife.perseus.org
      display: flex !important;
      justify-content: space-between;
    }
  }

  .alpheios-legacy-ui-note {
    font-size: textsize(10px);
    color: var(--alpheios-desktop-panel-icon-color);
    font-style: italic;
    margin-left: 4px;
  }
</style>
