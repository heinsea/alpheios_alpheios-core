import test from 'node:test'
import assert from 'node:assert/strict'

import { definitionSenseItems } from '../src/pages/lookup-definitions.js'

test('marks full dictionary subitems with a nested depth', () => {
  const [sense] = definitionSenseItems([
    'I. Main definition: first sense with enough explanatory dictionary prose to trigger long-entry formatting and preserve hierarchy. ' +
      '(a). Nested item text that should be visually indented under the major sense rather than aligned as another top-level sense. ' +
      'From A Latin Dictionary source note'
  ])

  assert.ok(sense.blocks)
  assert.equal(sense.blocks[0].kind, 'major')
  assert.equal(sense.blocks[0].depth, 0)
  assert.equal(sense.blocks[1].kind, 'sub')
  assert.equal(sense.blocks[1].depth, 2)
})

test('preserves hierarchy when dictionary markers are split by html block tags', () => {
  const [sense] = definitionSenseItems([
    '<p>I. Lit.: literal sense text with enough body to stay in long definition mode and preserve hierarchy markers.</p>' +
      '<p>(a). Nested clause should remain indented.</p>' +
      '<p>From A Latin Dictionary source note</p>'
  ])

  assert.ok(sense.blocks)
  assert.equal(sense.blocks[0].depth, 0)
  assert.equal(sense.blocks[1].depth, 2)
})

test('recognizes Lewis and Short marker hierarchy without relying on spaces after roman numerals', () => {
  const [sense] = definitionSenseItems([
    'sanguis, inis, m. etym. dub.; cf. cruor). ' +
      'I.Neutr. collat. form sanguen, ante-classical note with enough text to keep long formatting active. ' +
      'I. Lit.: literal blood examples and citations continue here with a long enough phrase to be dictionary-like. ' +
      '2. Plur. late Latin plural examples continue here with citations. ' +
      'B. Transf. classically transferred meanings in poets and prose. ' +
      '1. Blood, i. e. consanguinity, descent, race, stock, family. ' +
      'a. Abstr.: blood-relations and kinship examples. ' +
      'b. Concr., a descendant, offspring examples. ' +
      'II. Trop., vigor, strength, force, spirit, life. ' +
      'From A Latin Dictionary source note'
  ])

  const outline = sense.blocks
    .filter(block => block.kind !== 'source')
    .map(block => ({ heading: block.heading, depth: block.depth }))

  assert.deepEqual(outline, [
    { heading: '', depth: 0 },
    { heading: 'I.Neutr.', depth: 0 },
    { heading: 'I. Lit.', depth: 0 },
    { heading: '2.', depth: 1 },
    { heading: 'B. Transf.', depth: 0 },
    { heading: '1.', depth: 1 },
    { heading: 'a.', depth: 2 },
    { heading: 'b.', depth: 2 },
    { heading: 'II. Trop.', depth: 0 }
  ])
})
