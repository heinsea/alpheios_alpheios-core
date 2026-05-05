# Scholarly Glass v3 重建进度（动态）

> **方案文档（不可变）**：`REFACTOR-V3-PLAN.md`
> 每完成一个文件 / 子任务，把对应行从 `[ ]` 改为 `[x]`，并在最右补一句"做了什么"。
> 一次只允许一个 `[~]`（in-progress）。
>
> 图例：`[ ]` 未开始 / `[~]` 进行中 / `[x]` 完成 / `[!]` 阻塞 / `[s]` 跳过

---

## 2026-05-05 · session 12 — Correct resource embedding and drawer resize affordance

- 修正 Drawer resize 热区：上一版把 handle 放到 `left:-4px`，在 v3
  ShadowHost 的零尺寸 host / fixed child 组合里容易落到可命中区域之外。
  现在 handle 位于 Drawer 内侧左边缘 `left:0;width:12px`，并设置
  `touch-action:none`，拖拽后仍保存到 `localStorage.alpheios-v3-drawer-width`。
- Grammar 去掉 footer 中重复的外部打开入口；页面内保留单一阅读工具条，
  包含 Home / Back / Forward / Reload / Open。跨域 iframe 无法保证可读写内部
  URL 或 CSS，因此按钮采用“可调用 iframe history 时调用，受限时 no-op/Home
  fallback”的策略。
- Grammar iframe 外层改成更安静的 reader shell：白色页面、浅灰工作区、
  细边框、较高阅读区域；不再保留旧 source-card / fake reading block CSS
  作为主路径。
- Word Usage / Treebank 的无 live 数据状态不再只是跳转链接：直接内嵌
  `https://texts.alpheios.net/` 官方 texts catalog/reader 面板，并提供 passage
  快捷入口。真实功能仍由当前 top-level 页面 metadata + AppController 驱动；
  若用户需要验证 Treebank/Usage，推荐把官方 texts 页面作为当前页面打开后
  `?alpheios=v3` 选词，而不是在普通页面伪造结果。

**验证**：
- `packages/components-v3`: `npm.cmd run build` 通过，dist
  `components-v3.js` 约 137.55 kB，`style.css` 约 85.41 kB。
- `alpheios_webextension`: `npm.cmd run build-dev` 通过，`content-v3.js`
  约 7.35 MiB。
- 静态核对：`dist/content-v3.js` 包含 `Resize Alpheios panel`、
  `Grammar home`、`official reader catalog`、`arrow_forward`。

---

## 2026-05-05 · session 11 — Official reader/grammar flow and drawer reading ergonomics

- Lookup v3 页面移除 `In context` 卡片；`use-lookup.js` 也不再为 lookup
  payload 构造 citation，避免 UI 层隐藏但数据层仍保留旧 mockup 概念。
- Word Usage / Treebank 空态加入官方 reader 入口：
  `https://texts.alpheios.net/text/urn%3Acts%3AlatinLit%3Aphi0959.phi006.alpheios-text-lat1/passage/1.163-1.183`。
  Treebank 仍只读取当前页面真实 Arethusa metadata (`lexis.treebankSrc`)；
  没有 metadata 时明确提示到官方 reader 页选词验证，不伪造树图。
- Grammar 页改为在 Drawer 容器中直接 iframe 浏览 Allen & Greenough 官方语法：
  `https://grammars.alpheios.net/allen-greenough/index.htm?ts=1777980366365#table-of-contents`，
  并保留外部打开按钮；旧的“source card + fake reading blocks”路径不再作为主视图。
- Drawer 导航轨移动到浏览器外侧（右边缘），内容 panel 在内侧；新增左侧
  resize handle，拖动内侧边缘可改变 Drawer 宽度，宽度保存在
  `localStorage.alpheios-v3-drawer-width`。

**验证**：
- `packages/components-v3`: `npm.cmd run build` 通过，dist
  `components-v3.js` 约 131.73 kB，`style.css` 约 84.00 kB。
- `alpheios_webextension`: `npm.cmd run build-dev` 通过，webpack 打入
  `../../alpheios_alpheios-core/packages/components-v3/dist/components-v3.js`，
  `content-v3.js` 约 7.34 MiB。
- 静态核对：`dist/content-v3.js` 含 official reader 文案和 drawer resize
  key；v3 runtime 源码中不再有 `alph-lookup__citation` / `In context`
  Lookup 渲染路径。

**待浏览器验收**：
- 在官方 reader URL 打开 `?alpheios=v3`，选词后切 Usage / Treebank。
  Usage 应显示真实 examples 或明确 no examples；Treebank 若页面 metadata
  可用应显示 live iframe，否则显示 no metadata + reader 入口。
- 切 Grammar 应在 Drawer 内直接浏览 Allen & Greenough TOC；若浏览器/站点
  阻止 iframe，则使用 footer/open 按钮外部打开。
- 拖动 Drawer 左边缘应改变宽度，导航按钮保持在右侧浏览器外缘。

---

## 2026-05-05 · session 10 — Inherit 3.4.x lookup/resource data enhancements

- 保留当前 `v3-ui` UI/Drawer 架构，不 merge 官方 `incr-3.4.x`
  webextension 旧 UI/旧 webpack 分支；只把功能增强移植到本地 core fork。
