const DEFAULT_OPTS = {
  charW: 7.2,
  labelCharW: 5.2,
  minTokenW: 26,
  tokenPadX: 18,
  tokenGap: 14,
  levelH: 32,
  arcBaseRise: 36,
  padTop: 18,
  padX: 16,
  baselinePad: 32,
  portLift: 18,
  cornerR: 5,
  highlightId: null,
  highlightIds: null
}

function toId (value) {
  const id = Number(value)
  return Number.isFinite(id) ? id : null
}

function tokenLabel (node) {
  if (node.label) return node.label
  return [node.pos, node.morph].filter(Boolean).join(' · ')
}

function tokenLabelLines (node) {
  const pos = node.pos || ''
  const morph = node.morph || ''
  if (pos || morph) return [pos, morph].filter(Boolean)
  return tokenLabel(node) ? [tokenLabel(node)] : []
}

function intervalsOverlap (a, b) {
  return a.lo < b.hi && b.lo < a.hi
}

function round (value) {
  return Math.round(value * 100) / 100
}

function schematicPath ({ fromX, toX, portY, laneY, cornerR }) {
  const dir = fromX <= toX ? 1 : -1
  const dx = Math.abs(toX - fromX)
  const dy = Math.abs(portY - laneY)
  const r = round(Math.max(0, Math.min(cornerR, dx / 3, dy / 2)))
  if (!r) return `M ${fromX},${portY} L ${fromX},${laneY} L ${toX},${laneY} L ${toX},${portY}`
  return [
    `M ${fromX},${portY}`,
    `L ${fromX},${round(laneY + r)}`,
    `Q ${fromX},${laneY} ${round(fromX + dir * r)},${laneY}`,
    `L ${round(toX - dir * r)},${laneY}`,
    `Q ${toX},${laneY} ${toX},${round(laneY + r)}`,
    `L ${toX},${portY}`
  ].join(' ')
}

export function layoutDependencyTree (tree = {}, options = {}) {
  const opts = { ...DEFAULT_OPTS, ...options }
  const highlightIds = Array.isArray(opts.highlightIds)
    ? opts.highlightIds.map(toId).filter(id => id !== null)
    : (opts.highlightId == null ? [] : [toId(opts.highlightId)].filter(id => id !== null))
  const highlightSet = new Set(highlightIds)
  const highlightId = highlightIds.length === 1 ? highlightIds[0] : null
  const sourceNodes = Array.isArray(tree.nodes) ? tree.nodes : []
  const sourceEdges = Array.isArray(tree.edges) ? tree.edges : []

  let cursor = opts.padX
  const tokens = sourceNodes
    .filter(node => toId(node.id) !== null && toId(node.id) >= 1)
    .sort((a, b) => toId(a.id) - toId(b.id))
    .map(node => {
      const id = toId(node.id)
      const form = String(node.form || '')
      const labelLines = tokenLabelLines(node)
      const longestLabelW = labelLines.reduce((max, line) => Math.max(max, line.length * opts.labelCharW), 0)
      const textW = Math.max(opts.minTokenW, form.length * opts.charW, longestLabelW)
      const width = textW + opts.tokenPadX
      const token = {
        id,
        form,
        lemma: node.lemma || '',
        pos: node.pos || '',
        morph: node.morph || '',
        label: tokenLabel(node),
        labelLines,
        x: round(cursor),
        width: round(width),
        cx: round(cursor + width / 2),
        isRoot: Boolean(node.isRoot),
        isHighlighted: highlightSet.has(id),
        formWeight: highlightSet.has(id) ? 700 : 500
      }
      cursor += width + opts.tokenGap
      return token
    })

  const byId = new Map(tokens.map(token => [token.id, token]))
  const order = new Map(tokens.map((token, index) => [token.id, index]))
  const rootMarks = []
  const arcInputs = []

  for (const edge of sourceEdges) {
    const from = toId(edge.from)
    const to = toId(edge.to)
    if (from === null || to === null || !byId.has(to)) continue
    const relation = edge.relation || ''
    if (from === 0) {
      const token = byId.get(to)
      token.isRoot = true
      token.formWeight = 700
      rootMarks.push({ tokenId: to, relation, x: token.cx })
      continue
    }
    if (!byId.has(from)) continue
    const fromOrder = order.get(from)
    const toOrder = order.get(to)
    const lo = Math.min(fromOrder, toOrder)
    const hi = Math.max(fromOrder, toOrder)
    arcInputs.push({
      from,
      to,
      relation,
      lo,
      hi,
      span: hi - lo
    })
  }

  const placed = []
  for (const arc of [...arcInputs].sort((a, b) => a.span - b.span || a.lo - b.lo || a.hi - b.hi)) {
    let level = 0
    while (placed.some(other => other.level === level && intervalsOverlap(other, arc))) {
      level += 1
    }
    placed.push({ ...arc, level })
  }

  const maxLevel = placed.reduce((max, arc) => Math.max(max, arc.level), -1)
  const baselineY = round(opts.padTop + (maxLevel + 1) * opts.levelH + opts.arcBaseRise)
  for (const selectedId of highlightSet) {
    if (!byId.has(selectedId)) continue
    byId.get(selectedId).focusRole = 'self'
    for (const arc of placed) {
      if (arc.to === selectedId && byId.has(arc.from) && byId.get(arc.from).focusRole !== 'self') {
        byId.get(arc.from).focusRole ||= 'head'
      }
      if (arc.from === selectedId && byId.has(arc.to) && byId.get(arc.to).focusRole !== 'self') {
        byId.get(arc.to).focusRole ||= 'dependent'
      }
    }
  }
  for (const token of tokens) {
    token.focusRole ||= ''
  }
  const arcs = placed
    .sort((a, b) => a.lo - b.lo || a.hi - b.hi || a.level - b.level)
    .map(arc => {
      const from = byId.get(arc.from)
      const to = byId.get(arc.to)
      const xL = Math.min(from.cx, to.cx)
      const xR = Math.max(from.cx, to.cx)
      const fromX = round(from.cx)
      const toX = round(to.cx)
      const portY = round(baselineY - opts.portLift)
      const laneY = round(baselineY - opts.arcBaseRise - arc.level * opts.levelH)
      const fromFocused = highlightSet.has(arc.from)
      const toFocused = highlightSet.has(arc.to)
      const isFocused = fromFocused || toFocused
      return {
        from: arc.from,
        to: arc.to,
        relation: arc.relation,
        isFocused,
        focusRole: toFocused ? 'head' : fromFocused ? 'dependent' : '',
        level: arc.level,
        lo: arc.lo,
        hi: arc.hi,
        dir: from.cx < to.cx ? 'right' : 'left',
        fromX,
        toX,
        portY,
        laneY,
        pathD: schematicPath({ fromX, toX, portY, laneY, cornerR: opts.cornerR }),
        labelX: round((xL + xR) / 2),
        labelY: round(laneY - 4),
        headPortX: fromX,
        headPortY: portY,
        dependentPortX: toX,
        dependentPortY: portY
      }
    })

  const width = tokens.length
    ? round(tokens[tokens.length - 1].x + tokens[tokens.length - 1].width + opts.padX)
    : round(opts.padX * 2)
  const height = round(baselineY + opts.baselinePad + 8)

  return {
    tokens,
    arcs,
    rootMarks,
    baselineY,
    width,
    height,
    maxLevel
  }
}
