# Treebank（依存树）方案调研

> 针对 components-v3 `ResourcesPage` 的 **tree** 模式。
> 目标：理想形态是像 `doc/ui/mockups/drawer-resources.html` Scene 3 那样原生渲染依存树；当前未完成。
> 本文只做方案梳理，不含实现。

---

## 1. 现状与根本约束

### 1.1 为什么"官方只有特殊页面才能看树"

这不是 UI 没做完，而是**数据本质的约束**：

**Treebank（依存树）是预先人工标注的语言学数据**，不是程序即时生成的。一棵树的渲染依赖页面 DOM 里嵌入的特定属性（见 `data-models/src/treebank_data_item.js:27-44`）：

```
data-alpheios_tb_app="perseids-treebank-template"
data-alpheios_tb_app_url="https://.../embed/DOC/SENTENCE?w=WORD"
data-alpheios_tb_ref="...#1-1"
```

只有经过 treebank 标注的页面（如 `texts.alpheios.net`）才带这些属性。普通网页上随便选词没有对应句法标注，因此官方只能"特殊页面才显示"。

### 1.2 当前 v3 实现

- 数据管道：`components-v3/src/composables/use-resources.js:124-158`（`buildTree`）
- 视图：`components-v3/src/pages/ResourcesPage.vue:268-307`

逻辑：
- 有 `lexis.treebankSrc` → 直接嵌一个 Arethusa 的 `<iframe>`（指向官方 embed 页面）
- 没有 → 三种空状态文案（idle / no-metadata / not-supported-page）

> mockup 里那棵漂亮的 SVG 树（`drawer-resources.html:681-748`）是**手写的假数据**，并非真实渲染。

### 1.3 核心矛盾

理想是**原生 SVG 渲染**（样式可控、深色模式、缩放、命中词高亮），
现实是树数据**只在跨域 iframe 里**、且**只对标注过的页面存在**。

---

## 2. 三种方案（由易到难）

### 方案 A：保留 iframe，外壳原生化（最小改动，建议起步）

保留 Arethusa `<iframe>` 作为树的渲染源，但把 mockup 的 **toolbar（句子翻页 pager、zoom、sentence-id）、底部 text-strip、footer** 用原生组件实现，套在 iframe 外面。

- ✅ 不用解析 treebank 格式，零数据风险；立刻拿到 mockup 外观
- ❌ 树本体仍是跨域 iframe，深色模式/字体/缩放无法与 v3 统一；`postMessage` 控制能力有限
- 适用：先让 UI 完整，承认树本体暂不原生

### 方案 B：原生 SVG 渲染（理想形态，需要数据管道）

自己拉取 treebank 的**结构化数据**（不是 embed 页面），在 v3 里用 SVG 画依存树，完全复刻 mockup 样式。

数据来源：
1. **alpheiostb adapter** — 抓 Perseus treebank XML（`<word id head relation form postag>`）。`head` 指针 = 边，`relation` = OBJ/ATR/ROOT 标签。当前 v3 未用它。
2. 更好的选择：**UD Perseus CoNLL-U**（见 §3.2），格式比旧 XML 更干净。
3. 转成 `{nodes, edges}` → 层次布局 → SVG。

- ✅ 样式完全可控、支持深色模式/缩放/高亮、无跨域
- ❌ 要写解析 + 树布局算法（边交叉、非投射依存是经典难点）；仍**只对有 treebank 标注的文本可用**——解决"渲染"，不解决"哪里有树"

### 方案 C：按需解析任意文本（最大变化，慎重）

对没有预标注的任意文本，调用**依存句法分析器**实时生成树。

- ✅ 任意页面、任意句子都能看树，摆脱"特殊页面"限制
- ❌ (1) 古典语言自动 parser 准确率有限，可能给学习者错误示范；(2) 需后端服务或 WASM 模型；(3) 与 Alpheios "权威人工标注"定位有张力
- 适用：作为带免责声明的**实验性功能**，而非默认

---

## 3. 公开学术资源清单

区分两类：**解析器库**（方案 C）和**已标注数据集**（方案 B）。
两者输出都可统一为 **CoNLL-U** 格式：每行 `id form lemma upos ... head deprel`，
其中 `head` = 边、`deprel` = 依存关系标签，正好是画 SVG 树所需。