- `packages/components/src/vue/vuex-modules/data/lexis.js`：
  Latin/Greek lookup 不再走 3.3.x `wordQuery` bypass，统一回到
  `LexicalQuery.create(textSelector, ...).getData()` 旧 workflow。这与
  `incr-3.4.x` 的 lookup 能力路径对齐，避免没有 homonym 时提前
  `LEXICAL_QUERY_COMPLETE FAILED`。
- 新增回归测试
  `packages/components/tests/vue/vuex-modules/data/lexis-module.test.js`：
  验证 Latin typed lookup (`quamquam`) 调用 `LexicalQuery.create()`，且不调用
  `getWordQueryData()`。
- `packages/client-adapters/src/adapters/lexicons/config.json`：
  补入 3.4.x 的 Paideia Latin glossary
  `https://github.com/alpheios-project/paidea-glossary`。
- `packages/client-adapters/src/adapters/lexicons/adapter.js`：
  `lookupInDataIndex()` 的 stripped fallback 重新加 `data` null guard，避免真实
  lexicon index 不可用时崩在 `data.entries()`。
- `packages/components/build/config*.mjs`：
  build alias 改为 monorepo sibling `../*/dist`，并为旧
  `alpheios-inflection-tables` UMD 增加 `uuid/v4` alias；否则当前 hoisted
  workspace 下 components build 会输出 webpack errors 但仍 exit 0。
- `alpheios_webextension/webpack.config.mjs` 与 `package.json`：
  `alpheios-components$` 和 `update-styles` 改为使用本地
  `../alpheios_alpheios-core/packages/components/dist`，确保 v3-ui 打包继承本地
  core fork 增强，而不是 `node_modules/alpheios-core` 的旧 UMD。
- 移除 v3 Resources 的剩余 fixture 树分支和未使用的
  `packages/components-v3/src/fixtures/resources.json`。Treebank 现在只有：
  live iframe / no metadata / idle 空态。

**验证**：
- RED：新增 `lexis-module.test.js` 在旧代码下失败，显示 Latin lookup 调用了
  `getWordQueryData()`。
- GREEN：`npm exec -- jest tests/lib/queries/lexical-query.test.js
  tests/vue/vuex-modules/data/lexis-module.test.js --runInBand` 通过：
  5 passed / 8 skipped。
- `packages/client-adapters`: 新增测试 `26a` / `26b` 分别通过；完整
  `adapter.test.js` 当前仍有既有联网用例 `22 get fullDefinitions fails on not found`
  因远端返回 403 失败，非本次空数据/Paideia 改动导致。
- `packages/client-adapters`: `npm run build` 通过（仅体积 warning）。
- `packages/components`: `npm run build-regular` 通过；webpack 无 errors，仅既有
  style export / size / Sass deprecation warnings。
- `packages/components-v3`: `npm run build` 通过。
- `alpheios_webextension`: `npm run build-dev` 通过；webpack 明确打入本地
  `../../alpheios_alpheios-core/packages/components/dist/alpheios-components.js`，
  `dist/content-v3.js` 约 7.34 MiB。
- 静态核对：`dist/content-v3.js` 包含 `paidea-glossary`；`getProfile()`、
  `startResourceQuery({ type: 'treebank' })`、`Changes saved instantly` 未在
  webextension `src/dist` 中出现。

**未完成浏览器验收**：
- 仍需在 Chrome unpacked `dist/` 中手测 `?alpheios=v3`：
  typed lookup `arma/Romae/profugus/quamquam`，Usage 真实空态或真实 examples，
  Treebank 普通页 no metadata、Arethusa metadata 页 live iframe。

---

## 2026-05-05 · session 9 — Lookup languageID source fix

- 修正 v3 `content-v3.js#runLookup()`：不再从单独导入的
  `alpheios-data-models` 生成 `languageID/model`。`alpheios-components` UMD
  内部已有自己的 data-models 实例，typed lookup 现在改用
  `AppController.getLanguageName(code).id` 取得 controller 同源的 language
  Symbol，再用本地 Latin/Greek normalize 逻辑构造 selector。
- 移除 `webpack.config.mjs` 中已无用的 `alpheios-data-models$` alias，避免
  content-v3 重新引入第二份 data-models。
- 已验证：`alpheios_webextension npm run build-dev` 通过，`content-v3.js`
  仍为约 13.8 MiB。
- 事后澄清：`quamquam` 不是稳定的通用词典验收词；用户观察到的命中来自
  texts.alpheios.net 页面自带的 Alpheios Reader/Treebank 标注路径，而不是旧
  extension 搜索框词典 lookup。后续验收应分开：
  - typed lookup 用 `arma` / `Romae` / `profugus` 等词典服务可返回的词。
  - texts.alpheios.net 页面选词用 embedded metadata / treebank 接入路径验证。

---

## 2026-05-05 · session 8 — Lookup display/language hardening

- 修复 v3 搜索框语言选择与 v2 不一致的问题：typed lookup 现在优先使用
  `selectedLookupLangCode` / `settings.lookupLanguage`，最后才回退到
  `currentLanguageCode`。此前连续查词后可能复用上一个 homonym 的语言。
- `use-lookup.js` 现在监听 `fullDefUpdateTime`，并把 `lexeme.meaning.fullDefs`
  与 `shortDefs` 一起投影到 Lookup 页面，避免真实 full definitions 到达后
  v3 仍显示空定义。
- 已验证：
  `alpheios_alpheios-core/packages/components-v3 npm run build` 通过；
  `alpheios_webextension npm run build-dev` 通过，`content-v3.js` 约 13.8 MiB。
