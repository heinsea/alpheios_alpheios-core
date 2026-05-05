import test from 'node:test'
import assert from 'node:assert/strict'

import { buildGrammarData } from '../src/lib/resources-helpers.js'

test('buildGrammarData uses the selected language grammar URL instead of the Latin fallback', () => {
  const data = buildGrammarData({
    langCode: 'grc',
    langName: 'Greek',
    grammarEntry: {
      provider: 'Smyth',
      url: 'https://grammars.alpheios.net/smyth/index.html'
    },
    hasLookup: true
  })

  assert.equal(data.language, 'Greek')
  assert.equal(data.browserUrl, 'https://grammars.alpheios.net/smyth/index.html')
  assert.equal(data.sources[0].title, 'Smyth')
})

test('buildGrammarData does not show Latin grammar when another language has no grammar URL', () => {
  const data = buildGrammarData({
    langCode: 'ara',
    langName: 'Arabic',
    grammarEntry: null,
    hasLookup: true
  })

  assert.equal(data.language, 'Arabic')
  assert.equal(data.browserUrl, '')
  assert.equal(data.sourceCount, 0)
})