### 3.1 依存解析器库（方案 C：任意句子生成树）

| 库 | 说明 | 接入方式 |
|---|---|---|
| **Stanza** (Stanford) | 最易用，有 Latin / Ancient Greek 预训练 UD 模型；覆盖分词/词形还原/词性/形态/依存 | Python，无官方 JS，需后端封装 REST |
| **UDPipe** | 古典 NLP 社区用得最多（EvaLatin 评测用它），有 Latin-Perseus 模型 | **有现成 REST API**：`lindat.mff.cuni.cz/services/udpipe`，可直接 HTTP 调用 |
| **CLTK** (Classical Language Toolkit) | 专为古典语言，整合上述解析器 | Python |
| **spaCy + LatinCy** | LatinCy 是专训的拉丁模型 | Python |

> **重点**：UDPipe 的 LINDAT REST 服务可直接 `fetch` 拿到 CoNLL-U，不用自建后端。是方案 C 成本最低的一条路。
> ⚠️ 古典语言自动解析准确率有限；五个拉丁 UD treebank 标注风格不一致会拉低准确率（2023 harmonisation 论文）。宜作 best-effort，不宜当权威示范。

### 3.2 已标注 treebank 数据集（方案 B：渲染已标注文本）

静态数据集，下载文件后自己渲染，**没有统一 REST API**。

- **AGLDT** (Ancient Greek & Latin Dependency Treebank)：Perseus/Tufts，35 万+ 词，含完整《伊利亚特》《奥德赛》、Caesar/Cicero/Vergil 选段。**这正是 Alpheios 现在 iframe 里 Arethusa 显示的同源数据**。源数据：`github.com/PerseusDL/treebank_data`
- **UD Perseus** (Latin / Ancient Greek)：上面数据转成 Universal Dependencies 的 CoNLL-U，**最好解析**
- 其他：**PROIEL**、**Index Thomisticus** (IT-TB)、**SEMATIA**

查询接口：(1) 直接下 CoNLL-U 文件；(2) **PML-TQ** 在线查询界面。

---

## 4. 建议路线

分两步走，"先有再好"：

1. **先做方案 A**：把 mockup 的 toolbar / text-strip / footer 原生化，iframe 当渲染源。立刻补齐当前简陋的 tree 模式 UI，零数据风险。

2. **再演进到方案 B**：接 treebank 结构化数据（优先 UD Perseus CoNLL-U）→ 转 `{nodes, edges}` → 原生 SVG，逐步替换 iframe。先用 mockup 那种**纵向层次布局**（够用且简单），D3 全量布局留到处理长句/非投射依存时再上。

3. **方案 C** 仅在明确要支持"任意网页看树"时考虑，作为带免责声明的实验功能。

### 关键抽象点

只要在 v3 里写一个 **`CoNLL-U → {nodes, edges} → SVG`** 渲染器，
**方案 B 和 C 可共用同一渲染层**，区别只在数据来源（本地文件 vs UDPipe API）。

---

## 5. 待验证 / 决策项

- [ ] UDPipe LINDAT REST API 的实际返回格式 + CORS 是否放开（决定方案 C 能否纯前端调用）
- [ ] alpheiostb adapter 现有 XML 返回结构（评估方案 B 复用现成管道的可行性）
- [ ] 树布局算法选型：自写纵向层次布局 vs D3（取决于是否需处理非投射依存）
- [ ] 选 A 还是直接 B 作为第一步

---

## 参考来源

- [The Ancient Greek and Latin Dependency Treebank (PerseusDL)](https://perseusdl.github.io/treebank_data/)
- [PerseusDL/treebank_data (源数据 GitHub)](https://github.com/PerseusDL/treebank_data)
- [UD_Latin-Perseus](https://universaldependencies.org/treebanks/la_perseus/index.html)
- [UD_Ancient_Greek-Perseus](https://universaldependencies.org/treebanks/grc_perseus/index.html)
- [Stanza available models](https://stanfordnlp.github.io/stanza/available_models.html)
- [Universalising Latin Universal Dependencies (harmonisation, ACL 2023)](https://aclanthology.org/2023.udw-1.2/)
- [Treebanking — Digital Classicist Wiki](https://wiki.digitalclassicist.org/Treebanking)
