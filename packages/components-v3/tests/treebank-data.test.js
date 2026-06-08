import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTreebankResource, findTreebankSentence } from '../src/lib/treebank-data.js'

const sentences = [
  {
    id: '1',
    index: 1,
    total: 2,
    docId: 'urn:cts:latinLit:phi0690.phi003.perseus-lat1',
    cite: '6.1',
    text: 'Sic fatur.',
    provider: 'Perseus AGLDT v2.1',
    version: '2.1',
    nodes: [
      { id: 0, form: '[0]', isRoot: true, artificial: true },
      { id: 1, form: 'Sic', pos: 'ADV', label: 'ADV' },
      { id: 2, form: 'fatur', pos: 'VERB', label: 'VERB' },
      { id: 3, form: '.', pos: 'PUNCT', label: 'PUNCT' }
    ],
    edges: [
      { from: 2, to: 1, relation: 'AuxY' },
      { from: 0, to: 2, relation: 'PRED' },
      { from: 0, to: 3, relation: 'AuxK' }
    ]
  }
]

test('finds cleaned treebank sentence by doc id and sentence id', () => {
  const sentence = findTreebankSentence(sentences, {
    doc: 'phi0690.phi003.perseus-lat1',
    sentenceId: '1'
  })

  assert.equal(sentence.id, '1')
  assert.equal(sentence.cite, '6.1')
})

test('builds a ResourcesPage tree object from cleaned sentence data', () => {
  const tree = buildTreebankResource(sentences[0], {
    wordIds: ['2', 'bogus', 3]
  })

  assert.equal(tree.kind, 'native')
  assert.equal(tree.ref, '<strong>6.1</strong> · Perseus AGLDT v2.1')
  assert.equal(tree.text, 'Sic fatur.')
  assert.equal(tree.nodes.length, 4)
  assert.deepEqual(tree.edges.map(e => e.relation), ['AuxY', 'PRED', 'AuxK'])
  assert.deepEqual(tree.highlightIds, [2, 3])
  assert.equal(tree.treebankSrc, null)
})
