# Stage 4 续作 — 修复 Lookup / WordUsage / Treebank 数据接入

> 配套：`REFACTOR-V3-PROGRESS.md`（动态进度）、`REFACTOR-V3-STAGE4-PLAN.md`（上层方案）。
> 本文是某次 Stage 4 端到端验收发现 3 个 bug 后的根因 + 实施计划，会话中断后从这里恢复执行。

## 2026-05-05 follow-up：官方 reader / grammar 浏览策略

本轮补充实现后，Resources 三个页的边界更明确：

- **Word Usage**：仍从真实 `api.app.getWordUsageData(homonym)` 读取 examples。
  没有返回 examples 时只显示真实空态，并给出官方 reader 页面入口用于端到端验证。
- **Treebank**：仍不可手动 trigger；只监听 `store.state.lexis.treebankSrc`。
  官方 reader 页面是推荐验证环境，因为它可能提供 Arethusa metadata；普通页面没有
  metadata 时必须显示 `No treebank metadata`，不能显示 fixture 或假树。
- **Grammar**：v3 直接在 Drawer 容器中 iframe 浏览官方 Allen & Greenough：
  `https://grammars.alpheios.net/allen-greenough/index.htm?ts=1777980366365#table-of-contents`。
  如宿主浏览器或远端 header 阻止 iframe，UI 保留外部打开入口。

同时 Lookup 的 `In context` citation 卡片已从 UI 和 v3 lookup payload 中移除；
Drawer 导航轨移到浏览器右外侧，左内侧边缘作为可拖拽 resize handle。

### 2026-05-05 correction

- Resize handle 必须位于 Drawer 自身命中区域内；`left:-4px` 在当前
  ShadowHost 零尺寸 host 结构下不可可靠命中，已改为 Drawer 内侧
  `left:0;width:12px`。
- Grammar 不能依赖跨域 iframe 的内部 DOM/CSS 注入；v3 只提供外层 reader
  shell 和浏览控件。Back/Forward 尝试调用 iframe history，受浏览器跨域限制时
  不假装能控制远端页面。
- Word Usage / Treebank 的官方 texts 入口已从“单纯跳转链接”改为内嵌 catalog/
  reader 面板；但真实 Usage examples 和 Treebank diagram 仍必须来自当前页面
  的 AppController/Vuex live 数据，不能从 iframe 内的另一套 embedded library
  直接偷状态。

## Context（为什么改）

Stage 4c/4d 完成后做端到端验收时发现：

1. **搜索框 Enter 键无响应**：v3 Drawer 搜索框输入词后按 Enter，UI 完全没反应，"一直处于 Lookup 状态"。
2. **WordUsage 页面无 live 数据**：Resources page `mode='usage'` 仍是 fixture。
3. **Treebank 页面无 live 数据**：tree 模式从未渲染 live iframe。

## 根因

### 共因：v3 没注册 UIController

v3 是 v2 UI 的替代品，content-v3.js 故意只注册 AuthModule（不注册 PanelModule/PopupModule/ToolbarModule/ActionPanelModule）。后果：`appController.api.ui === undefined`。但 alpheios-core 多处假设 `api.ui` 存在 — 一旦走到这条路径就抛 `TypeError`。

引用点（`packages/components/src/lib/controllers/app-controller.js`）：

| 行号 | 调用 |
|---|---|
| 934, 936, 937 | `this.api.ui.hasModule('panel')` / `changeTab` / `openPanel`（`sendFeature` 内） |
| 974 | `this.api.ui.openLexQueryUI()`（`newLexicalRequest` 末尾） |
| 1140 | `this.api.ui.closeUI()` |
| 1449 | `this.api.ui.isPopupVisible()`（`onTextSelected` 内） |

### 1. Enter 不触发查词
`components-v3/src/App.vue:118-124` 的 `onSearchEnter` 调用 `controller.api.app.newLexicalRequest(...)`，但：

- `newLexicalRequest` 末尾要 `this.api.ui.openLexQueryUI()` → 抛 TypeError，函数中断（store mutations 已 commit 但没有真正发出 LexicalQuery）。
- 即便 try/catch 兜住，**`newLexicalRequest` 本身不发起查询** — 它只 commit `lexicalRequestStarted` + reset 数据。真正的查询入口是 `lexis.lookupText(textSelector)`（`packages/components/src/vue/vuex-modules/data/lexis.js:738`），它内部走完整的 `lexicalQuery({store, textSelector, source})` 路径并最终 `LexicalQuery.create()`。
- `controller._store.state.app.currentLanguageID` 在没做过任何 lookup 时为 `undefined`，所以 `if (languageID)` 永远 false → silently return。

