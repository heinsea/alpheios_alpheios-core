import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildWordListGroups,
  csvForWordList,
  resolveLookupLanguageCode,
  lookupLanguageItems,
  selectLookupLanguage,
  shortMeaningFromWordItem
} from '../src/lib/wordlist-helpers.js'

test('shortMeaningFromWordItem extracts short definitions from saved homonym lexemes', () => {
  const item = {
    targetWord: 'memoro',
    homonym: {
      lexemes: [
        {
          meaning: {
            shortDefs: [
              { text: 'remember' },
              { text: 'mention, recount' }
            ]
          }
        }
      ]
    }
  }

  assert.equal(shortMeaningFromWordItem(item), 'remember; mention, recount')
})

test('buildWordListGroups uses short meaning as the row secondary text', () => {
  const groups = buildWordListGroups({
    wordLists: {
      lat: {
        values: [
          {
            targetWord: 'memoro',
            languageCode: 'lat',
            homonym: {
              lexemes: [
                { lemma: { word: 'memoro' }, meaning: { shortDefs: [{ text: 'remember' }] } }
              ]
            },
            context: [{}, {}]
          }
        ]
      }
    },
    langNameFor: () => 'Latin'
  })

  assert.equal(groups[0].words[0].form, 'memoro')
  assert.equal(groups[0].words[0].meaning, 'remember')
  assert.equal(groups[0].words[0].pos, 'memoro')
  assert.equal(groups[0].words[0].ctx, 2)
})

test('lookupLanguageItems maps legacy setting values into select options', () => {
  const option = {
    values: [
      { value: 'lat', text: 'Latin' },
      { value: 'grc', text: 'Greek' }
    ],
    currentValue: 'lat'
  }

  assert.deepEqual(lookupLanguageItems(option), [
    { value: 'lat', label: 'Latin' },
    { value: 'grc', label: 'Greek' }
  ])
})

test('selectLookupLanguage follows legacy setTextValue and store commit path', () => {
  const calls = []
  const option = {
    currentValue: 'lat',
    setTextValue (text) {
      calls.push(text)
      this.currentValue = text === 'Greek' ? 'grc' : text
    }
  }
  const store = {
    commit (name, value) {
      calls.push([name, value])
    }
  }

  const selected = selectLookupLanguage({ option, store, selectedText: 'Greek' })

  assert.equal(selected, 'grc')
  assert.deepEqual(calls, ['Greek', ['app/setSelectedLookupLang', 'grc']])
})

test('resolveLookupLanguageCode keeps an explicit v3 selection before store/default language', () => {
  assert.equal(resolveLookupLanguageCode({
    selectedRefValue: 'grc',
    storeState: { selectedLookupLangCode: '', currentLanguageCode: 'lat' },
    option: { currentValue: 'lat' }
  }), 'grc')
})

test('csvForWordList exports words with definitions for flashcard import', () => {
  const csv = csvForWordList([
    { form: 'memoro', meaning: 'remember; mention, recount' }
  ])

  assert.equal(csv, 'word\tdefinition\nmemoro\tremember; mention, recount')
})
