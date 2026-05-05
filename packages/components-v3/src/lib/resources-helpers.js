export function buildGrammarData ({ langCode, langName, grammarEntry, hasLookup }) {
  const language = langName || langCode || ''
  if (!grammarEntry || !grammarEntry.url) {
    return {
      language,
      sourceCount: 0,
      linkedFrom: hasLookup
        ? 'No grammar reference available for this lookup.'
        : 'Look up a word to load grammar resources.',
      sources: [],
      browserUrl: '',
      reading: {
        anchor: 'Grammar',
        title: hasLookup ? 'No grammar reference available' : 'No lookup yet',
        blocks: [
          {
            type: 'p',
            html: hasLookup
              ? 'Alpheios did not return a grammar resource for the current language and selection.'
              : 'Run a lookup first, then open Grammar again.'
          }
        ]
      },
      footerMeta: hasLookup ? 'No grammar data' : 'No lookup yet'
    }
  }

  return {
    language,
    sourceCount: 1,
    linkedFrom: `Grammar reference for ${language}`,
    browserUrl: grammarEntry.url,
    sources: [
      {
        id: 'live',
        title: grammarEntry.provider || 'Grammar',
        meta: grammarEntry.url,
        url: grammarEntry.url,
        active: true
      }
    ],
    reading: {
      anchor: grammarEntry.provider || 'Grammar',
      title: 'Open grammar reference',
      blocks: [
        {
          type: 'p',
          html: `Open the full grammar via <a class="alph-resources__crossref" href="${grammarEntry.url}" target="_blank" rel="noopener">${grammarEntry.provider || 'this link'}</a>.`
        }
      ]
    },
    footerMeta: `${grammarEntry.provider || 'Grammar'} · official browser`
  }
}
