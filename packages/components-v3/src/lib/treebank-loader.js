/**
 * Treebank数据加载器
 * 支持三种模式：
 * 1. embedded - 小型数据集打包在扩展内（fixture）
 * 2. cdn - 从CDN加载按需分割的数据包
 * 3. api - 从在线API动态查询
 */

const TREEBANK_CDN_BASE = 'https://cdn.alpheios.net/treebank/v2.1'
const TREEBANK_API_BASE = window.ALPHEIOS_TREEBANK_API || 'http://localhost:3000'

// 内嵌数据集索引（精选小文本，打包在扩展内）
const EMBEDDED_WORKS = {
  'phi0690.phi003.perseus-lat1': { lang: 'latin', title: 'Vergil Aeneid', size: 177 },
  'tlg0012.tlg001.perseus-grc1': { lang: 'greek', title: 'Homer Iliad', size: 8408 }
}

// CDN数据包索引（按文本分割的JSON文件）
const CDN_CATALOG = {}

let loadedCache = new Map() // docId -> sentences[]
let embeddedData = null

/**
 * 设置内嵌数据（从fixture导入）
 * @param {Object} data - { [docId]: sentences[] }
 */
export function setEmbeddedData (data) {
  embeddedData = data || {}
}

/**
 * 从内嵌数据加载
 * @param {string} docId - 文档ID，如 'phi0690.phi003.perseus-lat1'
 * @returns {Array|null} 句子数组
 */
function loadEmbedded (docId) {
  if (!embeddedData || !embeddedData[docId]) return null
  return embeddedData[docId]
}

/**
 * 从CDN加载文本数据包
 * @param {string} docId - 文档ID
 * @returns {Promise<Array|null>}
 */
async function loadFromCDN (docId) {
  if (loadedCache.has(docId)) {
    return loadedCache.get(docId)
  }

  const work = EMBEDDED_WORKS[docId]
  if (!work) return null

  const lang = work.lang
  const filename = docId.replace(/\.perseus-(lat|grc)\d*$/, '')
  const url = `${TREEBANK_CDN_BASE}/${lang}/${filename}.json`

  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const sentences = await response.json()
    loadedCache.set(docId, sentences)
    return sentences
  } catch (err) {
    console.warn(`[treebank-loader] CDN load failed for ${docId}:`, err)
    return null
  }
}

/**
 * 从API查询单个句子或完整文本
 * @param {string} docId - 文档ID
 * @param {string} [sentenceId] - 句子ID或CTS cite（可选）
 * @returns {Promise<Object|Array|null>}
 */
async function loadFromAPI (docId, sentenceId) {
  const lang = docId.includes('tlg') ? 'greek' : 'latin'

  if (sentenceId) {
    // 先尝试直接按ID加载
    const url = `${TREEBANK_API_BASE}/${lang}/${docId}/${sentenceId}`
    try {
      const response = await fetch(url)
      if (response.ok) {
        return await response.json()
      }
    } catch (err) {
      // 失败则尝试按cite查询
    }

    // 如果直接ID失败，且sentenceId看起来像cite（包含.），则查询索引
    if (sentenceId.includes('.')) {
      try {
        const indexUrl = `${TREEBANK_API_BASE}/${lang}/${docId}`
        const indexResponse = await fetch(indexUrl)
        if (indexResponse.ok) {
          const index = await indexResponse.json()
          const sentence = index.sentences?.find(s => s.cite === sentenceId)
          if (sentence) {
            // 按index加载完整句子数据
            const sentUrl = `${TREEBANK_API_BASE}/${lang}/${docId}/${sentence.index}`
            const sentResponse = await fetch(sentUrl)
            if (sentResponse.ok) {
              return await sentResponse.json()
            }
          }
        }
      } catch (err) {
        console.warn(`[treebank-loader] API cite lookup failed for ${docId}/${sentenceId}:`, err)
      }
    }

    console.warn(`[treebank-loader] API load failed for ${docId}/${sentenceId}`)
    return null
  } else {
    // 加载索引（所有句子的元数据）
    const url = `${TREEBANK_API_BASE}/${lang}/${docId}`
    try {
      const response = await fetch(url)
      if (!response.ok) return null
      const index = await response.json()
      // 返回句子列表（注意：不含nodes/edges，仅元数据）
      return index.sentences || []
    } catch (err) {
      console.warn(`[treebank-loader] API index load failed for ${docId}:`, err)
      return null
    }
  }
}

/**
 * 加载treebank数据
 * @param {Object} options
 * @param {string} options.docId - 文档ID（CTS URN或简化形式）
 * @param {string} [options.sentenceId] - 句子ID（可选，用于按需加载单句）
 * @param {string} [options.mode='auto'] - 加载模式: 'embedded' | 'cdn' | 'api' | 'auto'
 * @returns {Promise<Array|Object|null>} 句子数组（全文）或单个句子对象
 */
export async function loadTreebankData ({ docId, sentenceId, mode = 'auto' }) {
  // 标准化docId（移除urn:cts前缀）
  const normalizedDocId = docId.replace(/^urn:cts:[^:]+:/, '').replace(/\.tb$/, '')

  // auto模式：优先级 embedded > cdn > api
  if (mode === 'auto' || mode === 'embedded') {
    const embedded = loadEmbedded(normalizedDocId)
    if (embedded) {
      if (sentenceId) {
        return embedded.find(s => s.id === sentenceId) || null
      }
      return embedded
    }
    if (mode === 'embedded') return null
  }

  if (mode === 'auto' || mode === 'cdn') {
    const cdn = await loadFromCDN(normalizedDocId)
    if (cdn) {
      if (sentenceId) {
        return cdn.find(s => s.id === sentenceId) || null
      }
      return cdn
    }
    if (mode === 'cdn') return null
  }

  if (mode === 'auto' || mode === 'api') {
    const apiResult = await loadFromAPI(normalizedDocId, sentenceId)
    if (apiResult) return apiResult
    if (mode === 'api') return null
  }

  return null
}

/**
 * 预加载指定文本（用于优化性能）
 * @param {string} docId - 文档ID
 * @param {string} [mode='cdn'] - 加载模式
 * @returns {Promise<boolean>} 是否成功预加载
 */
export async function preloadWork (docId, mode = 'cdn') {
  const normalizedDocId = docId.replace(/^urn:cts:[^:]+:/, '').replace(/\.tb$/, '')

  if (mode === 'cdn') {
    const data = await loadFromCDN(normalizedDocId)
    return data !== null
  }

  return false
}

/**
 * 获取可用的内嵌文本列表
 * @returns {Array<Object>} [{ docId, title, lang, size }]
 */
export function getEmbeddedWorks () {
  return Object.entries(EMBEDDED_WORKS).map(([docId, info]) => ({
    docId,
    ...info
  }))
}

/**
 * 清除缓存
 */
export function clearCache () {
  loadedCache.clear()
}
