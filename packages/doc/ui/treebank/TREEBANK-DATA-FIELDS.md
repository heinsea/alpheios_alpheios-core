# Treebank 渲染所需数据字段

> 配套文档：方案调研见 [TREEBANK-OPTIONS.md](TREEBANK-OPTIONS.md)；正式校验见 [TREEBANK-SCHEMA.md](TREEBANK-SCHEMA.md) + [treebank-sentence.schema.json](treebank-sentence.schema.json)；对照样例见 [treebank-example-aeneid-6-1.json](treebank-example-aeneid-6-1.json)。
>
> 目的：给出**方案 B（原生 SVG 渲染）渲染层消费的目标数据形状**，作为对 Perseus treebank 数据进行清洗的目标规格。

---

## 0. 背景定位

渲染层的核心抽象是 `CoNLL-U / AGLDT-XML → {nodes, edges} → SVG`（见 TREEBANK-OPTIONS.md §4 关键抽象点）。当前状态：

- `components-v3/src/composables/use-resources.js`（`buildTree`）里的 `treeData.nodes` 还是**空数组**——只是方案 A 的 iframe 占位，没有真正的结构化树数据。
- `client-adapters/src/adapters/alpheiostb/adapter.js` 解析 Perseus XML 时**只取了形态学字段**（`form` / `lemma` / `infl`），**没有取 `head` / `relation`**——也就是说"边"目前根本无人解析。

因此本规格要补齐的，正是这套 `{nodes, edges}`（外加句级元数据）。

---

## 1. 目标 schema（渲染层消费的形状）

数据**以句为单位**组织。务必区分两类字段：

- **源数据字段** —— 清洗阶段就要从 Perseus 数据产出的。
- **运行时字段** —— 渲染时才计算的（布局坐标、命中高亮），**清洗阶段不要产出**。

```jsonc
TreebankSentence {
  // ── 句级元数据（喂给 toolbar / text-strip / footer）──
  "id":        "1",                 // 句在文档内的 ID            ← sentence/@id
  "index":     1,                  // 序号，pager "1 of 756"     ← 清洗时枚举得出
  "total":     756,                // 全文句数，pager            ← 清洗时统计得出
  "docId":     "phi0690.phi003…",  // 文档/文本标识              ← sentence/@document_id
  "cite":      "6.1",             // passage 引用（footer）= @subdoc ← 作品名由 docId 在渲染层映射
  "text":      "Arma virumque cano, Troiae qui primus ab oris…", // 整句纯文本（底部 strip）← 拼接各 form
  "provider":  "Perseus treebank", // footer 出处
  "version":   "2.1",              // footer 版本

  "nodes": [ TreebankNode, … ],
  "edges": [ TreebankEdge, … ]
}

TreebankNode {
  "id":     1,                 // 句内唯一，整数（0 = 虚拟根）       ← word/@id            【必需】
  "form":   "fatur",           // 表层 token，节点大字              ← word/@form          【必需】
  "lemma":  "for",             // 词典词头（hover / 二级用，可选）   ← word/@lemma
  "pos":    "VERB",            // 可读词性                         ← 解码 postag[0] / upos 【必需*】
  "morph":  "3SG PRES.IND",    // 形态摘要，节点小字                ← 解码 postag[1..8] / feats
  "label":  "VERB · 3SG PRES.IND", // 预拼好的小字行（= pos · morph），可在清洗阶段算好
  "isRoot": false,             // 仅虚拟根为 true                  ← 见下「虚拟根」      【必需】
  "artificial": false          // 虚拟根 / 省略节点（form 形如 [0]），可选；为 true 时 pos 可省

  // ── 运行时字段，清洗阶段不要产出 ──
  // "x","y":         层次布局算出的坐标
  // "isHighlighted": 当前命中 token，由 wordIds 比对得出
}

TreebankEdge {
  "from":     3,               // 父节点 id（= head）             ← word/@head          【必需】
  "to":       1,               // 子节点 id（= 本词 id）           ← word/@id            【必需】
  "relation": "OBJ"            // 依存关系标签，画在边上            ← word/@relation / deprel 【必需】
}
```

**最小必需集**：节点 `id / form / pos / isRoot`（可选加 `morph`），边 `from / to / relation`。其余都是锦上添花或运行时算的。

