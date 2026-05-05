export function shortMeaningFromWordItem (item) {
  if (!item) return ''
  if (typeof item.shortMeaning === 'string' && item.shortMeaning.trim()) return item.shortMeaning.trim()
  if (typeof item.meaning === 'string' && item.meaning.trim()) return item.meaning.trim()
  if (typeof item.definition === 'string' && item.definition.trim()) return item.definition.trim()

  const lexemes = item.homonym && Array.isArray(item.homonym.lexemes)
    ? item.homonym.lexemes
    : []
  const defs = []

  lexemes.forEach(lexeme => {
    const shortDefs = lexeme && lexeme.meaning && Array.isArray(lexeme.meaning.shortDefs)
      ? lexeme.meaning.shortDefs
      : []
    shortDefs.forEach(def => {
      const text = typeof def === 'string' ? def : def && def.text
      if (text && !defs.includes(text)) defs.push(text)
    })
  })

  return defs.join('; ')
}

export function buildWordListGroups ({ wordLists, langNameFor }) {
  if (!wordLists) return []
  const entries = typeof wordLists === 'object' && !Array.isArray(wordLists)
    ? Object.entries(wordLists)
    : []

  return entries.map(([langCode, wl]) => {
    const values = (wl && typeof wl.values === 'function')
      ? wl.values()
      : (Array.isArray(wl && wl.values) ? wl.values : [])
    const words = values.map(item => {
      const meaning = shortMeaningFromWordItem(item)
      return {
        form: item.targetWord || '',
        pos: item.lemmasList || lemmasListFromWordItem(item),
        meaning,
        ctx: Array.isArray(item.context) ? item.context.length : 0,
        langCode: item.languageCode || langCode
      }
    })
    return {
      id: langCode,
      name: langNameFor ? langNameFor(langCode) : langCode,
      count: words.length,
      expanded: words.length > 0,
      sort: 'A-Z',
      words
    }
  }).filter(g => g.words.length > 0)
}

function lemmasListFromWordItem (item) {
  const lexemes = item && item.homonym && Array.isArray(item.homonym.lexemes)
    ? item.homonym.lexemes
    : []
  return lexemes.map(lexeme => lexeme && lexeme.lemma && lexeme.lemma.word)
    .filter((value, index, self) => value && self.indexOf(value) === index)
    .join(', ')
}

export function lookupLanguageItems (option) {
  const values = option && Array.isArray(option.values) ? option.values : []
  return values.map(item => ({
    value: item.value || item.code || item,
    label: item.text || item.label || item.value || item
  })).filter(item => item.value)
}

export function selectLookupLanguage ({ option, store, selectedText }) {
  if (!option || !selectedText) return ''
  if (typeof option.setTextValue === 'function') {
    option.setTextValue(selectedText)
  } else if (typeof option.setValue === 'function') {
    option.setValue(selectedText)
  } else {
    option.currentValue = selectedText
  }
  const selected = option.currentValue || selectedText
  if (store && typeof store.commit === 'function') {
    store.commit('app/setSelectedLookupLang', selected)
  }
  return selected
}

export function resolveLookupLanguageCode ({ selectedRefValue, storeState, option }) {
  return selectedRefValue ||
    (storeState && storeState.selectedLookupLangCode) ||
    (option && option.currentValue) ||
    (storeState && storeState.currentLanguageCode) ||
    'lat'
}

export function csvForWordList (words, delimiter = '\t') {
  const rows = [['word', 'definition'], ...words.map(word => [
    word.form || '',
    word.meaning || word.pos || ''
  ])]
  return rows.map(row => row.map(cell => escapeCsvCell(cell, delimiter)).join(delimiter)).join('\n')
}

export function parseWordListImport (text, fallbackLangCode = 'lat') {
  if (!text || !text.trim()) return []
  const delimiter = text.includes('\t') ? '\t' : ';'
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (!lines.length) return []

  const first = splitDelimitedLine(lines[0], delimiter).map(cell => cell.toLowerCase())
  const hasHeader = first.includes('word') || first.includes('targetword')
  const headers = hasHeader ? first : []
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map(line => {
    const cells = splitDelimitedLine(line, delimiter)
    const get = (...names) => {
      for (const name of names) {
        const index = headers.indexOf(name.toLowerCase())
        if (index >= 0) return cells[index] || ''
      }
      return ''
    }
    return {
      targetWord: get('targetWord', 'word') || cells[0] || '',
      languageCode: get('languageCode', 'language') || fallbackLangCode,
      definition: get('definition', 'shortMeaning', 'meaning') || cells[1] || ''
    }
  }).filter(item => item.targetWord)
}

function escapeCsvCell (value, delimiter) {
  const text = String(value == null ? '' : value)
  if (text.includes(delimiter) || text.includes('\n') || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function splitDelimitedLine (line, delimiter) {
  const cells = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"' && line[i + 1] === '"') {
      current += '"'
      i += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === delimiter && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}
