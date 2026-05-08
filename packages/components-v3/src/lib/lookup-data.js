export function projectDefinitionFields (lexemes = [], { noDefinitionsText = '' } = {}) {
  const shortDefinitions = lexemes.flatMap(lex => {
    const meaning = lex && lex.meaning
    if (!meaning) return []
    const shortDefs = Array.isArray(meaning.shortDefs) ? meaning.shortDefs : []
    const details = lexemeDefinitionDetails(lex)
    const items = shortDefs
      .map(definitionText)
      .filter(Boolean)
      .map(definition => ({ html: definition }))
    if (items.length === 0) return []
    // Prepend a group-header sentinel so templates can render meta once per lexeme
    return [{ _isGroupHeader: true, ...details }, ...items]
  })
  const fullDefinitions = lexemes.flatMap(lex => {
    const meaning = lex && lex.meaning
    if (!meaning) return []
    const fullDefs = Array.isArray(meaning.fullDefs) ? meaning.fullDefs : []
    return fullDefs.map(definitionText).filter(Boolean)
  })
  const hasRecognizedLexemeWithoutDefinitions = lexemes.some(lex => (
    lex &&
    lex.lemma &&
    lex.lemma.features &&
    Object.entries(lex.lemma.features).length > 0
  ))
  const visibleShortDefinitions = shortDefinitions.length || fullDefinitions.length || !noDefinitionsText || !hasRecognizedLexemeWithoutDefinitions
    ? shortDefinitions
    : [noDefinitionsText]

  return {
    shortDefinitions: visibleShortDefinitions,
    fullDefinitions,
    definitions: visibleShortDefinitions
  }
}

function lexemeDefinitionDetails (lexeme) {
  const lemma = lexeme && lexeme.lemma ? lexeme.lemma : null
  const details = {
    morphology: lexemeMorphology(lexeme)
  }

  const headword = lexemeHeadword(lemma)
  if (headword) details.headword = headword

  const frequency = featureText(lemma && lemma.features && lemma.features.frequency)
  if (frequency) details.frequency = frequency

  const provider = providerText(lexeme && lexeme.provider)
  if (provider) details.provider = provider

  const lemmaWord = lemma && typeof lemma.word === 'string' ? lemma.word : ''
  if (lemmaWord) details.lemma = lemmaWord

  const form = lexemeForm(lexeme)
  if (form) details.form = form

  const inflections = lexemeInflectionRows(lexeme)
  if (inflections.length) details.inflections = inflections

  return details
}

function lexemeHeadword (lemma) {
  if (!lemma) return ''
  const parts = []
  if (typeof lemma.word === 'string' && lemma.word) parts.push(lemma.word)
  if (Array.isArray(lemma.principalParts)) {
    lemma.principalParts.forEach(part => {
      const value = typeof part === 'string' ? part : String(part || '')
      if (value && !parts.includes(value)) parts.push(value)
    })
  }
  return parts.join(', ')
}

function providerText (provider) {
  if (!provider) return ''
  if (typeof provider === 'string') return provider
  if (typeof provider.toString === 'function') return provider.toString()
  if (typeof provider.uri === 'string') return provider.uri
  return ''
}

function lexemeForm (lexeme) {
  const inflections = lexeme && Array.isArray(lexeme.inflections) ? lexeme.inflections : []
  for (const inflection of inflections) {
    const form = inflectionForm(inflection)
    if (form) return form
  }
  return ''
}

function inflectionForm (inflection) {
  if (!inflection) return ''
  if (typeof inflection.getForm === 'function') return inflection.getForm('-')
  if (typeof inflection.form === 'string' && inflection.form) return inflection.form.replace(/\s+-\s+/g, '-')
  const stem = valueText(inflection.stem)
  const suffix = valueText(inflection.suffix)
  const prefix = valueText(inflection.prefix)
  if (!stem && !suffix && !prefix) return ''
  return [prefix, stem, suffix].filter(Boolean).join('-')
}

function lexemeInflectionRows (lexeme) {
  const inflections = lexeme && Array.isArray(lexeme.inflections) ? lexeme.inflections : []
  const rows = []
  const rowMap = new Map()

  inflections.forEach(inflection => {
    if (!inflection) return
    const label = featureText(inflection.number) || featureText(inflection.person) || ''
    const values = [
      featureText(inflection.case),
      featureText(inflection.mood),
      featureText(inflection.tense),
      featureText(inflection.voice),
      featureText(inflection.gender)
    ].filter(Boolean)
    if (!values.length) return
    if (!rowMap.has(label)) {
      const row = { label, values: [] }
      rowMap.set(label, row)
      rows.push(row)
    }
    const row = rowMap.get(label)
    values.forEach(value => {
      value.split(' · ').filter(Boolean).forEach(item => {
        if (!row.values.includes(item)) row.values.push(item)
      })
    })
  })

  return rows
}

function definitionText (definition) {
  if (!definition) return ''
  if (typeof definition === 'string') return definition
  if (typeof definition.text === 'string' && definition.text) return definition.text
  if (typeof definition.html === 'string' && definition.html) return definition.html
  return ''
}

function lexemeMorphology (lexeme) {
  const features = lexeme && lexeme.lemma && lexeme.lemma.features
  if (!features) return ''

  const partOfSpeech = featureText(features['part of speech'])
  const gender = featureText(features.gender)
  const declension = featureText(features.declension)
  const conjugation = featureText(features.conjugation)

  const primaryMorph = [gender, partOfSpeech].filter(Boolean).join(' ')
  const detailMorph = [declension, conjugation].filter(Boolean).join(' · ')
  if (primaryMorph && detailMorph) return `${primaryMorph}; ${detailMorph}`
  return primaryMorph || detailMorph || ''
}

function featureText (feature) {
  if (!feature) return ''
  if (typeof feature === 'string') return feature
  if (typeof feature.value === 'string') return feature.value
  if (Array.isArray(feature.values)) {
    return feature.values.map(v => v && v.value).filter(Boolean).join(' · ')
  }
  return ''
}

function valueText (value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value.value === 'string') return value.value
  return String(value)
}
