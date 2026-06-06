const GRAMMAR_READER_HOST = 'grammars.alpheios.net'
const GRAMMAR_READER_CLASS = 'ag-modern-reader'
const GRAMMAR_READER_FLAG = '__alpheiosGrammarReader__'

// postMessage protocol with the embedding extension panel (ResourcesPage.vue).
// The grammar page is cross-origin to the panel, so the panel can only talk to
// it via postMessage. The reader script lives *inside* the grammar frame and is
// same-origin with it, so it can drive history/reload and read the title here.
const HOST_MSG_SOURCE = 'alph-grammar-host'   // panel → reader
const READER_MSG_SOURCE = 'alph-grammar'      // reader → panel

// Per-book configuration. Each grammar on grammars.alpheios.net has its own
// path, markup quirks and contents page, so the reader is driven by a small
// table rather than A&G-specific constants. `contentSelector` is where the
// readable body lives (A&G wraps it in `#page-wrapper`; Smyth has none, so the
// content sits directly on `<body>`). `legacyStylesheets` are removed outright;
// books whose original CSS carries needed layout (Smyth's tei.css) keep it and
// are restyled via higher-specificity rules instead.
const GRAMMAR_BOOKS = [
  {
    id: 'allen-greenough',
    pathPrefix: '/allen-greenough/',
    modifierClass: null,            // A&G is the default: its rules are scoped to
    navTitle: 'Allen & Greenough',  // the A&G-only `#page-wrapper`, so no body
    contentsHref: 'index.htm',      // modifier class is needed.
    legacyStylesheets: ['site.css'],
    contentSelector: '#page-wrapper'
  },
  {
    id: 'smyth',
    pathPrefix: '/smyth/xhtml/',
    modifierClass: 'ag-modern-reader--smyth',
    navTitle: 'Smyth',
    contentsHref: 'smyth.html',
    legacyStylesheets: [],
    contentSelector: 'body'
  }
]

function matchBook (location = window.location) {
  if (location.hostname !== GRAMMAR_READER_HOST) return null
  return GRAMMAR_BOOKS.find(book => location.pathname.startsWith(book.pathPrefix)) || null
}

export function isGrammarReaderPage (location = window.location) {
  return matchBook(location) != null
}

function removeLegacyStylesheet (book) {
  book.legacyStylesheets.forEach(href => {
    const legacyStylesheet = document.querySelector(`link[href="${href}"]`)
    if (legacyStylesheet) {
      legacyStylesheet.remove()
    }
  })
}

function createReaderNav (book) {
  if (document.querySelector('.ag-reader-nav')) return

  const nav = document.createElement('nav')
  nav.className = 'ag-reader-nav'
  nav.setAttribute('aria-label', 'Grammar reader navigation')

  const contentsLink = document.createElement('a')
  contentsLink.className = 'ag-reader-nav__link'
  contentsLink.href = book.contentsHref
  contentsLink.textContent = 'Contents'

  const title = document.createElement('span')
  title.className = 'ag-reader-nav__title'
  title.textContent = book.navTitle

  nav.append(contentsLink, title)
  document.body.insertBefore(nav, document.body.firstChild)
}

function enhanceTables (book) {
  document.querySelectorAll(`${book.contentSelector} table`).forEach(table => {
    // Smyth tables already sit in a `.leftTable` wrapper that the CSS turns into
    // a horizontal scroll container; only bare tables need our own wrapper.
    if (table.closest('.ag-table-scroll, .leftTable')) return

    const scroll = document.createElement('div')
    scroll.className = 'ag-table-scroll'
    table.parentNode.insertBefore(scroll, table)
    scroll.appendChild(table)
  })
}

function enhanceImages (book) {
  document.querySelectorAll(`${book.contentSelector} img`).forEach(img => {
    img.loading = 'lazy'
    img.decoding = 'async'
    img.classList.add('ag-readable-image')

    if (!img.hasAttribute('tabindex')) {
      img.tabIndex = 0
    }
    if (!img.hasAttribute('role')) {
      img.setAttribute('role', 'button')
    }
    if (!img.hasAttribute('aria-label')) {
      img.setAttribute('aria-label', 'Open grammar table image in a new tab')
    }
  })
}

function bindImageOpenHandler () {
  document.addEventListener('click', event => {
    const img = event.target.closest('img.ag-readable-image')
    if (!img) return
    window.open(img.currentSrc || img.src, '_blank', 'noopener,noreferrer')
  })

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return

    const img = event.target.closest('img.ag-readable-image')
    if (!img) return

    event.preventDefault()
    window.open(img.currentSrc || img.src, '_blank', 'noopener,noreferrer')
  })
}