### 2. WordUsage 不出数据
`use-resources.js:126-130` `refreshUsage` 实现正确：watch `wordUsageExamplesReady` → `buildUsage()`；按需调 `api.getWordUsageData(homonym)`。前提是 `api.app.homonym` 不为空 — 在 #1 修复前从未产生 homonym，所以 `refreshUsage` 永远 early-return。**修复 #1 后 #2 应自然通**（拉丁语 + default `enableWordUsageExamples=true` + `wordUsageExamplesON='onDemand'` 与 `refreshUsage` 调用一致）。

### 3. Treebank 不出数据
`use-resources.js:138-142` `refreshTree` 调用 `api.startResourceQuery({type:'treebank', value:'', languageID})`：

- `app-controller.js:1145` `startResourceQuery` 把 feature 传给 `ResourceQuery.create()` → `resource-query.js#iterations()` 只走 grammar 流（`this.grammars.fetchResources(...)`），**对 type 字段没分支**。结果 publish `GRAMMAR_NOT_FOUND`。
- 真正的 treebank 数据由 `lexis.js` 在 module 构造时 `TreebankDataItem.getTreebankData()`（无参，从 DOM `<meta>` 等抓 Arethusa 注入的 metadata）和每次 selection 时 `TreebankDataItem.getTreebankData(selectionTarget)` 自动写入 store `lexis.treebankSrc`。**它不能也不应该被任意页面手动触发** — 没有 metadata 的页面就是没有 treebank。

正确行为：treebank 页面**完全依赖** `lexis.treebankSrc` 的被动更新。`refreshTree` 调用是错误的 API，要么删除，要么 no-op。

## 实施方案

### A. webpack 加 `alpheios-data-models` alias

文件：`alpheios_webextension/webpack.config.mjs`（resolve.alias 块）

```js
'alpheios-data-models$': path.join(projectRoot,
  'node_modules/alpheios-core/packages/data-models/dist/alpheios-data-models.min.js'),
```

理由：`alpheios-components` UMD 不导出 `LanguageModelFactory`（plugin.js export 列表里没有），但 `alpheios-data-models` 自己的 dist 直接 export。alias 后 content-v3.js 可以 `import { LanguageModelFactory } from 'alpheios-data-models'`，无需修改 fork 源码也无需重建 alpheios-components。

`TextSelector` 是 alpheios-components 内部类，但只有 6 个字段会被 LOOKUP 流程读取（已审计 lexicalQuery 全路径，PAGE-only 字段 LOOKUP 不会访问）：`text` / `languageID` / `model` / `data` / `location` / `normalizedText`。完全可以构造 duck-typed 对象。

### B. content-v3.js 加两块"安全垫"

文件：`alpheios_webextension/src/content/content-v3.js`

在 `appController.activate()` 之后、`mount()` 之前：

1. **stub `appController.api.ui`** — no-op 版覆盖所有被引用方法：
   ```js
   if (!appController.api.ui) {
     appController.api.ui = {
       openLexQueryUI() {},
       openPanel() {},
       closePanel() {},
       closeUI() {},
       hasModule() { return false },
       changeTab() {},
       showLookupResultsUI() {},
       isPopupVisible() { return false }
     }
   }
   ```
   覆盖 `app-controller.js` 的 934/936/937/974/1140/1449。同时治好"双击选词路径也会 throw"的次生 bug。

2. **挂载 `appController.runLookup(text, langCode?)` 帮手**：
   ```js
   import { LanguageModelFactory } from 'alpheios-data-models'
   appController.runLookup = function (text, langCode) {
     if (!text || !text.trim()) return
     const code = langCode ||
       this.api.settings.getFeatureOptions().items.lookupLanguage.currentValue ||
       'lat'
     const languageID = LanguageModelFactory.getLanguageIdFromCode(code)
     if (!languageID) return
     const model = LanguageModelFactory.getLanguageModel(languageID)
     const t = text.trim()
     const textSelector = {
       text: t,
       languageID,
       model,
       data: {},
       location: '',
       get normalizedText () { return model.normalizeText(this.text) },
       get languageCode () { return code },
       isEmpty () { return !this.text }
     }
     return this.api.lexis.lookupText(textSelector)
   }
   ```

### C. App.vue 用 helper 代替 newLexicalRequest

文件：`alpheios_alpheios-core/packages/components-v3/src/App.vue:117-124`

```js
function onSearchEnter (value) {
  if (!controller || !value || !value.trim()) return
  const code =
    controller._store.state.app.currentLanguageCode ||
    controller._store.state.app.selectedLookupLangCode ||
    (controller.api.settings.getFeatureOptions().items.lookupLanguage.currentValue) ||
    'lat'
  if (typeof controller.runLookup === 'function') {
    controller.runLookup(value, code)
  }
}
```

