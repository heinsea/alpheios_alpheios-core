<template>
    <div class="alpheios-definitions-panel">
        <div v-if="$store.getters['app/shortDefDataReady']">
            <div v-for="(definition, index) in formattedShortDefinitions"
                 :key="definition.ID || `short-def-${index}`"
                 class="alpheios-panel__contentitem">
                <shortdef
                    :definition="definition"
                    :languageCode="$store.state.app.languageCode"
                />
            </div>
        </div>

        <div v-if="$store.getters['app/fullDefDataReady']">
            <div v-for="(lexeme, lexemeIndex) in lexemesWithFullDefs"
                 :key="`lexeme-${lexeme.lemma.ID || lexeme.lemma.word || lexemeIndex}`"
                 class="alpheios-panel__contentitem alpheios-panel__contentitem-full-definitions">
                <h3 class="alpheios-full-definitions__lemma">{{ lexeme.lemma.word }}</h3>
                <div v-for="(fullDef, index) in lexeme.meaning.fullDefs"
                     :key="`full-def-${lexeme.lemma.ID || lexeme.lemma.word || lexemeIndex}-${index}`"
                     class="alpheios-full-definitions__definition"
                     v-html="fullDef.text"></div>
            </div>
        </div>

        <div v-else-if="showPlaceholder"
             class="alpheios-full-definitions__placeholder">
            {{ l10n.getText('PLACEHOLDER_DEFINITIONS') }}
        </div>
    </div>
</template>
<script>
  import { Definition } from 'alpheios-data-models'
  import ShortDef from '@/vue/components/shortdef.vue'

  export default {
    name: 'DefinitionsPanel',
    inject: ['app', 'l10n'],
    storeModules: ['app'],
    components: {
      shortdef: ShortDef
    },
    props: {
      showPlaceholder: {
        type: Boolean,
        default: false
      }
    },
    computed: {
      formattedShortDefinitions () {
        let definitions = []

        if (this.$store.getters['app/shortDefDataReady'] && this.$store.state.app.homonymDataReady) {
          for (const lexeme of this.app.getHomonymLexemes()) {
            if (lexeme.meaning.shortDefs.length > 0) {
              definitions.push(...lexeme.meaning.shortDefs)
            } else if (Object.entries(lexeme.lemma.features).length > 0) {
              definitions.push(new Definition(this.l10n.getMsg('TEXT_NOTICE_NO_DEFS_FOUND'), 'en-US', 'text/plain', lexeme.lemma.word))
            }
          }
        }
        return definitions
      },

      lexemesWithFullDefs () {
        if (this.$store.getters['app/fullDefDataReady'] && this.$store.state.app.homonymDataReady) {
          return this.app.getHomonymLexemes().filter(lexeme => lexeme.meaning.fullDefs.length > 0)
        }
        return []
      }
    }
  }
</script>
