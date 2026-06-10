/**
 * Treebank offline storage on extension-origin IndexedDB.
 *
 * Object stores:
 *   works     keyPath 'docId' — registry row + the full _index payload
 *   sentences keyPath 'key' ('docId/sentenceId') — one row per sentence
 *
 * Import-safe outside browsers (no top-level indexedDB access); callers
 * should gate on idbAvailable().
 */

const DB_NAME = 'alpheios-treebank'
const DB_VERSION = 1

let dbPromise = null

export function idbAvailable () {
  return typeof globalThis.indexedDB !== 'undefined'
}

function openDb () {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('works')) {
        db.createObjectStore('works', { keyPath: 'docId' })
      }
      if (!db.objectStoreNames.contains('sentences')) {
        db.createObjectStore('sentences', { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function requestToPromise (request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txDone (tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function listInstalledWorks () {
  if (!idbAvailable()) return []
  const db = await openDb()
  const rows = await requestToPromise(
    db.transaction('works').objectStore('works').getAll()
  )
  return rows.map(({ index, ...meta }) => meta)
}

export async function getWorkRecord (docId) {
  if (!idbAvailable()) return null
  const db = await openDb()
  return (await requestToPromise(
    db.transaction('works').objectStore('works').get(docId)
  )) || null
}

export async function getIndex (docId) {
  const record = await getWorkRecord(docId)
  return record?.index || null
}

export async function getSentence (docId, sentenceId) {
  if (!idbAvailable()) return null
  const db = await openDb()
  const row = await requestToPromise(
    db.transaction('sentences').objectStore('sentences').get(`${docId}/${sentenceId}`)
  )
  return row?.sentence || null
}

const SENTENCE_BATCH_SIZE = 500

/**
 * Persist a fully downloaded work. `sentences` is [{id, sentence}].
 * Written in batches so a single huge transaction does not block the page.
 */
export async function saveWork ({ docId, lang, title, total, sizeBytes, dataVersion, index, sentences }) {
  if (!idbAvailable()) throw new Error('IndexedDB is not available')
  const db = await openDb()

  for (let i = 0; i < sentences.length; i += SENTENCE_BATCH_SIZE) {
    const tx = db.transaction('sentences', 'readwrite')
    const store = tx.objectStore('sentences')
    for (const { id, sentence } of sentences.slice(i, i + SENTENCE_BATCH_SIZE)) {
      store.put({ key: `${docId}/${id}`, sentence })
    }
    await txDone(tx)
  }

  // Registry row last: its presence marks the install as complete.
  const tx = db.transaction('works', 'readwrite')
  tx.objectStore('works').put({
    docId, lang, title, total, sizeBytes, dataVersion, index, installedAt: new Date().toISOString()
  })
  await txDone(tx)
}

export async function removeWork (docId) {
  if (!idbAvailable()) return
  const db = await openDb()
  const record = await getWorkRecord(docId)

  const tx = db.transaction(['works', 'sentences'], 'readwrite')
  tx.objectStore('works').delete(docId)
  const sentenceStore = tx.objectStore('sentences')
  for (const entry of record?.index?.sentences || []) {
    sentenceStore.delete(`${docId}/${entry.id}`)
  }
  await txDone(tx)
}

export async function requestPersistentStorage () {
  try {
    if (globalThis.navigator?.storage?.persist) {
      return await globalThis.navigator.storage.persist()
    }
  } catch (err) {
    console.warn('[treebank-idb] persist() failed:', err)
  }
  return false
}

export async function estimateStorage () {
  try {
    if (globalThis.navigator?.storage?.estimate) {
      return await globalThis.navigator.storage.estimate()
    }
  } catch (err) { /* unsupported */ }
  return null
}
