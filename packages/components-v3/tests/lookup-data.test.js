import test from 'node:test'
import assert from 'node:assert/strict'

import { projectDefinitionFields } from '../src/lib/lookup-data.js'

test('projects short and full definitions without mixing them', () => {
  const lexemes = [
    {
      meaning: {
        shortDefs: [{ text: 'Albanian' }],
        fullDefs: [{ text: 'A full Albanus dictionary entry' }]
      }
    }
  ]

  assert.deepEqual(projectDefinitionFields(lexemes), {
    shortDefinitions: ['Albanian'],
    fullDefinitions: ['A full Albanus dictionary entry'],
    definitions: ['Albanian']
  })
})

test('uses html definition content when text is absent', () => {
  const lexemes = [
    {
      meaning: {
        shortDefs: [{ html: '<span>Albanian</span>' }],
        fullDefs: [{ html: '<p>Complete dictionary text</p>' }]
      }
    }
  ]

  assert.deepEqual(projectDefinitionFields(lexemes), {
    shortDefinitions: ['<span>Albanian</span>'],
    fullDefinitions: ['<p>Complete dictionary text</p>'],
    definitions: ['<span>Albanian</span>']
  })
})

test('adds a visible short-definition fallback for recognized lexemes without definitions', () => {
  const lexemes = [
    {
      lemma: {
        word: 'Albanus',
        features: { part: { value: 'adjective' } }
      },
      meaning: {
        shortDefs: [],
        fullDefs: []
      }
    }
  ]

  assert.deepEqual(projectDefinitionFields(lexemes, { noDefinitionsText: 'No definitions found' }), {
    shortDefinitions: ['No definitions found'],
    fullDefinitions: [],
    definitions: ['No definitions found']
  })
})