- 当前口径：live v3 UI 不再回落 fixture；无结果或无 controller 时显示明确空态。

---

## Stage 0 · 基础设施（目标：`?alpheios=v3` 看到 mount log）

### Fork（`../alpheios_alpheios-core`）

- [x] `packages/components-v3/package.json` — name=alpheios-components-v3, vue3 + vite peers · 2026-05-04
- [x] `packages/components-v3/vite.config.js` — library mode（ESM + UMD），external: vue · 2026-05-04
- [x] `packages/components-v3/src/index.js` — 暂只 export MountPlaceholder · 2026-05-04
- [x] `packages/components-v3/src/MountPlaceholder.vue` — 玻璃浮层占位卡片 · 2026-05-04
- [x] `packages/components-v3/.gitignore` + `README.md` · 2026-05-04
- [s] `lerna.json` — 不需改：`packages: ["packages/*"]` 自动收 · 2026-05-04
- [x] `npm install && npm run build` 跑通，dist/components-v3.js (1.14 kB) + style.css (1.55 kB) · 2026-05-04

### Webextension（本仓库）

- [x] `package.json` — devDependencies 加 `vue@^3.4.0`（仅运行时；components-v3 用 alias 直链 fork dist）· 2026-05-04
- [x] `src/ui-v3/shadow-host.js` — host div + closed ShadowRoot + 注入 dist style（`?raw` 内联，无需 web_accessible_resources）· 2026-05-04
- [x] `src/ui-v3/mount.js` — createApp(App).mount(shadowRoot)，返回 dispose · 2026-05-04
- [s] `src/ui-v3/App.vue` — 移到 fork 包内（避免 webextension 引入 vue-loader）· 2026-05-04
- [x] `src/content/content-v3.js` — URL 二次校验 + 静态 import mount（单文件输出，无 chunk 拆分）· 2026-05-04
- [x] `webpack.config.mjs` — 增加 content-v3 entry + alias alpheios-components-v3 + vue runtime alias + `?raw` resource query + Vue 3 feature flags · 2026-05-04
- [x] `src/background/background-process.js` — `loadContentScript` 改 async，按 tab URL 选择注入 content.js 或 content-v3.js（`?alpheios=v3` gate）· 2026-05-04
- [s] `src/manifest/manifest.json` — 不需改：注入由 background scripting.executeScript 完成，不走 manifest content_scripts · 2026-05-04
- [x] `npm install vue --legacy-peer-deps` + `npm run build-dev` 通过 · 2026-05-04

### 验收

- [x] Build 产物：dist/content.js (13 MiB v2) + dist/content-v3.js (491 KiB v3) + background.js (143 KiB)，单文件无 chunk 拆分 · 2026-05-04
- [x] Chrome 加载 `dist/` unpacked → thelatinlibrary 页 `?alpheios=v3` 看到玻璃浮卡 + console `[alpheios-v3] mounting · build=ui.20260504647` log · 2026-05-04（用户验收）
- [x] 任意页无 query → 旧 UI 行为不变 · 2026-05-04（用户验收）

> 注：用户验收时看到的 Mixed Content 警告全部来自 thelatinlibrary.com 自身（http 资源引用），与扩展无关。

---

## Stage 1 · Token + Primitives（目标：sandbox 与 mockup 1:1）

- [x] `packages/components-v3/src/tokens/tokens.css` — :root 完整 light + [data-theme=dark] + 间距/圆角/动效 tokens · 2026-05-04
- [x] `packages/components-v3/src/tokens/fonts.css` — Inter / Lato / Material Symbols 通过 Google CDN，scope 通过 `.alpheios-v3-scope` 限制 · 2026-05-04
- [x] `packages/components-v3/src/primitives/Button.vue` — primary/secondary/ghost/icon/fab 5 variant + block + disabled · 2026-05-04
- [x] `packages/components-v3/src/primitives/Toggle.vue` — 32×18 pill + 14×14 thumb，原生 checkbox keyboardable · 2026-05-04
- [x] `packages/components-v3/src/primitives/Segmented.vue` — default/inline 两 size，role=tablist + aria-selected · 2026-05-04
- [x] `packages/components-v3/src/primitives/Chip.vue` — default/filled/tertiary/error 4 variant + clickable + active · 2026-05-04
- [x] `packages/components-v3/src/primitives/Slider.vue` — 4px 轨 + 14px 拇指 + 数字读出，跨浏览器 ::webkit/-moz · 2026-05-04
- [x] `packages/components-v3/src/primitives/StatCard.vue` — value + label，tabular-nums · 2026-05-04
- [x] `packages/components-v3/src/primitives/ElevatedCard.vue` — eyebrow / body / footer 三槽，accent stripe 选项 · 2026-05-04
- [x] `packages/components-v3/src/primitives/RecessedInput.vue` — icon prefix + clearable + suffix slot + Enter 事件 · 2026-05-04
- [x] `packages/components-v3/src/primitives/FrostedGlass.vue` — DESIGN §4.5 三层 box-shadow + tone (standard/low) + radius prop + 浏览器 fallback · 2026-05-04
- [x] `packages/components-v3/src/Sandbox.vue` + `sandbox-main.js` + `sandbox.html` — Vite dev server 入口，9 primitives 展示 + light/dark 切换 · 2026-05-04
- [x] `packages/components-v3/src/index.js` — 导出 9 primitives，CSS side-effect 顺序：tokens → fonts → 各组件 scoped styles · 2026-05-04
- [x] Build 验证：fork dist/style.css 19.66 kB + components-v3.js 10.84 kB；webextension 重建后无破坏 · 2026-05-04

