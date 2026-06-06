/**
 * Catalog of browsable grammar books, mirroring
 * `packages/res-client/src/grammar/config.json`. `homeUrl` is each book's
 * landing page (verified to return 200). `source` is the book's bibliographic
 * attribution (the `rights` field from config.json), shown in the drawer
 * footer. Only Allen & Greenough is modernized by the grammar reader today;
 * the others load in their original styling.
 */
export const GRAMMAR_BOOKS = [
  { id: 'allen-greenough', title: 'Allen & Greenough', language: 'Latin', langCode: 'lat', homeUrl: 'https://grammars.alpheios.net/allen-greenough/index.htm', source: 'Allen and Greenough’s New Latin Grammar for Schools and Colleges, edited by J.B. Greenough, G.L. Kittredge, A.A. Howard, and Benjamin L. D’Ooge. Boston: Ginn & Company, 1903.' },
  { id: 'bennett', title: 'Bennett', language: 'Latin', langCode: 'lat', homeUrl: 'https://grammars.alpheios.net/bennett/index.htm', source: 'New Latin Grammar, by Charles E. Bennett. Copyright 1895; 1908; 1918.' },
  { id: 'smyth', title: 'Smyth', language: 'Greek', langCode: 'grc', homeUrl: 'https://grammars.alpheios.net/smyth/xhtml/smyth.html', source: 'Smyth’s Greek Grammar for Colleges, by Herbert Weir Smyth.' }
]

/**
 * Default browsable book for a language code, or null when no book covers it
 * (e.g. Arabic) — never fall back to a different language's grammar.
 */
export function defaultGrammarBook (langCode) {
  return GRAMMAR_BOOKS.find(b => b.langCode === langCode) || null
}

/**
 * Build the dropdown list of all books, flagging the one matching the current
 * browse URL (or, failing that, the current language).
 */
function buildBookList (browserUrl, langCode) {
  return GRAMMAR_BOOKS.map(book => ({
    id: book.id,
    title: book.title,
    language: book.language,
    label: `${book.title} · ${book.language}`,
    url: book.homeUrl,
    source: book.source,
    active: browserUrl
      ? browserUrl.includes(`/${book.id}/`)
      : book.langCode === langCode
  }))
}

export function buildGrammarData ({ langCode, langName, grammarEntry, hasLookup }) {
  const language = langName || langCode || ''
  const books = buildBookList(grammarEntry && grammarEntry.url, langCode)
  if (!grammarEntry || !grammarEntry.url) {
    // No lookup-driven grammar URL — still let the user browse books when one
    // covers this language, defaulting to the preferred book. Languages with no
    // grammar book (e.g. Arabic) keep an empty browserUrl → explicit empty state.
    const fallbackBook = defaultGrammarBook(langCode)
    return {
      language,
      sourceCount: 0,
      books,
      linkedFrom: hasLookup
        ? 'No grammar reference available for this lookup.'
        : 'Look up a word to load grammar resources.',
      sources: [],
      browserUrl: fallbackBook ? fallbackBook.homeUrl : '',
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
    books,
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