> \* `pos` 对真实词【必需】；虚拟根 / 省略节点（`artificial: true`）可省 `pos`。

### 1.1 虚拟根（关键模型）

AGLDT 用一个**隐式的虚拟根**（编号 0）当整句的顶点；源 XML 里**没有** `id="0"` 的词，需要清洗时**合成**。规则：

- 合成一个节点 `{ "id": 0, "form": "[0]", "isRoot": true, "artificial": true }`。
- 源数据里**凡 `head == 0` 的词，都挂到节点 0 下**（生成 `{from:0, to:词id, relation:该词的relation}`）。
- **`head == 0` 可以有多个**——典型是「主句中心词 / 顶层并列连词」+「句末标点（AuxK）」。这正是真实数据（见 [treebank-example-aeneid-6-1.json](treebank-example-aeneid-6-1.json)）里 `et`(COORD) 和 `.`(AuxK) 同时挂在根下的原因。
- 这样全句是**单根树**：`N` 个节点（含虚拟根）→ `N-1` 条边，`isRoot:true` 恰好一个，渲染层布局干净。

> 别把「多个 `head==0`」误当成多根错误丢弃——它是 AGLDT 的正常结构。

---

## 数据集事实（清洗前必读）

- **Perseus AGLDT v2.1 拉丁语的维吉尔部分 = 《埃涅阿斯纪》第 6 卷**（`phi0690.phi003`，subdoc `6.1`–`6.295`，共 **177 句**）。**不含**第 1 卷的名句 *Arma virumque cano*——mockup 那句是美术示意，数据集里并不存在。
- 拉丁语 texts 目录共 12 个 `.tb.xml`（Caesar `phi0448` / Cicero / Vergil `phi0690` / Ovid `phi0959` 等）。
- 权威标签定义在仓库 `v2.1/Latin/TAGSET.txt`（postag 9 位 + relation 全集），下面的解码表即据此。

---

## 2. 源字段 → 目标字段映射

TREEBANK-OPTIONS.md §3.2 提到两种源格式，映射不同：

| 目标字段 | AGLDT 旧 XML（`<word …>`） | UD Perseus CoNLL-U（每行 10 列） |
|---|---|---|
| `node.id` | `@id` | 第 1 列 `ID` |
| `node.form` | `@form` | 第 2 列 `FORM` |
| `node.lemma` | `@lemma` | 第 3 列 `LEMMA` |
| `node.pos` | `@postag` 第 1 位解码 | 第 4 列 `UPOS`（已可读，最干净） |
| `node.morph` | `@postag` 第 2–9 位解码 | 第 6 列 `FEATS`（`Case=Acc\|Number=Plur`） |
| `edge.from` | `@head`（0 = 根） | 第 7 列 `HEAD`（0 = 根） |
| `edge.to` | `@id` | 第 1 列 `ID` |
| `edge.relation` | `@relation` | 第 8 列 `DEPREL` |
| `sentence.id` | `<sentence @id>` | `# sent_id =` 注释 |
| `sentence.cite` | `<sentence @subdoc>` | `# citation` / `# reference` 注释 |
| `sentence.text` | 拼接各 `form` | `# text =` 注释（CoNLL-U 现成带） |

**结论**：UD CoNLL-U 是最省事的源（`upos` / `feats` / `deprel` 已可读、整句 `# text` 现成），AGLDT XML 则要自己解码 `postag` 正字串。与 TREEBANK-OPTIONS.md §3.2 的建议一致。

---

## 3. 清洗难点：`postag` 正字串解码（仅 AGLDT XML 需要）

Perseus 的 `postag` 是 **9 位定长字符串**（如 `n-s---fd-`，`-` 表示该位不适用）。每一位含义**照搬官方 `v2.1/Latin/TAGSET.txt`**（拉丁语；希腊语 tagset 略有差异）：