---

## Stage 2 · 4 Surfaces + LookupPage（目标：扩展内看到 Drawer + Lookup）

- [x] `surfaces/Popup.vue` — 4 状态（default/loading/no-result/error）+ 玻璃箭头 + 缓存数据兜底（error 状态显示 cached 标签）· 2026-05-04
- [x] `surfaces/Drawer.vue` — 64 sidebar (brand + 7 main + 2 bottom tabs) + 380 panel (topbar + search slot + scroll + footer slot) · 2026-05-04
- [x] `surfaces/Toolbar.vue` — 44×44 FAB，点击 → uiStore.setSurface('drawer') · 2026-05-04
- [x] `surfaces/Toast.vue` — 玻璃通知卡 + 3px 左侧 stripe（success=tertiary / error=error / info=secondary）+ Vue `<Transition>` 渐入渐出 · 2026-05-04
- [x] `pages/LookupPage.vue` — 完整 lookup body：词卡 + POS tags + 形态卡（可折叠）+ 短定义 + 引用 + 主要部分 + providers · 2026-05-04
- [x] `store/ui-store.js` — reactive surface/page/popupState/theme + toast helper + URL override 解析（?surface=&state=&page=&theme=）· 2026-05-04
- [x] `fixtures/arma.json` + `empty-states.json` — Stage 4 之前的演示数据 · 2026-05-04
- [x] `App.vue` — 顶层 surface 路由 + 根据当前 page 决定 Drawer 的 search/footer 内容 · 2026-05-04
- [x] tokens.css 关键修复：`:host` 多选择器让 ShadowRoot 内 token 也生效（避免变量在 shadow scope 失效）· 2026-05-04
- [x] App.vue 关键修复：去掉 `documentElement.setAttribute('data-theme')`（避免污染宿主页主题系统）· 2026-05-04
- [x] Build：fork dist 42 KB style + 43 KB JS；webextension content-v3.js ~530 KiB · 2026-05-04
- [ ] **待用户操作**：扩展内 `?alpheios=v3` 看到完整 Drawer + Lookup arma 页
- [ ] **待用户操作**：URL 切换 `surface=popup` `state=loading|no-result|error` `theme=dark` 测各状态

---

## Stage 3 · 剩余 6 页（目标：sidebar 7 tab 全部可切）

- [x] `pages/InflectionsPage.vue` — 表 + Browser 两模式（drawer-inflections.html）· local mode toggle + Segmented(verb/noun, wide/narrow) + filter chips + 三步 picker · 2026-05-05
- [x] `pages/WordListPage.vue` — 分组 + 过滤 + 上下文（drawer-wordlist.html）· list/context 双 view + bulk select + 折叠展开分组 · 2026-05-05
- [x] `pages/ResourcesPage.vue` — Usage / Grammar / Treebank 三合一（drawer-resources.html）· `mode` prop（usage/grammar/tree）+ SVG dependency tree（节点/边由 fixture 派生）+ zoom 控件 · 2026-05-05
- [x] `pages/SettingsPage.vue` — UI/Features/Resources/Advanced 4 子 tab（drawer-settings.html）· top Segmented + reactive values + dirty 计数 + about/danger 块 · 2026-05-05
- [x] `pages/AuthPage.vue` — 未登录 / 已登录 两态（drawer-auth.html）· 三 feature CTA + StatCard×3 + activity/sessions 列表 · 2026-05-05
- [x] `pages/MorphPage.vue` — 形态完整页（无独立 mockup，扩展自 LookupPage 的 morph 卡片，所有 readings 默认展开 + principal parts + providers）· 2026-05-05
- [x] `fixtures/inflections.json` + `wordlist.json` + `resources.json` + `settings.json` + `auth.json` — Stage 3 静态数据 · 2026-05-05
- [x] `primitives/Icon.vue` — 新增 ~28 个 SVG 路径（chevron_left/right、arrow_back、first/last_page、filter_list/alt、sort、tune、checklist、drag_indicator、delete、cloud_sync、sync、history、logout、verified、smartphone、laptop_mac、download、print、open_in_new、link、help、fit_screen、file_upload/download）· 2026-05-05
- [x] `App.vue` — 9 个 page 全部路由（v-if 链）+ 每页独立 footer slot 内容 + langLabel 由 page 派生 + 独立 toast 触发 · 2026-05-05
- [x] `index.js` — 导出新 6 个 page 组件 · 2026-05-05
- [x] Build：fork dist/style.css 81 kB + components-v3.js 125 kB；webextension content-v3.js 760 KiB（vs Stage 2 530 KiB） · 2026-05-05
- [ ] **待用户操作**：扩展内 `?alpheios=v3&page=inflections|wordlist|usage|grammar|tree|opts|user|morph` 切每个 tab 视觉验收
- [ ] **待用户操作**：Settings 改 toggle/slider 看 footer dirty 计数；Auth 点 CTA 切到登录态；WordList 点词条进 context view

---

## Stage 4 · 接数据层（目标：新旧 UI 数据一致）

> **拆分**（2026-05-05 与用户对齐）：4a 基础设施 → 4b useLookup + LookupPage →
> 4c 其余数据 page → 4d Settings + Auth。**互斥策略**：硬互斥（已是当前
> 行为，background `loadContentScript` URL gate 选择注入 v2 或 v3，从不
> 共存于同一页）。

