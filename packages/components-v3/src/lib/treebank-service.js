/**
 * Treebank data service — provider-based loading with unified addressing.
 *
 * Providers (resolution order: local → cdn → embedded; api is opt-in):
 *   local     extension-origin IndexedDB (offline packages, see treebank-idb.js)
 *   cdn       jsDelivr static packages (luna-treebank-<lang>, unofficial data mirror)
 *   api       local-api-split.mjs compatible server (development)
 *   embedded  fixtures bundled with the build (demo / fallback)
 *
 * All providers share the same data contract:
 *   index    { docId, total, sentences: [{id, index, cite, text}] }
 *   sentence { id, index, docId, cite, text, nodes[], edges[] }
 *
 * Must stay service-worker safe: no `window`, only `globalThis`.
 */
import catalog from './treebank-catalog.json' with { type: 'json' }
import { normalizeDocId } from './treebank-data.js'
import * as idb from './treebank-idb.js'

const DEFAULT_CONFIG = Object.freeze({
  cdnBase: 'https://cdn.jsdelivr.net/npm',
  cdnScope: '',
  cdnPackagePrefix: 'luna-treebank',
  cdnVersion: '2.1.0-alpha.0',
  apiBase: globalThis.ALPHEIOS_TREEBANK_API || '',
  providers: ['local', 'cdn', 'embedded']
})

let config = { ...DEFAULT_CONFIG }

export function configureTreebank (overrides = {}) {
  config = { ...config, ...overrides }
}

export function resetTreebankConfig () {
  config = { ...DEFAULT_CONFIG }
}

export function getTreebankConfig () {
  return { ...config }
}

// ---------------------------------------------------------------- catalog

const docLangMap = new Map()
for (const lang of Object.keys(catalog)) {
  for (const work of catalog[lang]) docLangMap.set(work.docId, lang)
}

export function resolveLang (docId) {
  const normalized = normalizeDocId(docId)
  if (docLangMap.has(normalized)) return docLangMap.get(normalized)
  // Suffix beats author-prefix heuristics: tlg0031 (Vulgate) is Latin.
  if (/-lat\d*(\.|$)/.test(normalized)) return 'latin'
  if (/-grc\d*(\.|$)/.test(normalized)) return 'greek'
  return null
}

export function getCatalog () {
  return catalog
}

export function getWorkInfo (docId) {
  const normalized = normalizeDocId(docId)
  const lang = resolveLang(normalized)
  if (!lang) return null
  const entry = catalog[lang]?.find(w => w.docId === normalized)
  return entry ? { ...entry, lang } : { docId: normalized, title: normalized, lang }
}

// ---------------------------------------------------------------- caches

const INDEX_CACHE_LIMIT = 8
const SENTENCE_CACHE_LIMIT = 300
const indexCache = new Map() // docId -> { index, source }
const sentenceCache = new Map() // 'docId/sid' -> { sentence, source }

function cachePut (cache, limit, key, value) {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  if (cache.size > limit) cache.delete(cache.keys().next().value)
}

function cacheGet (cache, key) {
  if (!cache.has(key)) return null
  const value = cache.get(key)
  cache.delete(key)
  cache.set(key, value)
  return value
}

export function clearTreebankCaches () {
  indexCache.clear()
  sentenceCache.clear()
}

// ---------------------------------------------------------------- providers

let embeddedData = null

export function setEmbeddedData (data) {
  embeddedData = data || {}
}

async function fetchJson (url) {
  const response = await fetch(url)
  if (!response.ok) return null
  return response.json()
}

function cdnPackageUrl (lang) {
  const { cdnBase, cdnScope, cdnPackagePrefix, cdnVersion } = config
  const name = `${cdnPackagePrefix}-${lang}`
  return `${cdnBase}/${cdnScope ? `${cdnScope}/` : ''}${name}@${cdnVersion}`
}

const providers = {
  local: {
    available: () => idb.idbAvailable(),
    getIndex: (docId) => idb.getIndex(docId),
    getSentence: (docId, sentenceId) => idb.getSentence(docId, sentenceId)
  },

  cdn: {
    available: () => true,
    async getIndex (docId, lang) {
      return fetchJson(`${cdnPackageUrl(lang)}/${docId}/_index.json`)
    },
    async getSentence (docId, sentenceId, lang) {
      return fetchJson(`${cdnPackageUrl(lang)}/${docId}/${sentenceId}.json`)
    }
  },

  api: {
    available: () => Boolean(config.apiBase),
    async getIndex (docId, lang) {
      return fetchJson(`${config.apiBase}/${lang}/${docId}`)
    },
    async getSentence (docId, sentenceId, lang) {
      return fetchJson(`${config.apiBase}/${lang}/${docId}/${sentenceId}`)
    }
  },

  embedded: {
    available: () => Boolean(embeddedData),
    async getIndex (docId) {
      const sentences = embeddedData?.[docId]
      if (!sentences) return null
      return {
        docId: sentences[0]?.docId || docId,
        total: sentences.length,
        sentences: sentences.map(s => ({ id: s.id, index: s.index, cite: s.cite, text: s.text }))
      }
    },
    async getSentence (docId, sentenceId) {
      return embeddedData?.[docId]?.find(s => String(s.id) === String(sentenceId)) || null
    }
  }
}

