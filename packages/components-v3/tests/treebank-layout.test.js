import test from 'node:test'
import assert from 'node:assert/strict'

import { layoutDependencyTree } from '../src/lib/treebank-layout.js'

const aeneid = {
  nodes: [
    { id: 0, form: '[0]', isRoot: true, artificial: true },
    { id: 1, form: 'Sic', pos: 'ADV', label: 'ADV' },
    { id: 2, form: 'fatur', pos: 'VERB', morph: '3SG PRES.IND', label: 'VERB · 3SG PRES.IND' },
    { id: 3, form: 'lacrimans', pos: 'VERB', morph: 'PRES.PTCP NOM.SG', label: 'VERB · PRES.PTCP NOM.SG' },
    { id: 4, form: ',', pos: 'PUNCT', label: 'PUNCT' },
    { id: 5, form: 'classi', pos: 'NOUN', morph: 'DAT.SG', label: 'NOUN · DAT.SG' },
    { id: 6, form: '-que', pos: 'CONJ', label: 'CONJ' },
    { id: 7, form: 'immittit', pos: 'VERB', morph: '3SG PRES.IND', label: 'VERB · 3SG PRES.IND' },
    { id: 8, form: 'habenas', pos: 'NOUN', morph: 'ACC.PL', label: 'NOUN · ACC.PL' },
    { id: 9, form: ',', pos: 'PUNCT', label: 'PUNCT' },
    { id: 10, form: 'et', pos: 'CONJ', label: 'CONJ' },
    { id: 11, form: 'tandem', pos: 'ADV', label: 'ADV' },
    { id: 12, form: 'Euboicis', pos: 'ADJ', morph: 'DAT.PL', label: 'ADJ · DAT.PL' },
    { id: 13, form: 'Cumarum', pos: 'NOUN', morph: 'GEN.PL', label: 'NOUN · GEN.PL' },
    { id: 14, form: 'adlabitur', pos: 'VERB', morph: '3SG PRES.IND', label: 'VERB · 3SG PRES.IND' },
    { id: 15, form: 'oris', pos: 'NOUN', morph: 'DAT.PL', label: 'NOUN · DAT.PL' },
    { id: 16, form: '.', pos: 'PUNCT', label: 'PUNCT' }
  ],
  edges: [
    { from: 2, to: 1, relation: 'AuxY' },
    { from: 10, to: 2, relation: 'PRED_CO' },
    { from: 2, to: 3, relation: 'ADV' },
    { from: 10, to: 4, relation: 'AuxX' },
    { from: 7, to: 5, relation: 'OBJ' },
    { from: 10, to: 6, relation: 'AuxY' },
    { from: 10, to: 7, relation: 'PRED_CO' },
    { from: 7, to: 8, relation: 'OBJ' },
    { from: 10, to: 9, relation: 'AuxX' },
    { from: 0, to: 10, relation: 'COORD' },
    { from: 14, to: 11, relation: 'AuxY' },
    { from: 15, to: 12, relation: 'ATR' },
    { from: 15, to: 13, relation: 'ATR' },
    { from: 10, to: 14, relation: 'PRED_CO' },
    { from: 14, to: 15, relation: 'OBJ' },
    { from: 0, to: 16, relation: 'AuxK' }
  ]
}

test('lays out real tokens without rendering the virtual root as a token', () => {
  const layout = layoutDependencyTree(aeneid)

  assert.equal(layout.tokens.length, 16)
  assert.deepEqual(layout.tokens.map(t => t.id), Array.from({ length: 16 }, (_, i) => i + 1))
  assert.equal(layout.tokens.some(t => t.id === 0), false)
  assert.equal(layout.rootMarks.length, 2)
  assert.deepEqual(layout.rootMarks.map(r => r.tokenId), [10, 16])
  assert.equal(layout.arcs.some(a => a.from === 0 || a.to === 0), false)
})

test('assigns arc levels so same-level arcs do not strictly overlap', () => {
  const layout = layoutDependencyTree(aeneid)

  assert.ok(layout.maxLevel >= 1)
  for (const arc of layout.arcs) {
    assert.equal(Number.isInteger(arc.level), true)
    assert.ok(arc.level >= 0)
    assert.ok(arc.pathD.length > 0)
    assert.ok(arc.portY < layout.baselineY)
    assert.ok(arc.laneY < arc.portY)
    assert.equal(arc.pathD.includes(' C '), false)
    assert.equal(arc.pathD.includes(' Q '), true)
    assert.equal(arc.pathD.startsWith(`M ${arc.fromX},${arc.portY}`), true)
    assert.equal(arc.pathD.endsWith(`${arc.toX},${arc.portY}`), true)
    assert.equal(arc.headPortX, arc.fromX)
    assert.equal(arc.dependentPortX, arc.toX)
    assert.equal(arc.headPortY, arc.portY)
    assert.equal(arc.dependentPortY, arc.portY)
  }

  for (let i = 0; i < layout.arcs.length; i++) {
    for (let j = i + 1; j < layout.arcs.length; j++) {
      const a = layout.arcs[i]
      const b = layout.arcs[j]
      if (a.level !== b.level) continue
      assert.equal(a.lo < b.hi && b.lo < a.hi, false, `${a.relation} and ${b.relation} overlap on level ${a.level}`)
    }
  }
})

