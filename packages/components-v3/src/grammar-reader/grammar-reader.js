const GRAMMAR_READER_HOST = 'grammars.alpheios.net'
const GRAMMAR_READER_PATH = '/allen-greenough/'
const GRAMMAR_READER_CLASS = 'ag-modern-reader'
const GRAMMAR_READER_FLAG = '__alpheiosGrammarReader__'

// postMessage protocol with the embedding extension panel (ResourcesPage.vue).
// The grammar page is cross-origin to the panel, so the panel can only talk to
// it via postMessage. The reader script lives *inside* the grammar frame and is
// same-origin with it, so it can drive history/reload and read the title here.
const HOST_MSG_SOURCE = 'alph-grammar-host'   // panel → reader
const READER_MSG_SOURCE = 'alph-grammar'      // reader → panel

export function isGrammarReaderPage (location = window.location) {
  return location.hostname === GRAMMAR_READER_HOST && location.pathname.startsWith(GRAMMAR_READER_PATH)
}

function removeLegacyStylesheet () {
  const legacyStylesheet = document.querySelector('link[href="site.css"]')
  if (legacyStylesheet) {
    legacyStylesheet.remove()
  }
}

function createReaderNav () {
  if (document.querySelector('.ag-reader-nav')) return

  const nav = document.createElement('nav')
  nav.className = 'ag-reader-nav'
  nav.setAttribute('aria-label', 'Grammar reader navigation')

  const contentsLink = document.createElement('a')
  contentsLink.className = 'ag-reader-nav__link'
  contentsLink.href = 'index.htm'
  contentsLink.textContent = 'Contents'

  const title = document.createElement('span')
  title.className = 'ag-reader-nav__title'
  title.textContent = 'Allen & Greenough'

  nav.append(contentsLink, title)
  document.body.insertBefore(nav, document.body.firstChild)
}

function enhanceTables () {
  document.querySelectorAll('#page-wrapper table').forEach(table => {
    if (table.closest('.ag-table-scroll')) return

    const scroll = document.createElement('div')
    scroll.className = 'ag-table-scroll'
    table.parentNode.insertBefore(scroll, table)
    scroll.appendChild(table)
  })
}

function enhanceImages () {
  document.querySelectorAll('#page-wrapper img').forEach(img => {
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
    const img = event.target.closest('#page-wrapper img.ag-readable-image')
    if (!img) return
    window.open(img.currentSrc || img.src, '_blank', 'noopener,noreferrer')
  })

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return

    const img = event.target.closest('#page-wrapper img.ag-readable-image')
    if (!img) return

    event.preventDefault()
    window.open(img.currentSrc || img.src, '_blank', 'noopener,noreferrer')
  })
}

function markContentsPage () {
  // The Allen & Greenough contents page (index.htm) has no `#page-wrapper`;
  // its entries live in top-level `div.contents` elements. Section pages keep
  // their `#page-wrapper`. Detect both shapes so the contents layout applies
  // regardless of which markup the page uses.
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
  if (!isGrammarReaderPage()) return false

  // Idempotency guard: the reader can be delivered twice into the same frame —
  // once by the declarative content script (manifest) and once by the
  // background's programmatic `scripting` injection (reliable path for the
  // embedded cross-origin iframe). Run the DOM work only once per frame.
  if (window[GRAMMAR_READER_FLAG]) return true
  window[GRAMMAR_READER_FLAG] = true

  // Bridge to the embedding panel (theme + navigation). Safe on the contents
  // page too, so set it up before the `#page-wrapper` branch.
  setupHostBridge()

  // When embedded in the extension panel, the panel's own toolbar (home, the
  // book dropdown, open-in-new) already covers what `.ag-reader-nav` provides,
  // so the injected nav would be a duplicate "Contents / Allen & Greenough"
  // bar. Mark the embedded case and skip the nav; keep it for direct visits.
  const embedded = window.parent !== window
  if (embedded) document.documentElement.classList.add('ag-modern-reader--embedded')

  // Add the class *before* the `#page-wrapper` check so the contents page
  // (index.htm, which has no `#page-wrapper`) still receives base reader
  // styling and modernization.
  document.documentElement.classList.add(GRAMMAR_READER_CLASS)
  removeLegacyStylesheet()
  if (!embedded) createReaderNav()
  markContentsPage()

  // Section pages wrap their body in `#page-wrapper`; table/image enhancement
  // is scoped to it. The contents page has no wrapper, so skip those steps.
  if (document.getElementById('page-wrapper')) {
    enhanceTables()
    enhanceImages()
    bindImageOpenHandler()
  }

  return true
}
