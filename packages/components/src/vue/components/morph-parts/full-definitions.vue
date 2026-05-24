<template>
    <div class="alpheios-full-definitions">
        <div v-if="$store.getters['app/fullDefDataReady']"
             class="alpheios-full-definitions__content">
            <div v-for="(lexeme, lexemeIndex) in lexemes"
                 :key="`lexeme-${lexeme.lemma.ID || lexeme.lemma.word || lexemeIndex}`"
                 class="alpheios-full-definitions__lexeme">
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
  export default {
    name: 'FullDefinitions',
    inject: ['app', 'l10n'],
    storeModules: ['app'],
    props: {
      showPlaceholder: {
        type: Boolean,
        default: false
      }
    },
    computed: {
      lexemes () {
        if (this.$store.getters['app/fullDefDataReady'] && this.$store.state.app.homonymDataReady) {
          return this.app.getHomonymLexemes().filter(lexeme => lexeme.meaning.fullDefs.length > 0)
        }
        return []
      }
    }
  }
</script>