### D. `refreshTree` → no-op

文件：`alpheios_alpheios-core/packages/components-v3/src/composables/use-resources.js:138-142`

改成 no-op，保留导出契约；注释说明 treebank 由 `lexis` 模块依赖页面 metadata 自动驱动，不存在合法的手动 trigger。

文件：`alpheios_alpheios-core/packages/components-v3/src/App.vue:190-193`

watch 分支保留即可（refreshTree 现在是 no-op）。

### E. PROGRESS 文档更新

文件：`alpheios_webextension/doc/ui/REFACTOR-V3-PROGRESS.md`

会话日志顶部加一条 `2026-05-05 · session 5 — Stage 4 端到端验收修复`，记录三个修复点。Stage 4c "待用户操作" 复选框等用户验收后再勾。

## 关键文件清单

| 文件 | 操作 |
|---|---|
| `alpheios_webextension/webpack.config.mjs` | 加 `alpheios-data-models` alias |
| `alpheios_webextension/src/content/content-v3.js` | stub `api.ui` + 挂载 `runLookup` |
| `alpheios_alpheios-core/packages/components-v3/src/App.vue` | 改写 `onSearchEnter` |
| `alpheios_alpheios-core/packages/components-v3/src/composables/use-resources.js` | `refreshTree` → no-op + 注释 |
| `alpheios_webextension/doc/ui/REFACTOR-V3-PROGRESS.md` | 加 session 5 日志 |

不修改：alpheios-core fork 的 plugin.js / app-controller.js / lexis.js。不需要重建 alpheios-components UMD。

## 复用的既有实现

- `LanguageModelFactory.getLanguageIdFromCode` / `getLanguageModel`（`alpheios-data-models/src/language_model_factory.js`）
- `controller.api.lexis.lookupText`（`vue/vuex-modules/data/lexis.js:738`）— v2 lookup.vue:162 走的就是这个
- `controller.api.settings.getFeatureOptions().items.lookupLanguage`（默认 `'lat'`，`feature-options-defaults.json:136`）
- `use-resources.js#refreshUsage` / `buildUsage`（已实现）
- `use-resources.js` 对 `lexis.treebankSrc` 的 watch（已实现）

## 构建步骤

```bash
# 先 fork（如改了 components-v3 源码）
cd alpheios_alpheios-core/packages/components-v3 && npm run build

# 再 webextension
cd ../../../alpheios_webextension && npm run build-dev
```

## 验证（Verification）

1. **Build**：`npm run build-dev` 不报新告警，content-v3.js 体量基本持平（多 ~50 KiB alpheios-data-models）。

2. **Enter 触发查词**（核心）：
   - Chrome 加载 `dist/` unpacked，访问 `https://www.thelatinlibrary.com/...?alpheios=v3`。
   - 搜索框输入 `arma`，按 Enter → Drawer 切 loading → 填入真实 lemma + 短定义；console 不报 `TypeError`。
   - 连续输入 `Romae`、`profugus`。

3. **WordUsage**：
   - 上一步先查 `arma`，切 Word Usage tab → 真实 quotes/authors 分组。
   - 非拉丁词（`λόγος`）→ 明确 no usage data / unavailable 空态，无 fixture。

4. **Treebank**：
   - 普通无 metadata 页（thelatinlibrary）切 tree tab → 明确 no metadata 空态，无 fixture。
   - 带 Arethusa treebank metadata 的页（如 Perseus 标注页）选词 → tree tab 自动切到 live iframe。

5. **双击选词**（顺带）：
   - 任意 https 页 `?alpheios=v3`，双击拉丁词 → v3 Popup/Drawer 应能反应（修 stub 之前会因为 `onTextSelected → api.ui.isPopupVisible` 静默 throw）。

## Session 7 补充事实（2026-05-05）

1. **AuthModule 没有 profile helper**：真实公开 API 是
   `authenticate()` / `logout()` / `session()` / `getUserData()` /
   `updateAuthData()`。v3 AuthPage 必须从 Vuex `auth.userId` /
   `auth.userNickName` / `auth.isAuthenticated` / `auth.isSessionExpired`
   构建视图，不能调用 profile helper。

2. **Settings Resource option 必须用 full option name 写入**：
   `resourceOptionChange(name,value)` 的 `name` 是 grouped option item 的
   full name（例如由 `getResourceOptions().items.lexicons` 中的 item.name
   提供），不是 fixture 里的短 ID。写入后还要调用
   `api.app.applyResourceOption(name,value)`，grammar provider 才会重新初始化。