function markContentsPage (book) {
  // The Allen & Greenough contents page (index.htm) has no `#page-wrapper`;
  // its entries live in top-level `div.contents` elements. Section pages keep
  // their `#page-wrapper`. Smyth's contents page (smyth.html) is flagged with
  // `body.simple` and holds a `ul.toc` list. Detect every shape so the contents
  // layout applies regardless of which markup the page uses.
  if (book.id === 'smyth') {
    if (document.body.classList.contains('simple') || document.querySelector('ul.toc')) {
      document.documentElement.classList.add('ag-modern-reader--contents')
    }
    return
  }

  const scope = document.getElementById('page-wrapper') || document.body
  if (!scope) return

  const hasContentsBlocks = scope.querySelector(':scope > div.contents, div.contents')
  const firstHeading = scope.querySelector('h1, h2')
  const headingIsContents = firstHeading && /contents|table of contents/i.test(firstHeading.textContent)

  if (hasContentsBlocks || headingIsContents) {
    document.documentElement.classList.add('ag-modern-reader--contents')
  }
}

function postStateToHost () {
  try {
    window.parent.postMessage({
      source: READER_MSG_SOURCE,
      type: 'state',
      url: window.location.href,
      title: document.title || ''
    }, '*')
  } catch (e) { /* no parent, or blocked */ }
}

function setupHostBridge () {
  // Only meaningful when embedded in another frame (the extension panel).
  if (window.parent === window) return

  window.addEventListener('message', event => {
    const data = event.data
    if (!data || data.source !== HOST_MSG_SOURCE) return
    switch (data.action) {
      case 'set-theme':
        if (data.theme === 'dark' || data.theme === 'light') {
          document.documentElement.dataset.agTheme = data.theme
        }
        break
      case 'back': try { window.history.back() } catch (e) { /* end of history */ } break
      case 'forward': try { window.history.forward() } catch (e) { /* end of history */ } break
      case 'reload': try { window.location.reload() } catch (e) { /* blocked */ } break
    }
  })

  // A bfcache restore re-shows the page without a fresh script run; resync.
  window.addEventListener('pageshow', postStateToHost)

  // Announce readiness so the panel can push the current theme, then report
  // our URL/title so the panel toolbar can reflect the live page.
  try {
    window.parent.postMessage({ source: READER_MSG_SOURCE, type: 'ready', url: window.location.href, title: document.title || '' }, '*')
  } catch (e) { /* blocked */ }
  postStateToHost()
}

export function initializeGrammarReader () {
  const book = matchBook()
  if (!book) return false

  // Idempotency guard: the reader can be delivered twice into the same frame —
  // once by the declarative content script (manifest) and once by the
  // background's programmatic `scripting` injection (reliable path for the
  // embedded cross-origin iframe). Run the DOM work only once per frame.
  if (window[GRAMMAR_READER_FLAG]) return true
  window[GRAMMAR_READER_FLAG] = true

  // Bridge to the embedding panel (theme + navigation). Safe on the contents
  // page too, so set it up before the content branch.
  setupHostBridge()

  // When embedded in the extension panel, the panel's own toolbar (home, the
  // book dropdown, open-in-new) already covers what `.ag-reader-nav` provides,
  // so the injected nav would be a duplicate "Contents / <book>" bar. Mark the
  // embedded case and skip the nav; keep it for direct visits.
  const embedded = window.parent !== window
  if (embedded) document.documentElement.classList.add('ag-modern-reader--embedded')

  // Add the classes *before* the content check so the contents page (which may
  // lack the content wrapper) still receives base reader styling. A&G has no
  // modifier class (it is the default, scoped via `#page-wrapper`).
  document.documentElement.classList.add(GRAMMAR_READER_CLASS)
  if (book.modifierClass) document.documentElement.classList.add(book.modifierClass)
  removeLegacyStylesheet(book)
  if (!embedded) createReaderNav(book)
  markContentsPage(book)

  // Enhance the readable body when present. A&G wraps it in `#page-wrapper`;
  // Smyth uses `<body>`, which always exists. The contents page may lack the
  // wrapper, so skip these steps there.
  if (document.querySelector(book.contentSelector)) {
    enhanceTables(book)
    enhanceImages(book)
    bindImageOpenHandler()
  }

  return true
}