### Stage 4a · 基础设施（content-v3 起 AppController + 仅 AuthModule）

- [x] `composables/use-app-controller.js` — provide / inject helper，Symbol 键 `APP_CONTROLLER_KEY` + `useAppController()` + `useStore()`（Sandbox 上下文返回 null，pages 自动 fallback fixture） · 2026-05-05
- [x] `index.js` — 导出 composable 三件套 · 2026-05-05
- [x] `src/ui-v3/mount.js` — 接受 `appController` 参数，`app.provide(APP_CONTROLLER_KEY, appController)` 后再 mount · 2026-05-05
- [x] `src/content/content-v3.js` — 实例化 MessagingService + AppController；仅注册 AuthModule（PanelModule/PopupModule/ToolbarModule/ActionPanelModule 完全不注册，由 v3 UI 取代）；`init()` → 监听 `browser.runtime.onMessage`（让 BgAuthenticator 拿到回调）→ `activate()` → 把 controller 传给 mount() · 2026-05-05
- [x] 不注册 STATE_REQUEST 处理器 — icon-click 激活流是 v2-only，v3 通过 URL gate 自激活 · 2026-05-05
- [x] beforeunload 调 `appController.deactivate()` 与 `dispose()` 双清理 · 2026-05-05
- [x] Build 验证：fork dist 同上；webextension content-v3.js 760 KiB → 14 MiB（含 v2 UMD），与 content.js 体量相当 — 是接入 alpheios-core 数据层的必然代价 · 2026-05-05
- [x] 双版本互斥已是当前行为（background-process.js `loadContentScript` 按 URL 选 content.js / content-v3.js，从不共存）· 2026-05-05
- [ ] **待用户操作**：扩展内 `?alpheios=v3` 打开 console，应见 `[alpheios-v3] mounting` 与 `[alpheios-v3] AppController active · auth module ready` 两行 log，无报错；旧 v2 路径（无 query）继续正常

### Stage 4b · useLookup + LookupPage 接通数据

- [x] `composables/use-lookup.js` — watch Vuex `app.{homonymDataReady,shortDefUpdateTime,morphDataReady,targetWord,lexicalRequest}` → Vue 3 ref；返回 `{data,loading,error}`；`onScopeDispose` 清理 5 个 Vuex unwatch；Sandbox 上下文返回 inert null refs · 2026-05-05
- [x] `App.vue` — `useLookup()` + `lookupData` computed merge live 与 fixture（live 字段覆盖、空 fallback fixture）；LookupPage / MorphPage 都吃 `lookupData`；search slot 的语言 chip 也跟随 · 2026-05-05
- [x] Build：fork dist 81 kB style + 128 kB JS（vs 4a 125 kB，+3 kB composable）；webextension 同 14 MiB · 2026-05-05
- [ ] **待用户操作**：扩展内 `?alpheios=v3` 选 "arma" / "Romae" / "profugus" 等词，v3 Drawer Lookup 页应自动刷新成所选词的真实 lemma + 语言 + POS + 短定义；citation/principal parts/morph 行仍是 fixture（4c 接）

### Stage 4c · 其余数据 page

- [x] `composables/useInflections.js` — 读 Vuex `app.hasInflData` + `api.app.getInflectionsViewSet()` → render() → 提取 wideView.rows/columns/footnotes · 2026-05-05
- [x] `composables/useWordList.js` — 读 `api.app.getAllWordLists()` → groups + `selectWordItem()` → context view · 2026-05-05
- [x] InflectionsPage / WordListPage / MorphPage 接通 — App.vue 计算属性 merge live + fixture fallback；MorphPage 通过增强的 useLookup morph rows（从 Lexeme.inflections 提取 stem/suffix/features）· 2026-05-05
- [x] ResourcesPage usage/grammar/tree 接线收敛 — App.vue 改为复用 `use-resources.js`（移除内联 buildUsage/buildGrammar/buildTree 重复逻辑）；usage/grammar 继续 watch live 数据；tree 由 `lexis.treebankSrc` 驱动（有值走 live iframe，无值显示 idle/no metadata 空态）· 2026-05-05
- [x] LookupPage citation + principalParts 从 live 数据填充 — citation 读 `selectedText` + `window.location.href`；principalParts 读 `lemma.principalParts: string[]` · 2026-05-05

### Stage 4d · Settings + Auth

- [x] SettingsPage 接 `appController.api.settings` — UI/Feature 真实 option 即时持久化；Resource tab 从 `getResourceOptions().items.lexicons/lexiconsShort/grammars` 生成真实 provider checkbox，写入 `resourceOptionChange(fullName,value)` + `applyResourceOption()`；Reset 调 `resetAllOptions()` + 重新 populate · 2026-05-05
- [x] AuthPage 接 `auth.authenticate() / auth.logout() / session() / getUserData()` — watch Vuex `auth.{isAuthenticated,userId,userNickName,isSessionExpired}` 控制登录态；不调用不存在的 profile helper · 2026-05-05

---

## Stage 5 · 切换默认 + 清理（待 Stage 4 通过且用户确认）

- [ ] `manifest.json` content_scripts 默认指向 content-v3.js（旧 content.js 留代码不删）
- [ ] 删除 `src/styles/alpheios-overrides.css`
- [ ] `packages/components/` 加归档说明
- [ ] 2 周稳定期后：删旧 content.js / 旧 components / overrides.css

