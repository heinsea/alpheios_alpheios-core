import test from 'node:test'
import assert from 'node:assert/strict'

import { summarizeTreebankPos } from '../src/lib/treebank-pos.js'

test('summarizes real token POS values with counts and matching ids', () => {
  const summary = summarizeTreebankPos([
    { id: 0, form: '[0]', pos: '' },
    { id: 1, form: 'Sic', pos: 'ADV' },
    { id: 2, form: 'fatur', pos: 'VERB' },
    { id: 3, form: 'lacrimans', pos: 'VERB' },
    { id: 4, form: ',', pos: 'PUNCT' },
    { id: 5, form: 'classi', pos: 'NOUN' },
    { id: 6, form: 'Euboicis', pos: 'ADJ' }
  ])

  assert.deepEqual(summary, [
    { pos: 'VERB', count: 2, ids: [2, 3] },
    { pos: 'NOUN', count: 1, ids: [5] },
    { pos: 'ADJ', count: 1, ids: [6] },
    { pos: 'ADV', count: 1, ids: [1] },
    { pos: 'PUNCT', count: 1, ids: [4] }
  ])
})

test('ignores virtual roots and nodes without a POS value', () => {
  assert.deepEqual(summarizeTreebankPos([
    { id: 0, form: '[0]', pos: 'ROOT' },
    { id: 1, form: 'word' },
    { id: 2, form: 'other', pos: '' }
  ]), [])
})
