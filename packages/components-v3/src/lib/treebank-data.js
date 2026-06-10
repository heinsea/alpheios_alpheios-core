export function normalizeDocId (value = '') {
  return String(value)
    .replace(/^urn:cts:[^:]+:/, '')
    .replace(/\.tb$/, '')
    .trim()
}

function normalizeSentenceId (value = '') {
  return String(value).trim()
}

function normalizeWordIds (wordIds = [], nodes = []) {
  const validIds = new Set((Array.isArray(nodes) ? nodes : []).map(node => Number(node.id)))
  return (Array.isArray(wordIds) ? wordIds : [wordIds])
    .map(id => Number(id))
    .filter(id => Number.isFinite(id) && id > 0 && validIds.has(id))
}

export function findTreebankSentence (sentences = [], metadata = {}) {
  if (!Array.isArray(sentences) || !sentences.length) return null
  const doc = normalizeDocId(metadata.doc || metadata.docId || '')
  const sentenceId = normalizeSentenceId(metadata.sentenceId || metadata.sent || metadata.id || '')
  if (!sentenceId) return null

  return sentences.find(sentence => {
    const sentenceDoc = normalizeDocId(sentence.docId || '')
    return String(sentence.id) === sentenceId &&
      (!doc || sentenceDoc === doc || sentenceDoc.endsWith(doc) || doc.endsWith(sentenceDoc))
  }) || null
}

export function buildTreebankResource (sentence, metadata = {}) {
  if (!sentence || !Array.isArray(sentence.nodes) || !Array.isArray(sentence.edges)) return null
  const cite = sentence.cite || sentence.id || ''
  const tokenCount = Math.max(0, sentence.nodes.length - 1)
  return {
    kind: 'native',
    id: sentence.id,
    ref: `<strong>${cite}</strong>`,
    text: sentence.text || '',
    textStrip: sentence.text || '',
    nodes: sentence.nodes,
    edges: sentence.edges,
    highlightIds: normalizeWordIds(metadata.wordIds, sentence.nodes),
    footerMeta: `${cite} · ${tokenCount} tokens`,
    treebankSrc: null,
    suppressTree: false
  }
}