---

## 会话日志（最新在顶）

### 2026-05-05 · session 7 — Stage 4 全量数据接入收尾

**范围**：按用户确认，全量收尾 Lookup / Morph / Inflections /
WordList / Word Usage / Grammar / Treebank / Settings / Auth 的真实数据接入。

**实现修复**：
1. **Settings footer/reset 真实接线** — App.vue 持有 SettingsPage ref，
   footer 读取组件 `footerMeta`；Reset 按钮调用组件暴露的 `reset()`，
   不再硬编码旧的 settings footer 文案。
2. **Settings resource options 真实化** — Resource tab 从
   `getResourceOptions().items.lexicons/lexiconsShort/grammars` 生成 provider
   checkbox；勾选调用 `resourceOptionChange(fullName,value)`，并同步调用
   `api.app.applyResourceOption(fullName,value)`。未映射到真实 core option 的
   fixture 控件保留本地 demo 状态。
3. **Auth API 修正** — AuthPage 不再调用不存在的 profile helper；
   登录/登出走 `authenticate()` / `logout()`，mount 时调用 `session()`，
   视图由 Vuex `auth.isAuthenticated/userId/userNickName/isSessionExpired`
   驱动；可用时只把 `getUserData()` 用作 endpoint/session 元信息。
4. **Word Usage / Grammar 空态** — 真实 lookup 后无 usage/grammar 数据时
   显示明确空态，不再回落到 fixture quotes/grammar。
5. **WordList context 空态** — live wordlist 下选词时只显示真实 context；
   没有 context selector 时显示空 context，不再混入 fixture citation。
6. **Inflections 连续查词刷新** — 增加对 `lexicalRequest.endTime` 的 watch，
   避免 ready boolean 持续为 true 时漏刷新。

**Build 验证**：
- `components-v3`: `npm run build` 通过，dist/style.css 82.41 kB，
  components-v3.js 155.97 kB。
- `alpheios_webextension`: `npm run build-dev` 通过，content-v3.js 13.9 MiB。

**待用户操作（浏览器验收）**：
- `?alpheios=v3` 连续查 `arma -> Romae -> profugus`，Lookup/Morph/
  Inflections/Usage 不滞留旧词。
- Settings 修改 UI/Feature/Resource，刷新 v3 后状态保持；Reset 恢复默认。
- Auth 登录/登出由 Vuex auth 状态切换视图，console 无 `getProfile is not a function`。

### 2026-05-05 · session 6 — Stage 4c 收尾（仅 Word Usage + Treebank）

**范围对齐**：按用户指示，本次只做 Word Usage + Treebank；Lookup/Enter 不再改动。

**Bug 修复（2 个）**：
1. **Word Usage 连续查词后不稳定刷新** — `use-resources.js` 仅 watch `homonymDataReady` 时，连续查询期间该布尔值可能保持 true，导致后续查询未再次触发 `getWordUsageData`。修复：新增对 `app.lexicalRequest.endTime` 的 watch；每次查询完成都按当前 `api.app.homonym` 触发 usage 拉取（保留原 `homonymDataReady` watcher）。
2. **Treebank 无 metadata 时缺少明确状态** — `buildTree()` 已产出 `kind:'no-metadata'`，但 `ResourcesPage.vue` 未分支渲染该状态。修复：tree 模式新增 `v-else-if="tree.kind === 'no-metadata'"` 空态卡片；有 `treebankSrc` 继续 live iframe。后续 session 10 已删除剩余 fixture SVG 分支。

**Build 验证**：
- `components-v3`: build 通过，dist/style.css 81.83 kB，components-v3.js 150.03 kB
- `alpheios_webextension`: `npm run build-dev` 通过，content-v3.js 13.8 MiB

**待用户操作（验收）**：
- `?alpheios=v3` 连续查 `arma -> Romae -> profugus`，切到 Word Usage：应随每次新词刷新 quotes/authors（非停留前一词）。
- 切到 Treebank：
  - 普通页面（无 Arethusa metadata）应显示“no metadata”空态，不报错；
  - 带 metadata 页面应进入 live iframe。

### 2026-05-05 · session 5 — Stage 4 端到端验收 3 个 bug 修复

> 详细分析与方案：`REFACTOR-V3-STAGE4-FIX-LOOKUP-USAGE-TREE.md`

**根因**（共同）：v3 故意不注册 UIController（Panel/Popup/Toolbar/ActionPanel
都被 v3 UI 取代），但 alpheios-core 的 app-controller.js 多处调用
`this.api.ui.*`（934/936/937/974/1140/1449），任意一条路径都会抛
TypeError → store 半提交、用户看不到反应。

**Bug 修复**（3 个）：

1. **搜索框 Enter 不触发查词** — content-v3.js 在 `activate()` 之后给
   `appController.api.ui` 装 no-op stub（覆盖 openLexQueryUI / openPanel /
   closePanel / closeUI / hasModule / changeTab / showLookupResultsUI /
   isPopupVisible 8 个方法），并挂载 `appController.runLookup(text, langCode?)`
   helper：内部 `LanguageModelFactory.getLanguageIdFromCode(code)` + 构造
   duck-typed TextSelector（6 字段：text/languageID/model/data/location/
   normalizedText）+ `api.lexis.lookupText(textSelector)`。`api.app.newLexicalRequest`
   只 commit store mutation 不发查询，不能直接用。
   App.vue `onSearchEnter` 改为调 `controller.runLookup(value, code)`，语言
   按 currentLanguageCode → selectedLookupLangCode → settings.lookupLanguage
   → 'lat' 链路 fallback。

