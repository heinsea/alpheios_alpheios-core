import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  configureTreebank,
  resetTreebankConfig,
  resolveLang,
  getWorkInfo,
  getWorkIndex,
  getSentence,
  setEmbeddedData,
  clearTreebankCaches,
  findSentenceIdByCite
} from '../src/lib/treebank-service.js'

let fetchCalls = []
let fetchRoutes = {}

function mockFetch (routes) {
  fetchRoutes = routes
  globalThis.fetch = async (url) => {
    fetchCalls.push(url)
    if (url in fetchRoutes) {
      return { ok: true, json: async () => fetchRoutes[url] }
    }
    return { ok: false, status: 404 }
  }
}

const AENEID = 'phi0690.phi003.perseus-lat1'
const CDN = 'https://cdn.jsdelivr.net/npm/luna-treebank-latin@2.1.0-alpha.0'

const sampleIndex = {
  docId: `urn:cts:latinLit:${AENEID}`,
  total: 2,
  sentences: [
    { id: '1', index: 1, cite: '6.1', text: 'Sic fatur lacrimans' },
    { id: '2', index: 2, cite: '6.1', text: 'classique immittit habenas' }
  ]
}

const sampleSentence = {
  id: '1', index: 1, cite: '6.1', text: 'Sic fatur lacrimans',
  nodes: [{ id: 0, isRoot: true }, { id: 1, form: 'Sic' }],
  edges: [{ from: 0, to: 1, relation: 'ADV' }]
}

beforeEach(() => {
  resetTreebankConfig()
  clearTreebankCaches()
  setEmbeddedData(null)
  fetchCalls = []
  mockFetch({})
})

test('resolveLang: catalog beats prefix heuristics (Vulgate is Latin)', () => {
  assert.equal(resolveLang('tlg0031.tlg027.perseus-lat1'), 'latin')
  assert.equal(resolveLang('tlg0012.tlg001.perseus-grc1'), 'greek')
})

test('resolveLang: normalizes urn prefix and falls back to suffix', () => {
  assert.equal(resolveLang(`urn:cts:latinLit:${AENEID}`), 'latin')
  assert.equal(resolveLang('unknown.work.perseus-grc9'), 'greek')
  assert.equal(resolveLang('unknown.work.perseus-lat2'), 'latin')
  assert.equal(resolveLang('no-suffix-at-all'), null)
})

test('getWorkInfo returns catalog metadata', () => {
  const info = getWorkInfo(`urn:cts:latinLit:${AENEID}`)
  assert.equal(info.lang, 'latin')
  assert.equal(info.author, 'Vergil')
  assert.equal(info.title, 'Aeneid')
})

test('cdn provider requests jsDelivr package URLs', async () => {
  mockFetch({ [`${CDN}/${AENEID}/_index.json`]: sampleIndex })
  const { index, source } = await getWorkIndex(`urn:cts:latinLit:${AENEID}`)
  assert.equal(source, 'cdn')
  assert.equal(index.total, 2)
  assert.deepEqual(fetchCalls, [`${CDN}/${AENEID}/_index.json`])
})

test('cdn version, scope and prefix are configurable', async () => {
  configureTreebank({ cdnVersion: '2.1.0', cdnScope: '@heinsea', cdnPackagePrefix: 'alpheios-treebank-data' })
  const url = `https://cdn.jsdelivr.net/npm/@heinsea/alpheios-treebank-data-latin@2.1.0/${AENEID}/1.json`
  mockFetch({ [url]: sampleSentence })
  const { sentence, source } = await getSentence(AENEID, '1')
  assert.equal(source, 'cdn')
  assert.equal(sentence.id, '1')
})

test('falls back to embedded when cdn misses', async () => {
  setEmbeddedData({ [AENEID]: [sampleSentence] })
  const { sentence, source } = await getSentence(AENEID, '1')
  assert.equal(source, 'embedded')
  assert.equal(sentence.cite, '6.1')
})

test('embedded provider synthesizes an index', async () => {
  setEmbeddedData({ [AENEID]: [sampleSentence] })
  const { index, source } = await getWorkIndex(AENEID)
  assert.equal(source, 'embedded')
  assert.equal(index.total, 1)
  assert.deepEqual(index.sentences[0], { id: '1', index: 1, cite: '6.1', text: 'Sic fatur lacrimans' })
})

test('api provider is opt-in and uses local-api-split route shape (no .json suffix)', async () => {
  const { sentence: none } = await getSentence(AENEID, '1', { providers: ['api'] })
  assert.equal(none, null, 'api must be unavailable without apiBase')

  configureTreebank({ apiBase: 'http://localhost:3000' })
  mockFetch({ [`http://localhost:3000/latin/${AENEID}/1`]: sampleSentence })
  const { sentence, source } = await getSentence(AENEID, '1', { providers: ['api'] })
  assert.equal(source, 'api')
  assert.equal(sentence.id, '1')
})

test('sentence cache prevents repeat fetches', async () => {
  mockFetch({ [`${CDN}/${AENEID}/1.json`]: sampleSentence })
  await getSentence(AENEID, '1')
  await getSentence(`urn:cts:latinLit:${AENEID}`, '1')
  assert.equal(fetchCalls.length, 1)
})

test('per-call provider overrides bypass the cache', async () => {
  mockFetch({ [`${CDN}/${AENEID}/1.json`]: sampleSentence })
  await getSentence(AENEID, '1')
  setEmbeddedData({ [AENEID]: [sampleSentence] })
  const { source } = await getSentence(AENEID, '1', { providers: ['embedded'] })
  assert.equal(source, 'embedded')
})

test('unknown language returns null instead of throwing', async () => {
  const { index, source } = await getWorkIndex('not-a-real-doc')
  assert.equal(index, null)
  assert.equal(source, null)
})

test('findSentenceIdByCite returns first sentence of a passage anchor', () => {
  assert.equal(findSentenceIdByCite(sampleIndex, '6.1'), '1')
  assert.equal(findSentenceIdByCite(sampleIndex, '9.99'), null)
  assert.equal(findSentenceIdByCite(null, '6.1'), null)
})

test('provider failure is swallowed and resolution continues', async () => {
  globalThis.fetch = async (url) => {
    fetchCalls.push(url)
    throw new Error('network down')
  }
  setEmbeddedData({ [AENEID]: [sampleSentence] })
  const { sentence, source } = await getSentence(AENEID, '1')
  assert.equal(source, 'embedded')
  assert.equal(sentence.id, '1')
})
