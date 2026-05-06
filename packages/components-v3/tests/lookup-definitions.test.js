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
  assert.equal(sense.blocks[1].depth, 1)
})
