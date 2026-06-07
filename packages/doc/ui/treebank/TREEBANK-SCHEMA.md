# Treebank Sentence JSON Schema 说明

> Schema 文件：[treebank-sentence.schema.json](treebank-sentence.schema.json)（JSON Schema draft 2020-12）
> 字段背景：[TREEBANK-DATA-FIELDS.md](TREEBANK-DATA-FIELDS.md) · 对照样例：[treebank-example-aeneid-6-1.json](treebank-example-aeneid-6-1.json)
>
> 本文说明如何用该 schema 校验清洗后的单句 treebank 数据，并指出 **JSON Schema 表达不了、必须靠自定义校验器补的不变量**。

---

## 1. 校验单位

schema 校验的是**一棵句子树**（一个 `TreebankSentence` 对象）。整篇文档是 `TreebankSentence[]`，逐句校验即可——对数组每个元素套用本 schema。

`additionalProperties: false` 在三个层级都开了（句 / node / edge），所以**任何未定义字段都会报错**。这是有意的：运行时字段（`x` / `y` / `isHighlighted`）不允许混进清洗产物。

---

## 2. 字段逐项说明

### 2.1 句级（TreebankSentence）

| 字段 | 必需 | 类型 | 说明 |
|---|---|---|---|
| `id` | ✅ | string(≥1) | 句在文档内的 ID |
| `nodes` | ✅ | array(≥1) | 词节点数组 |
| `edges` | ✅ | array | 依存边数组（根无入边，故 N 节点 → N−1 边） |
| `index` | | integer(≥1) | pager 序号 "1 of 756" |
| `total` | | integer(≥1) | 全文句数 |
| `docId` | | string | 文档标识 / CTS URN |
| `cite` | | string | passage 引用 = `@subdoc`，如 `6.1`；作品名（"Aeneid"）由 `docId` 在渲染层映射 |
| `text` | | string | 整句纯文本（底部 strip） |
| `provider` | | string | footer 出处，如 `Perseus treebank` |
| `version` | | string | footer 版本，如 `2.1` |

### 2.2 节点（node）

| 字段 | 必需 | 类型 | 说明 |
|---|---|---|---|
| `id` | ✅ | integer(≥0) | 句内唯一，**作为 `head` 的查找键**（勿用数组下标）；`0` = 合成的虚拟根 |
| `form` | ✅ | string(≥1) | 表层 token，可能带前导 `-`（附着词 `-que`）；虚拟根用 `[0]` |
| `pos` | ✅\* | string(≥1) | 可读词性；**推荐 UD UPOS**，但未用 enum 约束（见下）。\*仅真实词必需；`artificial:true`（虚拟根/省略节点）时可省 |
| `isRoot` | ✅ | boolean | **仅虚拟根（id 0）为 true**；源 `head==0` 的词是它的子节点，可多个 |
| `lemma` | | string | 词典词头 |
| `morph` | | string | 形态摘要，如 `ACC.PL`；不变词留空或省略 |
| `label` | | string | 预拼小字行 `pos · morph` |
| `artificial` | | boolean | 虚拟根 / 省略节点（form 形如 `[0]`），默认 false；为 true 时 `pos` 可省（schema 用 `if/then` 表达） |

> **为什么 `pos` / `relation` 不做 enum？** 源数据有两套不一致的标签体系：AGLDT 解码出的短标签 vs UD 的 UPOS/deprel。强行 enum 会让其中一种源数据全部校验失败。因此保留为自由字符串，推荐词表写在 `description`/`examples` 里。若你的清洗只面向**单一**源（如只做 UD CoNLL-U），建议**自己加一层更严的 enum** 覆盖：UPOS 17 类 + 你采用的 deprel 集合。

### 2.3 边（edge）

