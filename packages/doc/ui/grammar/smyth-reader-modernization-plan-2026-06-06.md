# Smyth 希腊语语法书阅读器现代化方案

日期：2026-06-06
状态：已确认，待执行

## 1. 背景与目标

现有内嵌语法阅读器只对 Allen & Greenough（A&G）做了现代化重绘，逻辑全部在 core 的
`packages/components-v3/src/grammar-reader/`：

- `grammar-reader.js` —— 注入到语法书页面（cross-origin iframe / 直接访问）的内容脚本逻辑
- `grammar-reader.css` —— 阅读器样式（含 `--ag-*` 设计 token、浅/深色）

Smyth 站点的 DOM 结构分析见 `packages/doc/ui/report-2026-06-06-deepseek-chat.md`。

**目标**：复用 / 泛化现有 `ag-modern-reader` 这套方案，让它同时对 Smyth 页面
（`https://grammars.alpheios.net/smyth/xhtml/*`）生效，获得与 A&G 一致的现代阅读体验。

**范围**：只改 core 的上述两个文件。webext 侧（让注入匹配到 Smyth）由用户处理，见 §6。

## 2. 关键差异：Smyth 没有 `#page-wrapper`

A&G 所有正文样式都 scoped 在 `#page-wrapper` 下；Smyth 正文直接挂在 `<body>`，内容由 TEI→XHTML 生成。

确认的 Smyth 选择器（来自分析报告）：

| 用途 | 选择器 |
|---|---|
| TOC 页 `smyth.html` | `body.simple`、`div.stdheader`、`ul.toc` + `li.toc` + `a.toc`/`a.toc_0`/`a.toc_1` |
| Part / Chapter / Section | `div.Part` / `div.Chapter` / `div.Section` |
| 段落编号块 | `div.smythp[id=s1]` 内含 `h5`/`h6`（编号，偶尔 `h4`）+ `p` |
| 希腊语 / 英译 / 术语 | `span.foreign` / `span.gloss` / `span.term` |
| 表格 | `div.leftTable > table`，行 `tr.data > td.data` |
| 引用 + 出处 | `div.citquote > blockquote.quote > p` + `div.citbibl` |
| 导航条 | `p.right` 内 `span.upLink/.previousLink/.nextLink` + 链接 `a.navigation` |
| 交叉引用 | `a.link_ref[href=...#s123]` |
| 标题 / 样板 | `.maintitle` / `.institution`、`.department`（隐藏） |
| 旧样式表 | `tei.css`、`alph-tei.css` |

## 3. 改动一：`grammar-reader.js`（泛化为按书配置）

替换顶部单一 HOST/PATH 常量（当前 1–15 行）为按书配置表 + 匹配函数：

```js
const GRAMMAR_READER_HOST = 'grammars.alpheios.net'
const GRAMMAR_READER_CLASS = 'ag-modern-reader'
const GRAMMAR_READER_FLAG = '__alpheiosGrammarReader__'
// HOST_MSG_SOURCE / READER_MSG_SOURCE 不变

const GRAMMAR_BOOKS = [
  { id: 'allen-greenough', pathPrefix: '/allen-greenough/', modifierClass: 'ag-modern-reader--ag',
    navTitle: 'Allen & Greenough', contentsHref: 'index.htm',
    legacyStylesheets: ['site.css'], contentSelector: '#page-wrapper' },
  { id: 'smyth', pathPrefix: '/smyth/xhtml/', modifierClass: 'ag-modern-reader--smyth',
    navTitle: 'Smyth', contentsHref: 'smyth.html',
    legacyStylesheets: [],            // 不删 tei.css/alph-tei.css，靠 CSS 覆盖（见 §5）
    contentSelector: 'body' },        // 无 #page-wrapper
]
function matchBook (location = window.location) {
  if (location.hostname !== GRAMMAR_READER_HOST) return null
  return GRAMMAR_BOOKS.find(b => location.pathname.startsWith(b.pathPrefix)) || null
}
export function isGrammarReaderPage (location = window.location) { return matchBook(location) != null }
```

各 helper 改为接收 `book`：

- `removeLegacyStylesheet(book)`：遍历 `book.legacyStylesheets` 删对应 `link[href]`（Smyth 为空 → 不删）
- `createReaderNav(book)`：标题用 `book.navTitle`，Contents 链接用 `book.contentsHref`
- `enhanceTables(book)`：选择器 `#page-wrapper table` → `${book.contentSelector} table`，
  跳过 `closest('.ag-table-scroll, .leftTable')`（Smyth 表已在 `.leftTable`，滚动交给 CSS）
- `enhanceImages(book)`：`${book.contentSelector} img`（Smyth 无图，自然 no-op）
- `bindImageOpenHandler`：选择器去掉 `#page-wrapper` 前缀，改 `.ag-readable-image`
- `markContentsPage(book)`：A&G 保留原 `div.contents`/标题判断；Smyth 额外认
  `document.body.classList.contains('simple') || document.querySelector('ul.toc')` → 加 `ag-modern-reader--contents`
