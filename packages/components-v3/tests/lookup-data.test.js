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
    shortDefinitions: [{ html: 'Albanian', morphology: '' }],
    fullDefinitions: ['A full Albanus dictionary entry'],
    definitions: [{ html: 'Albanian', morphology: '' }]
  })
})

test('includes lexeme morphology alongside each short definition', () => {
  const lexemes = [
    {
      lemma: {
        word: 'virus',
        principalParts: ['virus', 'viri'],
        features: {
          gender: { value: 'neuter' },
          'part of speech': { value: 'noun' },
          declension: { value: '2nd declension' },
          frequency: { value: 'very frequent' }
        }
      },
      provider: { toString: () => 'Ox.Lat.Dict.' },
      inflections: [
        {
          stem: 'vir',
          suffix: 'um',
          getForm: (divider = '') => `vir${divider}um`,
          features: new Set(['number', 'case']),
          number: { value: 'plur.' },
          case: { value: 'gen.' }
        }
      ],
      meaning: {
        shortDefs: [{ text: 'virus' }],
        fullDefs: []
      }
    }
  ]

  const result = projectDefinitionFields(lexemes)
  assert.equal(result.shortDefinitions[0].morphology, 'neuter noun; 2nd declension')
  assert.equal(result.shortDefinitions[0].headword, 'virus, viri')
  assert.equal(result.shortDefinitions[0].frequency, 'very frequent')
  assert.equal(result.shortDefinitions[0].provider, 'Ox.Lat.Dict.')
  assert.equal(result.shortDefinitions[0].lemma, 'virus')
  assert.equal(result.shortDefinitions[0].form, 'vir-um')
  assert.deepEqual(result.shortDefinitions[0].inflections, [
    { label: 'plur.', values: ['gen.'] }
  ])
})

test('keeps multiple inflection rows grouped by number in short definitions', () => {
  const lexemes = [
    {
      lemma: {
        word: 'vir',
        principalParts: ['vir', 'viri'],
        features: {
          gender: { value: 'masculine' },
          'part of speech': { value: 'noun' },
          declension: { value: '2nd declension' }
        }
      },
      inflections: [
        {
          stem: 'vir',
          suffix: 'um',
          getForm: (divider = '') => `vir${divider}um`,
          features: new Set(['number', 'case']),
          number: { value: 'sing.' },
          case: { value: 'acc.' }
        },
        {
          stem: 'vir',
          suffix: 'um',
          getForm: (divider = '') => `vir${divider}um`,
          features: new Set(['number', 'case']),
          number: { value: 'plur.' },
          case: { value: 'gen.' }
        }
      ],
      meaning: {
        shortDefs: [{ text: 'man' }],
        fullDefs: []
      }
    }
  ]

  const result = projectDefinitionFields(lexemes)

  assert.equal(result.shortDefinitions[0].form, 'vir-um')
  assert.deepEqual(result.shortDefinitions[0].inflections, [
    { label: 'sing.', values: ['acc.'] },
    { label: 'plur.', values: ['gen.'] }
  ])
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
    shortDefinitions: [{ html: '<span>Albanian</span>', morphology: '' }],
    fullDefinitions: ['<p>Complete dictionary text</p>'],
    definitions: [{ html: '<span>Albanian</span>', morphology: '' }]
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