| 字段 | 必需 | 类型 | 说明 |
|---|---|---|---|
| `from` | ✅ | integer(≥0) | 父节点 id（= head）；`0` = 虚拟根（源 `head==0` 的词挂到它） |
| `to` | ✅ | integer(≥1) | 子节点 id（= 本词 id）；恒为真实词，虚拟根不会作 `to` |
| `relation` | ✅ | string(≥1) | 关系标签，如 `OBJ`/`ATR`；自由字符串（同上） |

---

## 3. JSON Schema 管不了的不变量（必须自定义校验器补）

纯 JSON Schema 无法表达跨字段 / 跨数组的约束。清洗后请额外校验：

1. **恰好一个根**：`nodes.filter(n => n.isRoot).length === 1`，且该节点 `id === 0`、`artificial === true`。
2. **虚拟根无入边**：node 0 不应作为任何 `edge.to` 出现。
3. **head==0 收敛到根**：源里每个 `head==0` 的真实词，都应有一条 `from:0` 的边（可多条）。
4. **引用完整性**：每个 `edge.from`、`edge.to` 都命中某个 `node.id`。
5. **id 唯一**：`node.id` 在句内不重复。
6. **是一棵树**：`edges.length === nodes.length - 1`（含虚拟根），且从根出发能到达全部节点（连通 + 无环）。
7. **（可选）非投射统计**：标记存在交叉边的句子，供布局算法选型参考。

> 这些不是 schema 的缺陷，而是 JSON Schema 的固有边界。建议用 ajv 跑结构校验，再跑一个几十行的 JS 函数跑 1–6。

---

## 4. 如何校验（ajv 示例）

```js
import Ajv from 'ajv'
import schema from './treebank-sentence.schema.json' assert { type: 'json' }

const ajv = new Ajv({ allErrors: true })
const validate = ajv.compile(schema)

function checkSentence (sentence) {
  // (1) 结构校验
  if (!validate(sentence)) return { ok: false, errors: validate.errors }

  // (2) 不变量校验（§3，schema 管不了的部分）
  const ids = new Set(sentence.nodes.map(n => n.id)) // 含虚拟根 id 0
  const problems = []

  const roots = sentence.nodes.filter(n => n.isRoot)
  if (roots.length !== 1) problems.push(`expected 1 root, got ${roots.length}`)
  else if (roots[0].id !== 0 || roots[0].artificial !== true) problems.push('root must be the virtual node {id:0, artificial:true}')
  if (ids.size !== sentence.nodes.length) problems.push('duplicate node id')
  if (sentence.edges.length !== sentence.nodes.length - 1) problems.push('edges != nodes-1')

  for (const e of sentence.edges) {
    if (!ids.has(e.to)) problems.push(`edge.to ${e.to} has no node`)
    if (!ids.has(e.from)) problems.push(`edge.from ${e.from} has no node`)
    if (e.to === 0) problems.push('virtual root must have no incoming edge')
  }
  // TODO: 连通性 / 无环（从根 BFS 应覆盖全部节点）

  return { ok: problems.length === 0, errors: problems }
}
```

---

## 5. 对照标准：真实 Aeneid 6.1（语言学正确基准）

[treebank-example-aeneid-6-1.json](treebank-example-aeneid-6-1.json) 取自 **Perseus AGLDT v2.1 的真实人工标注**（文件 `phi0690.phi003`，第 1 句 = Aeneid 6.1），逐字转成本 schema，未做任何"美化"。这是**权威基准**——正是 Alpheios iframe 里 Arethusa 显示的同源数据。

> 句子：*Sic fatur lacrimans, classique immittit habenas, et tandem Euboicis Cumarum adlabitur oris.*（"他流着泪如此说，给船队松开缰绳，终于滑近优卑亚人的库迈海岸。"）

