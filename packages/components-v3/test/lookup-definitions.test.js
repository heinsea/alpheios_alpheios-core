import test from 'node:test'
import assert from 'node:assert/strict'

import { definitionSenseItems } from '../src/pages/lookup-definitions.js'

test('definition sense items use GoldenDict-style roman labels', () => {
  const items = definitionSenseItems([
    'arms, weapons, armor.',
    'war, battle, strife.',
    'tools, implements, equipment.'
  ])

  assert.deepEqual(items.map(item => item.label), ['I', 'II', 'III'])
})

test('definition sense items preserve definition html', () => {
  const items = definitionSenseItems([
    'tools, implements <em>(esp. farming)</em>.'
  ])

  assert.equal(items[0].html, 'tools, implements <em>(esp. farming)</em>.')
  assert.equal(items[0].blocks, null)
})

test('long dictionary definitions are returned as structured readable blocks', () => {
  const items = definitionSenseItems([
    'mĕmor , ŏris, adj. mindful of a thing, remembering; I. In gen. (a). With gen.: “ut memor esses sui,” Ter. And. 1, 5, 46 .— B. Trop., of inanim. things. From A Latin Dictionary (Charlton T. Lewis, Charles Short, Oxford, Clarendon Press, 1879)'
  ])

  assert.equal(items[0].html, '')
  assert.deepEqual(items[0].blocks.map(block => block.kind), ['plain', 'major', 'sub', 'major', 'source'])
  assert.equal(items[0].blocks[1].heading, 'I. In gen.')
  assert.equal(items[0].blocks[2].heading, '(a).')
  assert.match(items[0].blocks[2].html, /alph-lookup__dict-quote/)
  assert.equal(items[0].blocks[3].heading, 'B. Trop.')
  assert.match(items[0].blocks[4].html, /From A Latin Dictionary/)
})

test('full Latin dictionary entries split nested paragraphs into readable blocks', () => {
  const items = definitionSenseItems([
    'mĕmor , ŏris (anciently memoris, memore, acc. to Prisc. p. 772 P.; I.comp. memorior, id. p. 699 P.), adj. mindful of a thing, remembering; constr. with gen., with acc. and inf., with a rel,clause, and absol. I. In gen. (a). With gen.: “ut memor esses sui,” Ter. And. 1, 5, 46 .— (b). With acc. and inf.: “memor Lucullum periisse,” Plin. 25, 3, 7, § 25 .— (g). With a rel. -clause: “memor, quo ordine quisque discubuerat,” Quint. 11, 2, 13 .— (d). Absol. : “memorem et gratum esse,” Cic. Fam. 13, 25 .— B. Trop., of inanim. things et cadum Marsi memorem duelli, which remembers the Marsian war. II. Esp. A. That easily remembers, possessed of a good memory: “homo ingeniosus ac memor,” Cic. de Or. 3, 50, 194 .— B. Poet., transf., that reminds one of a thing: “nostri memorem sepulcro Scalpe querelam,” Hor. C. 3, 11, 51 .— Hence, adv., in two forms. A. mĕmŏre , by heart, readily. B. mĕmŏrĭter . 1. From memory, by personal recollection: “oratio est habita memoriter,” Cic. Ac. 2, 19, 63 .— 2. Esp. (a). With a good memory, by ready recollection: “ista exposuisti,” Cic. Fin. 4, 1, 1 .— (b). Fully, accurately, correctly, Ter. Eun. 5, 3, 6. From A Latin Dictionary (Charlton T. Lewis, Charles Short, Oxford, Clarendon Press, 1879)'
  ])

  const headings = items[0].blocks.map(block => block.heading).filter(Boolean)

  assert.ok(items[0].blocks.length >= 17)
  assert.ok(headings.includes('I. In gen.'))
  assert.ok(headings.includes('(b).'))
  assert.ok(headings.includes('(g).'))
  assert.ok(headings.includes('(d).'))
  assert.ok(headings.includes('II. Esp.'))
  assert.ok(headings.includes('A. mĕmŏre , by heart, readily.'))
  assert.ok(headings.includes('1. From memory, by personal recollection'))
  assert.ok(headings.includes('2. Esp.'))
  assert.equal(items[0].blocks.at(-1).kind, 'source')
})

test('memoro-style entries preserve dictionary paragraph breaks including passives and Greek letter clauses', () => {
  const items = definitionSenseItems([
    'mĕmŏro , āvi, ātum (archaic I.inf. pass. memorarier, Plaut. Most. 1, 3, 99), 1, v. a. memor, to bring to remembrance, remind of, to mention, recount, relate, speak about or of, say, tell (class.). (a). With acc.: “memorare mores mulierum,” Plaut. Aul. 3, 5, 50 .—Pass.: “quid illa pote pejus muliere memorarier,” Plaut. Most. 1, 3, 99 .— (b). With de: “de naturā nimis obscure memoravit,” Cic. Fin. 2, 5, 15 .— (g). With acc. and inf.: “quem infestum ac odiosum sibi esse, memorabat,” Plaut. Truc. 1, 1, 65 .— (d). With a rel.-clause: “musa, velim memores,” Hor. S. 1, 5, 53 . —(ε) With sic: “sic memorat,” Verg. A. 1, 631 .— B. Esp., to speak, utter, make use of in speech: “scio ego multos memoravisse milites mendacium,” Plaut. Truc. 2, 6, 3 .— II. Memorare significat nunc dicere, nunc memoriae mandare, Paul. ex Fest. p. 124 Müll.—Hence, A. mĕmŏrātus , a, um, P. a., memorable, renowned, celebrated: “ubi nunc nobis deus ille magister nequiquam memoratus Eryx?” Verg. A. 5, 391 .— 2. Esp., before mentioned: “dux,” Amm. 15, 5, 4 al. — B. mĕmŏrandus , a, um, P. a., worthy of remembrance, memorable, celebrated. From A Latin Dictionary (Charlton T. Lewis, Charles Short, Oxford, Clarendon Press, 1879)'
  ])

  const headings = items[0].blocks.map(block => block.heading).filter(Boolean)

  assert.ok(items[0].blocks.length >= 14)
  assert.ok(headings.includes('(a).'))
  assert.ok(headings.includes('Pass.:'))
  assert.ok(headings.includes('(ε)'))
  assert.ok(headings.includes('B. Esp.'))
  assert.ok(headings.includes('II. Memorare significat nunc dicere, nunc memoriae mandare, Paul.'))
  assert.ok(headings.includes('A. mĕmŏrātus , a, um, P. a., memorable, renowned, celebrated'))
  assert.ok(headings.includes('2. Esp., before mentioned'))
  assert.equal(items[0].blocks.at(-1).kind, 'source')
})
