const ROMAN_LABELS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV'
]
const ROMAN_MARKER_RE = /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s*/
const UPPER_MARKER_RE = /^[A-D]\.\s+/
const NUMBER_MARKER_RE = /^\d+\.\s+/
const LOWER_MARKER_RE = /^[a-d]\.\s+/
const PAREN_MARKER_RE = /^\([a-dα-ω]\)\.?\s+/
const PASS_MARKER_RE = /^Pass\.:/

export function definitionSenseItems (definitions = []) {
  if (!Array.isArray(definitions)) return []

  let defIndex = 0
  return definitions
    .map(definition => {
      // Pass through group-header sentinels as-is
      if (definition && definition._isGroupHeader) {
        return {
          isHeader: true,
          headword: definition.headword || '',
          frequency: definition.frequency || '',
          morphology: definition.morphology || '',
          form: definition.form || '',
          inflections: definition.inflections || []
        }
      }
      const content = definitionContent(definition)
      if (!content.html && !(content.blocks && content.blocks.length)) return null
      return {
        label: String(++defIndex),
        html: content.html,
        blocks: content.blocks
      }
    })
    .filter(Boolean)
}

function definitionContent (definition) {
  const raw = rawDefinitionHtml(definition)
  const meta = definitionMeta(definition)
  if (!raw) return { html: '', blocks: null, ...meta }
  return isLongDictionaryDefinition(raw)
    ? { html: '', blocks: formatLongDictionaryBlocks(raw), ...meta }
    : { html: raw, blocks: null, ...meta }
}

function definitionMeta (definition) {
  if (!definition || typeof definition !== 'object') {
    return { morphology: '', headword: '', frequency: '', provider: '', lemma: '', form: '', inflections: [] }
  }
  return {
    morphology: definition.morphology || '',
    headword: definition.headword || '',
    frequency: definition.frequency || '',
    provider: definition.provider || '',
    lemma: definition.lemma || '',
    form: definition.form || '',
    inflections: Array.isArray(definition.inflections) ? definition.inflections : []
  }
}

function rawDefinitionHtml (definition) {
  if (typeof definition === 'string') return definition
  if (definition && typeof definition.html === 'string') return definition.html
  if (definition && typeof definition.text === 'string') return definition.text
  return ''
}

function isLongDictionaryDefinition (html) {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const hasDictionaryMarkers = (
    /\b(?:I|II|III|IV|V|VI)\.\s*[A-Z]/.test(plain) ||
    /\([a-z]\)\.\s*/.test(plain) ||
    /From A Latin Dictionary/.test(plain)
  )
  if (plain.length > 220 && hasDictionaryMarkers) return true
  return /<\/p>|<br\s*\/?>/i.test(html) && hasDictionaryMarkers
}

function formatLongDictionaryBlocks (html) {
  const sourceMatch = html.match(/\s*(From A Latin Dictionary[\s\S]*)$/)
  const source = sourceMatch ? sourceMatch[1].trim() : ''
  const body = sourceMatch ? html.slice(0, sourceMatch.index).trim() : html.trim()
  const blocks = splitDictionaryBlocks(body)
  if (source) blocks.push(source)

  return blocks
    .map(block => formatDictionaryBlock(block))
    .filter(Boolean)
}

function splitDictionaryBlocks (html) {
  const structuralHtml = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p>/gi, ' ')
    .replace(/<\/?p>/gi, ' ')

  const BREAK = '@@ALPH_DEF_BREAK@@'
  const normalized = structuralHtml
    .replace(/\s*\.?\s*—\s*/g, '.—' + BREAK)

  const scanned = splitDictionaryBlocksByMarkers(normalized.replaceAll(BREAK, ' '))
  if (scanned.length > 1) return scanned

  return normalized
    .split(BREAK)
    .map(block => block.trim())
    .filter(Boolean)
}