2. **WordUsage 不出 live 数据** — 没单独改：bug 的实际原因是 #1 让
   homonym 永远不产生，`use-resources.refreshUsage` 一直 early-return。
   修 #1 后自然通（拉丁词 + default `enableWordUsageExamples=true` +
   onDemand 模式）。

3. **Treebank 不出 live 数据** — `use-resources.refreshTree` 改 no-op
   并补长注释：原代码调 `api.startResourceQuery({type:'treebank',...})`
   是错误 API（ResourceQuery#iterations 只走 grammar 流，不识别 type 字段，
   最终 publish GRAMMAR_NOT_FOUND）。treebank 实际由 lexis 模块依赖
   Arethusa 风格的 DOM metadata 自动写入 `lexis.treebankSrc` —
   composable 已 watch 该字段，普通页面没 metadata 就保 fixture，
   不存在合法的手动 trigger 路径。

**附带修复**：`api.ui.isPopupVisible` stub 同时治好 `onTextSelected`
路径在 v3 模式下双击选词的 silent throw。

**辅助工程**：webpack.config.mjs 加 `alpheios-data-models$` alias 直链
到 `node_modules/alpheios-core/packages/data-models/dist/alpheios-data-models.min.js`
—— 因为 alpheios-components UMD 不 re-export `LanguageModelFactory`
（plugin.js export 列表里没它）。

**Build 验证**：fork dist 81 kB style + 148.78 kB JS（vs session 4
142 kB JS，+7 kB 来自 use-resources / App.vue 改动）；webextension
dev build 通过，content-v3.js 13.8 MiB（持平）。

**待用户操作**（验收）：
- `?alpheios=v3` 搜索框输入 `arma` / `Romae` / `profugus` 按 Enter →
  Drawer 应当从 loading 切到 success 显示真实词条；console 不再有
  TypeError。
- 切到 Word Usage tab → 拉丁词应显示真实 quotes/authors 分组。
- 切到 Treebank tab → 普通页面显示明确 no metadata 空态（应当无报错）；
  在带 Arethusa metadata 的页面（Perseus 标注页等）选词应进 live iframe。
- 双击选词路径（v3 模式下）应反应正常，无 silent error。


**Bug 修复**（Resources 数据接入，后续 session 5/6/7 已修正 treebank 触发策略）：
1. **App.vue 重复接线导致状态不稳**：移除内联 `buildUsageFromApi/buildGrammarFromApi/buildTreeFromApi` 与页面内临时 watch，改为统一复用 `use-resources.js`，避免同一数据源多路径更新造成“像没接上”的表现。
2. **TreeBank live 触发与判定（已废弃）**：当时尝试过 tree 页切入时手动发起 treebank ResourceQuery；后续已确认这是错误 API，当前实现只被动监听 `lexis.treebankSrc`。
3. **ResourcesPage 空值鲁棒性**：`usage/grammar/tree` 计算属性补默认结构，`grammar.reading` 读取改为可空链，避免 live 未就绪时空引用。

**待用户操作验收**：
- `?alpheios=v3&page=usage`：先查词后切页，应见真实 usage quotes/author 分组（非纯 fixture）。
- `?alpheios=v3&page=grammar`：应见 live grammar provider/link。
- `?alpheios=v3&page=tree`：有 treebank 数据时显示 live iframe；无数据时显示明确 idle/no metadata 空态，不报错。



**Bug 修复**（2 个）：
1. **搜索框 Enter 键无响应**：App.vue RecessedInput 缺少 `@enter` 处理器。添加 `onSearchEnter` 函数，调用 `controller.api.app.newLexicalRequest(value, languageID, null, 'lookup')`。
2. **Popup 显示硬编码 fixture 词**：`empty-states.json` 中 loading.lemma="Troiae"、noResult.lemma="xyzzy" 被 Popup.vue 的 targetWord 计算属性优先使用，盖过实际查词。修复：Popup.vue targetWord/targetLang 改为优先 data（live）再 fallback emptyStates（fixture）；noResult.desc 正则替换 fixture lemma 为真实词。

**Stage 4c**：
- `composables/use-wordlist.js` — 读 `api.app.getAllWordLists()` → 按 languageCode 分组 → groups；`selectWordItem()` 触发查词 → watch `homonymDataReady` 构建 contextData
- `composables/use-inflections.js` — 读 `api.app.getInflectionsViewSet()` → `view.render()` → 提取 wideView.rows/columns/footnotes → matchedData
- use-lookup.js 增强：从 Lexeme.inflections 提取 stem/suffix/prefix + 语法特征（case/number/gender/...）填充 morph rows
- App.vue：新增 `inflectionsData`/`wordlistData` 计算属性 merge live + fixture fallback
- WordListPage 新增 `@select-word` emit；InflectionsPage/MorphPage 通过新数据 props 接入

