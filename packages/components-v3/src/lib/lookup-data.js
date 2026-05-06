export function projectDefinitionFields (lexemes = [], { noDefinitionsText = '' } = {}) {
  const shortDefinitions = lexemes.flatMap(lex => {
    const meaning = lex && lex.meaning
    if (!meaning) return []
    const shortDefs = Array.isArray(meaning.shortDefs) ? meaning.shortDefs : []
    return shortDefs.map(definitionText).filter(Boolean)
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

function definitionText (definition) {
  if (!definition) return ''
  if (typeof definition === 'string') return definition
  if (typeof definition.text === 'string' && definition.text) return definition.text
  if (typeof definition.html === 'string' && definition.html) return definition.html
  return ''
}
