/* eslint-env jest */
import Lexis from '@comp/vue/vuex-modules/data/lexis'
import LexicalQuery from '@comp/lib/queries/lexical-query'
import { Constants } from 'alpheios-data-models'

describe('lexis-module.test.js', () => {
  const createLexisModule = () => {
    const moduleInstance = Object.create(Lexis.prototype)
    moduleInstance._appApi = {
      clientId: 'test-client',
      getWordUsageExamplesQueryParams: jest.fn(() => null),
      newLexicalRequest: jest.fn()
    }
    moduleInstance._settingsApi = {
      isInVerboseMode: jest.fn(() => false),
      getResourceOptions: jest.fn(() => ({ items: {} }))
    }
    moduleInstance._lexisConfig = {}
    moduleInstance._lexiconsConfig = {}
    moduleInstance._lemmaTranslationEnabled = false
    moduleInstance._lemmaTranslationLocale = null
    moduleInstance._treebankAvailable = false
    moduleInstance.getTreebankWordIDs = jest.fn(() => Promise.resolve([]))
    moduleInstance.getTreebankData = jest.fn(() => Promise.resolve(null))
    moduleInstance.getWordQueryData = jest.fn(() => Promise.resolve({ homonym: null }))
    return moduleInstance
  }

  const store = {
    commit: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses LexicalQuery for Latin lookup instead of the wordQuery bypass', async () => {
    const moduleInstance = createLexisModule()
    const getData = jest.fn(() => Promise.resolve('legacy-result'))
    jest.spyOn(LexicalQuery, 'create').mockReturnValue({ getData })

    await moduleInstance.lexicalQuery({
      store,
      textSelector: {
        normalizedText: 'quamquam',
        languageID: Constants.LANG_LATIN,
        languageCode: 'lat',
        location: 'https://texts.alpheios.net/',
        data: null
      },
      source: LexicalQuery.sources.LOOKUP
    })

    expect(moduleInstance.getWordQueryData).not.toHaveBeenCalled()
    expect(LexicalQuery.create).toHaveBeenCalledWith(expect.objectContaining({
      normalizedText: 'quamquam',
      languageID: Constants.LANG_LATIN
    }), expect.objectContaining({
      source: LexicalQuery.sources.LOOKUP
    }))
    expect(getData).toHaveBeenCalled()
  })
})