function splitDictionaryBlocksByMarkers (html) {
  const markers = []

  for (let i = 0; i < html.length; i++) {
    if (!isDictionaryMarkerBoundary(html, i)) continue
    const marker = markerAt(html.slice(i))
    if (marker) markers.push({ index: i, ...marker })
  }

  if (markers.length === 0) return [html.trim()].filter(Boolean)

  const blocks = []
  const preamble = html.slice(0, markers[0].index).trim()
  if (preamble) blocks.push(preamble)

  markers.forEach((marker, index) => {
    const next = markers[index + 1]
    const block = html.slice(marker.index, next ? next.index : html.length).trim()
    if (block) blocks.push(block)
  })

  return blocks
}

function isDictionaryMarkerBoundary (html, index) {
  if (index === 0) return true
  // Structural markers in L&S only start blocks immediately after an em-dash
  // section divider. Allowing any whitespace causes false splits on citation
  // references like "Claud. IV. Cons. Hon." mid-sentence.
  const before = html.slice(0, index).trimEnd()
  return before.endsWith('\u2014')
}

function markerAt (text) {
  if (ROMAN_MARKER_RE.test(text)) return { markerType: 'roman', depth: 0 }
  if (UPPER_MARKER_RE.test(text)) return { markerType: 'upper', depth: 1 }
  if (NUMBER_MARKER_RE.test(text)) return { markerType: 'number', depth: 2 }
  if (LOWER_MARKER_RE.test(text)) return { markerType: 'lower', depth: 3 }
  if (PAREN_MARKER_RE.test(text)) return { markerType: 'paren', depth: 3 }
  if (PASS_MARKER_RE.test(text)) return { markerType: 'pass', depth: 3 }
  return null
}

function formatDictionaryBlock (block) {
  const marker = markerAt(block)

  if (block.startsWith('From A Latin Dictionary')) {
    return { kind: 'source', depth: 0, heading: '', html: block }
  }

  if (/^Hence,?/.test(block)) {
    return { kind: 'major', depth: 1, ...decorateDictionaryInline(block) }
  }

  if (marker && marker.markerType === 'roman') {
    return { kind: 'roman', depth: 0, ...decorateDictionaryInline(block) }
  }
  if (marker && marker.markerType === 'upper') {
    return { kind: 'major', depth: 1, ...decorateDictionaryInline(block) }
  }
  if (marker) {
    return { kind: 'sub', depth: marker.depth, ...decorateDictionaryInline(block) }
  }
  return { kind: 'plain', depth: 0, heading: '', html: decorateQuotes(block) }
}

function decorateDictionaryInline (html) {
  const headingMatch =
    html.match(/^((?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s*(?:Lit|Trop|Neutr|Masc|Fem)\.?)([\s\S]*)$/) ||
    html.match(/^([A-D]\.\s+(?:Lit|Transf|Trop|Poet|Esp)\.?)([\s\S]*)$/) ||
    html.match(/^([A-Z]\.\s+(?:Esp|Trop|Poet)\.)([\s\S]*)$/) ||
    html.match(/^((?:(?:I|II|III|IV|V|VI|VII|VIII|IX|X)|[A-D]|\d+)\.\s*[^:—]{1,160}):([\s\S]*)$/) ||
    html.match(/^((?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s*[^.:;—]+\.?)([\s\S]*)$/) ||
    html.match(/^([A-D]\.\s+[^.:;—]+\.?)([\s\S]*)$/) ||
    html.match(/^(\([a-zα-ω]\)\.?)([\s\S]*)$/) ||
    html.match(/^([a-d]\.)([\s\S]*)$/) ||
    html.match(/^(Pass\.:)([\s\S]*)$/) ||
    html.match(/^(\d+\.)([\s\S]*)$/) ||
    html.match(/^(Hence,?)([\s\S]*)$/)

  if (!headingMatch) return { heading: '', html: decorateQuotes(html) }

  return {
    heading: headingMatch[1].trim(),
    html: decorateQuotes((headingMatch[2] || '').trim())
  }
}

function decorateQuotes (html) {
  return html.replace(/“([^”]+)”/g, '<span class="alph-lookup__dict-quote">“$1”</span>')
}