3. **真实无数据不能回落 fixture**：live lookup 已发生后，Word Usage /
   Grammar / WordList context 如果没有返回数据，v3 应显示明确空态；fixture
   只用于 Sandbox；live extension 初始 idle 或无 AppController 时也显示明确空态。

## Session 8/9 补充事实（2026-05-05）

1. **typed lookup 的语言应跟随 lookupLanguage，不应优先复用 currentLanguageCode**：
   v2 `lookup.vue` 用 `settings.getFeatureOptions().items.lookupLanguage` 创建
   `TextSelector`。v3 若先取 `store.state.app.currentLanguageCode`，连续查词后可能把
   新 typed lookup 送到上一次 lookup 的语言路径。

2. **Lookup 页面需要监听 full definitions**：v2 的 definitions tab 从
   `lexeme.meaning.fullDefs` 渲染 full definitions。v3 只监听/显示 short defs
   会让某些合法词典项看起来像“查不到”，尤其是 indeclinable/conjunction 这类
   morphology 很少但词典定义存在的词。

3. **content-v3 不应单独导入 data-models 来生成 languageID**：
   `alpheios-components` UMD 内部已经包含自己的 LanguageModelFactory 与
   language Symbol。typed lookup 的 selector 必须使用
   `AppController.getLanguageName(code).id` 取得同源 Symbol；否则 v3 与 v2
   的 selector 表面相似，但内部语言对象来源不同，容易造成 lookup 行为漂移。

4. **texts.alpheios.net 命中不是普通词典 lookup 的证据**：
   `https://texts.alpheios.net/text/...` 是 Alpheios Reader 文本页，页面可带
   embedded Alpheios/Treebank metadata。该页面上插件能找到某个词，可能来自
   页面内嵌标注、句法图或 selection metadata，而不是通用 lexicon lookup。
   因此 `quamquam` 不应作为 typed lookup 的功能完备验收词；它应放到
   embedded metadata/treebank 路径单独验证。

5. **版本差异会改变底层查词能力**：
   该 Reader 页面报告的运行时版本是 Alpheios Embedded Library
   `3.4.2-incr-3.4.x.20220429024` + Alpheios Components
   `3.4.3-incr-3.4.x.20220428394`。当前 webextension 是 Alpheios Reading
   Tools `3.3.2 build ui.20260505583` + Alpheios Components
   `3.3.1 build dev.20201106557`。因此若 3.4.x 能找到而 3.3.x 不能找到，
   根因可能是 core/components/data-models/client-adapters 的版本能力差异，
   不应在 v3 UI 层伪造结果。

## Session 10 补充事实（2026-05-05）

1. **当前 v3-ui 继续保留，不合并官方 webextension/incr-3.4.x UI**：
   官方 `incr-3.4.x` webextension 分支会移除当前 `content-v3.js` /
   `ui-v3` / v3 文档与 webpack 5 配置，因此不能直接 merge。可继承的是
   `alpheios-core` 中的数据层能力，而不是旧 UI 外壳。

2. **3.3.x Latin/Greek `wordQuery` bypass 是 lookup 能力差异的核心风险**：
   本地 3.3.x `lexis.lexicalQuery()` 曾对 Latin/Greek 优先调用
   `getWordQueryData()`，若没有 homonym 就提前发布 failed。3.4.x 更接近旧
   `LexicalQuery.create()` workflow，继续走 morphology / lexicon /
   word-usage events。本次已把本地 fork 切回 `LexicalQuery.create()` 路径，
   并用 Jest 锁定 Latin lookup 不再调用 `getWordQueryData()`。

3. **Paideia glossary 是 3.4.x 的真实资源增强，不是 fixture**：
   `packages/client-adapters/src/adapters/lexicons/config.json` 现在包含
   `https://github.com/alpheios-project/paidea-glossary`，short URL 为
   `https://repos1.alpheios.net/lexdata/paideia/dat/lat-1a-reader.dat`。
   该资源会通过真实 lexicon adapter 使用，不能在 v3 UI 中手写结果。

4. **webextension 必须指向本地 fork dist 才能继承增强**：
   `webpack.config.mjs` 的 `alpheios-components$` alias 已从
   `node_modules/alpheios-core/...` 改为
   `../alpheios_alpheios-core/packages/components/dist/...`；
   `package.json#update-styles` 同样改到本地 fork。否则即使 fork 源码修好，
   content-v3 仍会打入旧 UMD。

5. **Resources 不再保留 demo fixture**：
   `components-v3` 删除了未使用的 `fixtures/resources.json`，Treebank 页面
   删除 SVG fixture 分支。现在状态只允许：
   live `treebankSrc` iframe、真实 lookup 后 no metadata、初始 idle 空态。