**Stage 4d**：
- SettingsPage：`OPTION_MAP` 映射 fixture ID → 真实 option key（fontSize→uiOptions.fontSize, modUsage→featureOptions.enableWordUsageExamples 等）；onMounted 从 API populate；watch deep 即时调 `uiOptionChange`/`featureOptionChange`；Reset → `resetAllOptions()` + 重新 populate
- AuthPage：watch Vuex `auth.isAuthenticated` 控制登录态；CTA → `authenticate()`；Logout → `logout()`；后续 session 7 已改为不调用不存在的 profile helper。
- App.vue Settings footer：当时 controller 存在时硬编码显示旧的 settings footer 文案；后续 session 7 已改成读取 SettingsPage 暴露的真实 footerMeta。

**Build 验证**：fork dist 142 kB JS + 81 kB CSS（+17 kB from Stage 3）；webextension 13.8 MiB，编译通过。

### 2026-05-05 · session 2 — Stage 3 完成

**Stage 3**（待用户视觉验收）：
- 6 个新 page：Inflections / WordList / Resources（usage+grammar+tree 共用）/
  Settings / Auth / Morph。全部按 mockup 1:1 落地，每页 scoped CSS，
  内部 sub-state 由 ref 管理（mode/view/tab 等）。
- 5 个新 fixture（inflections/wordlist/resources/settings/auth.json），
  Stage 4 接真实 appController.api 时这些 JSON 会被换掉。
- Icon 字典从 ~25 个扩到 ~50 个（补 chevron_*/arrow_back/first_last_page/
  filter_*/sort/checklist/drag_indicator/cloud_sync/sync/history/logout/
  verified/smartphone/laptop_mac/download/print/open_in_new/link/help/
  fit_screen/file_upload/download）。所有路径 Heroicons 风格 stroke
  outline，与原有保持一致。
- App.vue 重写为 9 个 page 的 v-if 路由 + 每页独立 footer slot 内容；
  langLabel 由 page 名派生（Inflections / Word Usage / Treebank / …）。
- ResourcesPage 是单组件多模式：`mode` prop 控制 usage / grammar / tree
  三种渲染。Tree 子模式直接用 fixture 里的 nodes 数组生成 SVG（含 zoom
  控件 + 边自动从 parent 计算）。
- SettingsPage 关键设计：fixture 里的所有 row.value 启动时拷到 reactive
  `values` 字典，dirty 计数 = JSON.stringify 对比。footer 显示 N changes
  · unsaved / No changes。Reset 写回 initial 快照。
- AuthPage 用 demo 链接在两态间切换；Stage 4 会用 `auth.isAuthenticated()`
  替换。
- Build 验证通过：fork dist 81 kB style + 125 kB JS（vs Stage 2 42 kB
  style + 43 kB JS，主因为 6 page CSS + 28 个新 icon path）；webextension
  content-v3.js 760 KiB（vs Stage 2 530 KiB）。
- 待用户在扩展内逐 tab 验收（见 Stage 3 待操作清单）。

### 2026-05-04 · session 1 — Stage 0 + Stage 1 完成

**Stage 0**（已浏览器验收通过 · 用户在 thelatinlibrary.com 看到玻璃浮卡）：
- 见上一条记录。

**Stage 1**（待用户视觉验收）：
- 写完 9 个 primitive：Button / Toggle / Segmented / Chip / Slider /
  StatCard / ElevatedCard / RecessedInput / FrostedGlass。
- 完整 token 体系 light + dark + 间距/圆角/动效，统一通过 `.alpheios-v3-scope`
  类隔离，避免与宿主页 CSS 互染。
- Sandbox 演示页（`sandbox.html` + `Sandbox.vue`）跑 vite dev 即可全屏预览
  + 切换主题 + 调每个组件状态。
- fork dist/style.css 从 1.55 kB 长到 19.66 kB（合理：9 个组件 + token + 字体）。
- 待用户跑 `cd packages/components-v3 && npm run dev` 视觉验收。

### 2026-05-04 · session 1 — Stage 0 全部文件完成

- **Fork**：新建 `packages/components-v3/` 包（Vue 3 + Vite library mode）。
  导出 `App` + `MountPlaceholder`。Vite build 产出 dist/components-v3.js (1.24 kB)
  + style.css (1.55 kB)。lerna 自动收（不需改 lerna.json）。
- **Webextension**：
  - `webpack.config.mjs` 加 `content-v3` entry、alias `alpheios-components-v3$`
    直链 fork dist（绕开 npm install 的 file: 复制）、`vue$` 锁定 esm-bundler
    构建、`?raw` query 让 css 文件作为字符串导入、Vue 3 feature flags。
  - `src/ui-v3/{shadow-host,mount}.js` + `src/content/content-v3.js`：closed
    ShadowRoot 隔离 + 静态 import 单文件输出（content-v3.js 491 KiB）。
  - `src/background/background-process.js`：`loadContentScript` 改 async，按
    tab URL `?alpheios=v3` 选择注入 v2 或 v3，二者从不共存于同一页面。
  - `npm install vue@^3.4.0 --legacy-peer-deps`（项目原有 alpheios-node-build
    peer-dep 锁，需要 legacy 标志，与现有 README 一致）。
- 两边 build 都通过；旧 v2 路径完全不动。
- 待用户在浏览器内验收：访问任意 https 页 + `?alpheios=v3`，应看到右下角玻璃浮卡。

### 2026-05-04 · session 0 — 计划制定与持久化
- 与用户达成方案：webextension `src/ui-v3/` + fork `packages/components-v3/`，Vue 3 + Vite，先静态原型后接数据层，URL query `?alpheios=v3` 开关。
- 写入 `REFACTOR-V3-PLAN.md`（不可变）和本进度文件。
- 准备开始 Stage 0。
