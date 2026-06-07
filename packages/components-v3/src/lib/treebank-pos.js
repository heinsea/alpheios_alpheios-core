const POS_ORDER = ['VERB', 'NOUN', 'ADJ', 'ADV', 'PRON', 'DET', 'ADP', 'CONJ', 'PART', 'NUM', 'PUNCT', 'X']

export function summarizeTreebankPos (nodes = []) {
  const byPos = new Map()
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const id = Number(node.id)
    const pos = String(node.pos || '').trim()
    if (!Number.isFinite(id) || id < 1 || !pos) continue
    if (!byPos.has(pos)) byPos.set(pos, { pos, count: 0, ids: [] })
    const item = byPos.get(pos)
    item.count += 1
    item.ids.push(id)
  }
  return [...byPos.values()].sort((a, b) => {
    const ai = POS_ORDER.includes(a.pos) ? POS_ORDER.indexOf(a.pos) : POS_ORDER.length
    const bi = POS_ORDER.includes(b.pos) ? POS_ORDER.indexOf(b.pos) : POS_ORDER.length
    return ai - bi || a.pos.localeCompare(b.pos)
  })
}