| 位 | 含义 | 取值（拉丁语，官方全集） |
|---|---|---|
| 1 | 词性 pos | n 名词 · v 动词 · a 形容词 · d 副词 · c 连词 · r 介词(adposition) · p 代词 · m 数词 · i 感叹 · e 惊叹(exclamation) · u 标点 |
| 2 | 人称 person | 1 / 2 / 3 |
| 3 | 数 number | s 单 · p 复 |
| 4 | 时态 tense | p 现在 · i 未完成 · r 完成 · l 过去完成 · t 将来完成 · f 将来 |
| 5 | 语气 mood | i 陈述 · s 虚拟 · n 不定式 · m 命令 · p 分词 · d 动名词(gerund) · g 动形词(gerundive) |
| 6 | 语态 voice | a 主动 · p 被动 · d 异相(deponent) |
| 7 | 性 gender | m 阳 · f 阴 · n 中 |
| 8 | 格 case | n 主 · g 属 · d 与 · a 宾 · v 呼 · b 夺 · l 方位 |
| 9 | 级 degree | p 原级 · c 比较级 · s 最高级 |

> 注意：拉丁语 tagset **没有** supine、article、particle 等位值（那些在希腊语或其它体系里才有）。务必以仓库 `TAGSET.txt` 为准，别照搬通用 POS 表。

这与 [config.json](../../../client-adapters/src/adapters/alpheiostb/config.json) 里 Alpheios 关心的特征集（pofs / case / num / gend / voice / mood / pers / comp）对应。

**`node.morph` 摘要建议只挑显著位**，不要把 9 位全堆上（参考 mockup 的 `NOUN · ACC.PL` / `VERB · 1SG`）：

- 名词 / 形容词 / 代词 → `格.数`（如 `ACC.PL`）
- 动词限定式 → `人称SG/PL`（如 `1SG`）或 `时态.语气.语态`
- 不变词（连词 / 介词 / 副词）→ 留空，`label` 只显示 `pos`

---

## 4. 清洗 gotchas（最容易踩的坑）

- **根 = 虚拟根（见 §1.1）**：`head == 0` 的词不是「无父」，而是挂到合成的虚拟根节点 0 上。**可能多个**（主谓/顶层并列 + 句末标点）。`isRoot:true` 只打在节点 0 上，别打在真实词上。
- **AGLDT 关系带后缀**：`PRED_CO` / `OBJ_CO` / `ATR_CO`（`_CO` = 并列成员）、`*_AP`（同位语成员）、`AP_CO`。并列结构里**连词是 head**（relation `COORD`），各并列成员带 `_CO` 后缀、`head` 指向该连词——真实样例里 `et`(COORD) 统领 `fatur`/`immittit`/`adlabitur` 三个 `PRED_CO` 即是。需决策是否剥掉 `_CO`/`_AP` 后缀。
- **功能词 / 标点的 `Aux*` 标签**（官方全集）：`AuxP`(介词) `AuxC`(从属连词) `AuxY`(句子副词/小品词，如 sic/-que/tandem) `AuxZ`(强调词) `AuxV`(助动词) `AuxR`(反身被动) `AuxG`(成对括号标点) `AuxX`(逗号) `AuxK`(句末标点)。标点节点是否进树、还是过滤掉，需要决策。
- **人工 / 省略节点**：AGLDT 有省略补足的虚拟节点（form 形如 `[0]` / `[1]`，relation `ExD`），无真实表层文本。建议打 `artificial: true`，渲染层特殊样式或过滤。
- **附着词切分**：`virumque` 在源里已被切成 `virum` + `-que` 两个 word（mockup 即如此），分词是源数据做好的，**不用再切**，但注意 form 可能带前导连字符 `-`。
- **非投射依存（non-projective）**：边会交叉，纯纵向层次布局会重叠（TREEBANK-OPTIONS.md §2 已点名为难点）。清洗阶段不用管（属布局层），但可统计句子是否非投射，帮后续选布局算法。
- **`id` 不一定连续 / 从 1 起**：别假设 `id == 数组下标`，一律用 `id` 作为 `head` 的查找键。

---

## 5. 不变量（清洗后应满足）

下列约束 JSON Schema 表达不了，需用自定义校验器检查（见 [TREEBANK-SCHEMA.md](TREEBANK-SCHEMA.md) §3）：

1. 每句**恰好一个** `isRoot: true` 的节点——即合成的虚拟根（id 0）。
2. 源数据里所有 `head == 0` 的词，都成为虚拟根（id 0）的子节点（可多个）。
3. 每条 `edge.from` / `edge.to` 都必须命中某个 `node.id`（引用完整性）；`edge.to` 恒为真实词（≥1）。
4. 连通且无环：含虚拟根在内 `边数 == 节点数 - 1`，从根可达全部节点（即一棵树）。
5. `node.id` 在句内唯一。