- `initializeGrammarReader()`（当前 149–187 行）：
  - `const book = matchBook(); if (!book) return false`（替换原 `isGrammarReaderPage()` 早退）
  - 幂等 flag、`setupHostBridge()`、embedded 检测、`ag-modern-reader` 基类 **不变**
  - 新增 `document.documentElement.classList.add(book.modifierClass)`
  - `removeLegacyStylesheet(book)` / `if (!embedded) createReaderNav(book)` / `markContentsPage(book)`
  - 增强块判定 `if (#page-wrapper)` → `if (document.querySelector(book.contentSelector))`，
    内部调用 `enhanceTables(book); enhanceImages(book); bindImageOpenHandler()`

host bridge / postMessage / theme 同步逻辑完全复用，不改。

## 4. 改动二：`grammar-reader.css`（新增 Smyth 段，复用 token）

策略：**不注入 DOM 包裹**，把 Smyth 阅读容器样式直接挂到 `<body>`（沿用现有
`--contents body:not(.simple)` 的做法，零 DOM 改动、风险低）。新增一段 `html.ag-modern-reader--smyth …`，
插入位置在 `--contents` 块结束后、`@media (prefers-color-scheme: dark)` 之前（约 416–417 行）。
深色 / `[data-ag-theme]` 只改 `:root` 上的 token，Smyth **自动继承**，无需重复写深色规则。

样式要点（全部复用 `--ag-*` token）：

- 阅读面：`html.ag-modern-reader--smyth body`（含 `.simple` TOC 页）→ 居中 `max-width`、surface 背景、
  内边距、serif 字体；注入 nav 全宽（负 margin）
- 编号块：`.smythp{position:relative;padding-left:3.25rem}`，`.smythp>h5/h6` 绝对定位左侧（Inter/muted），
  `.smythp>h4{position:static}`，`.smythp>p` 正文行距
- 行内：`.foreign`（希腊字体栈 `"Gentium Plus","New Athena Unicode","Noto Serif",Georgia,serif`）、
  `.gloss`（斜体 muted）、`.term`（small-caps）
- 表格：`.leftTable{overflow-x:auto;border;radius}`、`table/td/th`、`tr.data:first-child td` 表头底色
- 引用：`.citquote`（左竖线）、`blockquote.quote p`（斜体 muted）、`.citbibl`（小字 muted）
- 交叉引用：`a.link_ref`（下划线，hover accent）
- 导航条：`p.right{display:flex;…}`、`a.navigation`
- TOC：`ul.toc`/`a.toc`/`a.toc_0`(700)/`a.toc_1`(500)
- 隐藏 `.institution`/`.department`
- 锚点：`html.ag-modern-reader--smyth [id]{scroll-margin-top:64px}`，embedded 时 16px
- 移动端 / embedded：在现有 `@media (max-width:640px)` 与末尾 embedded-compact 块里，比照
  `--contents body:not(.simple)` 给 `--smyth body` 加同样的 padding 调整

## 5. 风险 / 注意

1. **特异性冲突**：现有 `html.ag-modern-reader body.simple{background:var(--ag-bg)}`（2 类 2 元素）会盖过
   `html.ag-modern-reader--smyth body`（1 类 2 元素），导致 Smyth TOC 背景变页面色而非 surface。
   → Smyth body 规则写成 `html.ag-modern-reader--smyth body, html.ag-modern-reader--smyth body.simple`
   提升特异性。
2. **不删 `tei.css`/`alph-tei.css`**：可能承载希腊字符/结构布局，删除风险大；用更高特异性 reader 规则覆盖
   （故 Smyth `legacyStylesheets: []`）。覆盖不彻底再按需局部 reset。
3. **希腊字体**：扩展无法可靠跨域加载远程字体，只用系统可用的希腊 serif 栈兜底。
4. `ag-` 前缀**不重命名**（沿用为 "alpheios grammar" 命名空间），避免波及 webext 对 css 类名/文件名的引用。

## 6. webext 接线（core 与 webext 一起构建）

reader 真正注入 Smyth 页面需要 webext 配合（其余接线 —— `src/content/grammar-reader.js`
入口、webpack `grammar-reader` entry/alias、`update-dist` 拷贝 grammar-reader.css —— 都是书目无关的，
core reader 支持 Smyth 后自动覆盖）。本次已改：

- `alpheios_webextension/src/manifest/manifest.json` —— `content_scripts.matches` 增加
  `https://grammars.alpheios.net/smyth/xhtml/*`
- `alpheios_webextension/src/background/background-process.js` —— `isGrammarReaderUrl` 的 path 判断
  增加 `/smyth/xhtml/`

## 7. 待改文件

core：
- `packages/components-v3/src/grammar-reader/grammar-reader.js`
- `packages/components-v3/src/grammar-reader/grammar-reader.css`

webext：
- `alpheios_webextension/src/manifest/manifest.json`
- `alpheios_webextension/src/background/background-process.js`

## 8. 验证

1. core：`cd packages/components-v3 && npm run build`
2. webext：`cd alpheios_webextension && npm run build-dev`，浏览器重载扩展
3. 浏览器内 / 面板内嵌打开：
   - Smyth 章节页 `…/smyth/xhtml/body.1_div1.1_div2.1.html`：编号块、希腊文、表格、引用、导航条样式正确
   - Smyth 目录页 `…/smyth/xhtml/smyth.html`：`ul.toc` 列表化、surface 背景（验证特异性修正）
   - 浅色 + 深色（面板 `data-ag-theme` 与 OS `prefers-color-scheme` 两路）
   - A&G 页面**回归**：泛化后表现不变
4. console 无新增报错
