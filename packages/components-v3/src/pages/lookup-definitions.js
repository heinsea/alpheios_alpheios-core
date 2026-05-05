const ROMAN_LABELS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV'
]

export function definitionSenseItems (definitions = []) {
  if (!Array.isArray(definitions)) return []

  return definitions
    .map(definitionContent)
    .filter(content => content.html || (content.blocks && content.blocks.length))
    .map((content, index) => ({
      label: ROMAN_LABELS[index] || String(index + 1),
      html: content.html,
      blocks: content.blocks
    }))
}

function definitionContent (definition) {
  const raw = rawDefinitionHtml(definition)
  if (!raw) return { html: '', blocks: null }
  return isLongDictionaryDefinition(raw)
    ? { html: '', blocks: formatLongDictionaryBlocks(raw) }
    : { html: raw, blocks: null }
}

function rawDefinitionHtml (definition) {
  if (typeof definition === 'string') return definition
  if (definition && typeof definition.html === 'string') return definition.html
  if (definition && typeof definition.text === 'string') return definition.text
  return ''
}

function isLongDictionaryDefinition (html) {
  return html.length > 220 && (
    /\b(?:I|II|III|IV|V|VI)\.\s+[A-Z]/.test(html) ||
    /\([a-z]\)\.\s+/.test(html) ||
    /From A Latin Dictionary/.test(html)
  )
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
  const BREAK = '@@ALPH_DEF_BREAK@@'
  return html
    .replace(/\s+(?=(?:I|II|III|IV|V|VI)\.\s+[A-Z])/g, BREAK)
    .replace(/\s+(?=[A-Z]\.\s+(?:That|Trop|Poet|Hence|Esp\.|From|mĕ|mĕm|From))/g, BREAK)
    .replace(/\s+(?=\([a-zα-ω]\)\.?\s+)/g, BREAK)
    .replace(/\s+(?=\d+\.\s+[A-Z])/g, BREAK)
    .replace(/\s*\.?\s*—\s*/g, '.—' + BREAK)
    .split(BREAK)
    .map(block => block.trim())
    .filter(Boolean)
}

function formatDictionaryBlock (block) {
  if (block.startsWith('From A Latin Dictionary')) {
    return { kind: 'source', heading: '', html: block }
  }

  if (/^Hence,?/.test(block)) {
    return { kind: 'major', ...decorateDictionaryInline(block) }
  }

  if (/^(?:I|II|III|IV|V|VI)\.\s+/.test(block) || /^[A-Z]\.\s+/.test(block)) {
    return { kind: 'major', ...decorateDictionaryInline(block) }
  }
  if (/^\([a-zα-ω]\)\.?\s+/.test(block) || /^\d+\.\s+/.test(block) || /^Pass\.:/.test(block)) {
    return { kind: 'sub', ...decorateDictionaryInline(block) }
  }
  return { kind: 'plain', heading: '', html: decorateQuotes(block) }
}

function decorateDictionaryInline (html) {
  const headingMatch =
    html.match(/^([A-Z]\.\s+(?:Esp|Trop|Poet)\.)([\s\S]*)$/) ||
    html.match(/^((?:(?:I|II|III|IV|V|VI)|[A-Z]|\d+)\.\s+[^:—]{1,160}):([\s\S]*)$/) ||
    html.match(/^((?:I|II|III|IV|V|VI)\.\s+[^.:;—]+\.?)([\s\S]*)$/) ||
    html.match(/^([A-Z]\.\s+[^.:;—]+\.?)([\s\S]*)$/) ||
    html.match(/^(\([a-zα-ω]\)\.?)([\s\S]*)$/) ||
    html.match(/^(Pass\.:)([\s\S]*)$/) ||
    html.match(/^(\d+\.\s+[^.:;—]+\.?)([\s\S]*)$/) ||
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