async function resolve (method, docId, sentenceId, options = {}) {
  const normalized = normalizeDocId(docId)
  const lang = resolveLang(normalized)
  if (!lang) return { data: null, source: null }

  const order = options.providers || config.providers
  for (const name of order) {
    const provider = providers[name]
    if (!provider || !provider.available()) continue
    try {
      const data = method === 'getIndex'
        ? await provider.getIndex(normalized, lang)
        : await provider.getSentence(normalized, sentenceId, lang)
      if (data) return { data, source: name }
    } catch (err) {
      console.warn(`[treebank-service] ${name}.${method} failed for ${normalized}:`, err)
    }
  }
  return { data: null, source: null }
}

// ---------------------------------------------------------------- public API

/**
 * @returns {Promise<{index: Object|null, source: string|null}>}
 */
export async function getWorkIndex (docId, options = {}) {
  const normalized = normalizeDocId(docId)
  const cached = cacheGet(indexCache, normalized)
  if (cached && !options.providers) return cached

  const { data, source } = await resolve('getIndex', normalized, undefined, options)
  const result = { index: data, source }
  if (data && !options.providers) cachePut(indexCache, INDEX_CACHE_LIMIT, normalized, result)
  return result
}

/**
 * @returns {Promise<{sentence: Object|null, source: string|null}>}
 */
export async function getSentence (docId, sentenceId, options = {}) {
  const normalized = normalizeDocId(docId)
  const key = `${normalized}/${sentenceId}`
  const cached = cacheGet(sentenceCache, key)
  if (cached && !options.providers) return cached

  const { data, source } = await resolve('getSentence', normalized, String(sentenceId), options)
  const result = { sentence: data, source }
  if (data && !options.providers) cachePut(sentenceCache, SENTENCE_CACHE_LIMIT, key, result)
  return result
}

/**
 * Cite values are passage anchors shared by several sentences (see
 * DATA-INTEGRITY-AUDIT.md) — this returns the FIRST sentence of the passage.
 */
export function findSentenceIdByCite (index, cite) {
  if (!index?.sentences || !cite) return null
  const entry = index.sentences.find(s => s.cite === cite)
  return entry ? entry.id : null
}

// ------------------------------------------------------- offline downloads

async function sha256Hex (buffer) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

const DOWNLOAD_CONCURRENCY = 8

/**
 * Download one work from the CDN into IndexedDB, verifying every file
 * against the package manifest (SHA-256).
 *
 * @param {string} docId
 * @param {Object} [options]
 * @param {Function} [options.onProgress] - ({ done, total }) => void
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{docId: string, files: number, sizeBytes: number}>}
 */
export async function downloadWorkToLocal (docId, { onProgress, signal } = {}) {
  if (!idb.idbAvailable()) throw new Error('IndexedDB is not available in this context')
  const normalized = normalizeDocId(docId)
  const lang = resolveLang(normalized)
  if (!lang) throw new Error(`Unknown language for ${normalized}`)

  const baseUrl = cdnPackageUrl(lang)
  const manifest = await fetchJson(`${baseUrl}/manifest.json`)
  if (!manifest?.files) throw new Error(`Manifest not available for ${lang} package`)

  const workFiles = Object.entries(manifest.files)
    .filter(([path]) => path.startsWith(`${normalized}/`))
  if (!workFiles.length) throw new Error(`${normalized} not found in package manifest`)

  let index = null
  const sentences = []
  let sizeBytes = 0
  let done = 0
  const queue = [...workFiles]

  async function worker () {
    while (queue.length) {
      if (signal?.aborted) throw new Error('Download aborted')
      const [path, meta] = queue.shift()
      const response = await fetch(`${baseUrl}/${path}`)
      if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`)
      const buffer = await response.arrayBuffer()
      const hash = await sha256Hex(buffer)
      if (hash !== meta.sha256) throw new Error(`Integrity check failed for ${path}`)

      const json = JSON.parse(new TextDecoder().decode(buffer))
      const filename = path.slice(normalized.length + 1)
      if (filename === '_index.json') {
        index = json
      } else {
        sentences.push({ id: filename.replace(/\.json$/, ''), sentence: json })
      }
      sizeBytes += buffer.byteLength
      done++
      onProgress?.({ done, total: workFiles.length })
    }
  }

  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker))
  if (!index) throw new Error(`_index.json missing for ${normalized}`)

  const info = getWorkInfo(normalized)
  await idb.requestPersistentStorage()
  await idb.saveWork({
    docId: normalized,
    lang,
    title: info?.title || normalized,
    total: index.total,
    sizeBytes,
    dataVersion: manifest.dataVersion || manifest.version,
    index,
    sentences
  })

  clearTreebankCaches()
  return { docId: normalized, files: workFiles.length, sizeBytes }
}

export async function removeLocalWork (docId) {
  await idb.removeWork(normalizeDocId(docId))
  clearTreebankCaches()
}

export function listLocalWorks () {
  return idb.listInstalledWorks()
}