test('computes stable dimensions and token positions inside the viewport', () => {
  const layout = layoutDependencyTree(aeneid)

  assert.ok(layout.width > 0)
  assert.ok(layout.height > 0)
  assert.ok(layout.baselineY > 0)
  for (const token of layout.tokens) {
    assert.ok(token.x >= 0)
    assert.ok(token.cx > token.x)
    assert.ok(token.x + token.width <= layout.width)
  }
})

test('sizes tokens from their longest visible text line', () => {
  const layout = layoutDependencyTree(aeneid)
  const byId = new Map(layout.tokens.map(t => [t.id, t]))
  const fatur = byId.get(2)
  const lacrimans = byId.get(3)

  assert.deepEqual(fatur.labelLines, ['VERB', '3SG PRES.IND'])
  assert.ok(fatur.width > '3SG PRES.IND'.length * 5.2)
  assert.deepEqual(lacrimans.labelLines, ['VERB', 'PRES.PTCP NOM.SG'])
  assert.ok(lacrimans.width > 'PRES.PTCP NOM.SG'.length * 5.2)
})

test('bolds highlighted tokens and root targets', () => {
  const layout = layoutDependencyTree(aeneid, { highlightId: 2 })
  const byId = new Map(layout.tokens.map(t => [t.id, t]))

  assert.equal(byId.get(2).formWeight, 700)
  assert.equal(byId.get(10).formWeight, 700)
  assert.equal(byId.get(16).formWeight, 700)
  assert.equal(byId.get(1).formWeight, 500)
})

test('marks the selected token, its head, dependents, and connected arcs', () => {
  const layout = layoutDependencyTree(aeneid, { highlightId: 2 })
  const byId = new Map(layout.tokens.map(t => [t.id, t]))
  const predArc = layout.arcs.find(a => a.from === 10 && a.to === 2)
  const auxArc = layout.arcs.find(a => a.from === 2 && a.to === 1)
  const advArc = layout.arcs.find(a => a.from === 2 && a.to === 3)
  const unrelatedArc = layout.arcs.find(a => a.from === 7 && a.to === 5)

  assert.equal(byId.get(2).focusRole, 'self')
  assert.equal(byId.get(10).focusRole, 'head')
  assert.equal(byId.get(1).focusRole, 'dependent')
  assert.equal(byId.get(3).focusRole, 'dependent')
  assert.equal(byId.get(5).focusRole, '')
  assert.equal(predArc.isFocused, true)
  assert.equal(predArc.focusRole, 'head')
  assert.equal(auxArc.isFocused, true)
  assert.equal(auxArc.focusRole, 'dependent')
  assert.equal(advArc.isFocused, true)
  assert.equal(advArc.focusRole, 'dependent')
  assert.equal(unrelatedArc.isFocused, false)
})

test('marks relationships for multiple selected tokens', () => {
  const layout = layoutDependencyTree(aeneid, { highlightIds: [2, 7] })
  const byId = new Map(layout.tokens.map(t => [t.id, t]))
  const selectedArc = layout.arcs.find(a => a.from === 7 && a.to === 8)
  const sharedHeadArc = layout.arcs.find(a => a.from === 10 && a.to === 7)
  const unrelatedArc = layout.arcs.find(a => a.from === 15 && a.to === 12)

  assert.equal(byId.get(2).focusRole, 'self')
  assert.equal(byId.get(7).focusRole, 'self')
  assert.equal(byId.get(8).focusRole, 'dependent')
  assert.equal(byId.get(10).focusRole, 'head')
  assert.equal(byId.get(12).focusRole, '')
  assert.equal(selectedArc.isFocused, true)
  assert.equal(selectedArc.focusRole, 'dependent')
  assert.equal(sharedHeadArc.isFocused, true)
  assert.equal(sharedHeadArc.focusRole, 'head')
  assert.equal(unrelatedArc.isFocused, false)
})

test('handles degenerate input containing only the artificial root', () => {
  const layout = layoutDependencyTree({ nodes: [{ id: 0, form: '[0]' }], edges: [{ from: 0, to: 99, relation: 'ROOT' }] })

  assert.deepEqual(layout.tokens, [])
  assert.deepEqual(layout.arcs, [])
  assert.deepEqual(layout.rootMarks, [])
  assert.ok(layout.width > 0)
  assert.ok(layout.height > 0)
})