| id | form | pos · morph | postag | relation | head | 说明 |
|---|---|---|---|---|---|---|
| 0  | `[0]`     | （虚拟根）        | —           | —       | —  | 合成节点，`isRoot` `artificial` |
| 1  | Sic       | ADV             | `d--------` | AuxY    | 2  | 句子副词 |
| 2  | fatur     | VERB · 3SG PRES.IND | `v3spip---` | PRED_CO | 10 | 并列谓语之一 |
| 3  | lacrimans | VERB · PRES.PTCP NOM.SG | `v-sppamn-` | ADV     | 2  | 现在主动分词 |
| 4  | `,`       | PUNCT           | `u--------` | AuxX    | 10 | 逗号 |
| 5  | classi    | NOUN · DAT.SG   | `n-s---fd-` | OBJ     | 7  | |
| 6  | -que      | CONJ            | `c--------` | AuxY    | 10 | 附着连词，已切分 |
| 7  | immittit  | VERB · 3SG PRES.IND | `v3spia---` | PRED_CO | 10 | 并列谓语之二 |
| 8  | habenas   | NOUN · ACC.PL   | `n-p---fa-` | OBJ     | 7  | |
| 9  | `,`       | PUNCT           | `u--------` | AuxX    | 10 | |
| 10 | et        | CONJ            | `c--------` | COORD   | 0  | **顶层并列连词**，挂虚拟根 |
| 11 | tandem    | ADV             | `d--------` | AuxY    | 14 | |
| 12 | Euboicis  | ADJ · DAT.PL    | `a-p---fd-` | ATR     | 15 | |
| 13 | Cumarum   | NOUN · GEN.PL   | `n-p---fg-` | ATR     | 15 | |
| 14 | adlabitur | VERB · 3SG PRES.IND | `v3spid---` | PRED_CO | 10 | 并列谓语之三（异相动词） |
| 15 | oris      | NOUN · DAT.PL   | `n-p---fd-` | OBJ     | 14 | |
| 16 | `.`       | PUNCT           | `u--------` | AuxK    | 0  | 句末标点，挂虚拟根 |

> ### 这个样例示范的真实结构（清洗时最容易做错的地方）
> - **虚拟根 + 多个 `head==0`**：`et`(COORD) 和句末 `.`(AuxK) 都挂在合成的 node 0 下。这是 AGLDT 的正常形态，不是错误。
> - **Prague 式并列**：连词 `et` 是 head，三个谓语 `fatur`/`immittit`/`adlabitur` 带 `_CO` 后缀、`head` 指向 `et`。即"并列连词统领并列成员"。
> - **postag → pos·morph**：限定式动词取 `人称+数 时态.语气`（`3SG PRES.IND`），分词取 `时态.分词 格.数`（`PRES.PTCP NOM.SG`），名词/形容词取 `格.数`，不变词 `morph` 留空。全部据官方 `TAGSET.txt` 解码。
> - **标点是真实节点**：逗号 `AuxX`、句末 `.` `AuxK` 都在树里。渲染层若不想画，可按 `pos==='PUNCT'` 过滤——这是渲染决策，不是清洗时丢弃。
> - **deponent/passive 标注照搬**：`fatur` 的 postag 第 6 位是 `p`（被动形），`adlabitur` 是 `d`（异相）——以源标注为准，不替作者纠正。

> ### 关于命中高亮
> `isHighlighted` 属**运行时字段**，不在 schema 内（`additionalProperties: false` 会拒绝它）。渲染器应根据 `TreebankDataItem.wordIds`（见 [data-models/src/treebank_data_item.js](../../../data-models/src/treebank_data_item.js)）与 `node.id` 比对，在渲染时给对应节点打高亮——清洗产物里不应出现该字段。

> ### ⚠️ 数据集事实
> Perseus AGLDT 拉丁语**没有**《埃涅阿斯纪》第 1 卷（无 *Arma virumque cano*）；维吉尔部分是**第 6 卷**（177 句）。mockup [mockups/drawer-resources.html](../mockups/drawer-resources.html) 里的 "Aeneid 1.1 / Arma virumque cano" 是美术示意，**数据集中不存在**，故不作对照基准。
