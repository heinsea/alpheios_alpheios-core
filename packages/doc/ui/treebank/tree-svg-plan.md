# 原生 SVG 依存树渲染器 POC（displaCy 弧线式）

## Context（为什么做）

TREEBANK-OPTIONS.md 的**方案 B**目标：在 components-v3 的 tree 模式里用**原生 SVG**画依存树，替代当前的 Arethusa `<iframe>` 占位（样式可控、深色模式、可缩放、命中高亮、无跨域）。数据层已就绪——清洗管道（perseus_treebankdata/cleaning）已能产出 schema-valid 的 `{nodes, edges}`，并有一份验证过的真实样例 `treebank-example-aeneid-6-1.json`。

本 POC：把样例渲染成依存树并接进 ResourcesPage tree 模式，先用内置样例喂数据（真实数据交付管道留待后续）。

**形态选 displaCy 弧线式**（而非 mockup 的分层树）：保留原文词序（阅读工具关键）、用弧高自然处理古典语高频的非投射依存、窄抽屉（~380px）横向滚动友好、实现更简单鲁棒、更现代。配色/字体/卡片样式仍沿用 mockup 的 token，视觉语言一致。

## 关键决策

- **虚拟根（id 0）不画为 token**。token 只含真实词（id≥1）按 id 升序水平排列。`from≥1` 的边 → 词间弧线；`from===0` 的边 → 把目标词标成 root（`--tertiary` 小标签 + 短竖线），不画长弧、不出现 `[0]` 节点。
- **主题全用 CSS 变量**（`var(--…)`），深色模式经祖先 `[data-theme]` 自动翻转，组件零特判。
- 布局数学抽成纯函数模块，便于 `node --test` 单测。

## 文件改动（components-v3 根 = `…\packages\components-v3\`）

**新建**
- `src/lib/treebank-layout.js` — 纯函数 `layoutDependencyTree({nodes,edges}, opts)`，无 Vue/DOM/三方库。放 `src/lib/`（与 `lookup-data.js`/`resources-helpers.js` 同址，可单测）。
- `src/primitives/DependencyTree.vue` — SVG 渲染组件。放 `src/primitives/`（无 `src/components/` 目录；与 `Icon.vue` 同类的"props→SVG"展示组件）。
- `src/fixtures/treebank-aeneid-6-1.json` — 从 `…\doc\ui\treebank\treebank-example-aeneid-6-1.json` 原样复制（`src/fixtures/` 已存放样例 JSON，如 `arma.json`）。
- `tests/treebank-layout.test.js` — 布局单测（`node:test` + `node:assert/strict`，`import … from '../src/lib/…'`）。

**编辑**
- `src/pages/ResourcesPage.vue` — tree 模板加 native 分支；`tree` computed 默认补 `edges/text`。
- `src/App.vue` — `liveTreeFallback()` 加 POC 短路返回样例（`kind:'native'`）；顶部 import 样例；加 `POC_NATIVE_TREE` 开关。
- `src/composables/use-resources.js` — 两处 `treeData.value` 字面量补 `edges: []`（形状一致，无逻辑变化）。

## 布局算法 — `treebank-layout.js`

纯、确定性、无 DOM 量测（按字符串长度估宽）。常量(opts 默认)：`charW=7.2, minTokenW=26, tokenPadX=14, tokenGap=10, levelH=32, arcBaseRise=22, padTop=18, padX=16, baselinePad=16, arrowSize=5`。

1. **tokens**：`nodes` 过滤 `id≥1`、按 id 升序；逐个 `textW=max(minTokenW, form.length*charW)`、`width=textW+tokenPadX`、`x`=累进左边、`cx=x+width/2`。建 `byId`(id→token) 与 `order`(id→0基序号，仅用于跨度计算/排序，查找一律用 id)。`label = node.label || pos+(morph?' · '+morph:'')`；`formWeight` 默认 500，root 目标或 `id===highlightId` 设 700。
2. **边分区**：`from≥1&&to≥1`→弧；`from===0`→rootMark；端点缺失→跳过（优雅降级）。
3. **弧高分层**（处理嵌套+交叉/非投射）：每弧算 `order` 跨度 `[lo,hi]`、`span=hi-lo`；按 `span` 升序、`lo` 升序排序；冲突判定用严格开区间重叠 `lo1<hi2 && lo2<hi1`（同时覆盖嵌套与交叉，仅共享端点不算冲突）；贪心给每弧分配未被已放置的冲突弧占用的最低 level。`maxLevel`=最大 level（无弧为 -1）。
4. **rootMark**：`{tokenId:to, relation, x:token.cx}`；目标 token 置 `isRoot`、`formWeight=700`。
5. **几何**：`baselineY = padTop + (maxLevel+1)*levelH + arcBaseRise`（无弧则 `padTop+arcBaseRise`）；form 基线在 `baselineY`，morph label 在 `baselineY+baselinePad`。每弧 `rise=arcBaseRise+level*levelH`、`apexY=baselineY-rise`；路径用三次贝塞尔驼峰 `M xL,baselineY C xL,apexY xR,apexY xR,baselineY`；标签 `((xL+xR)/2, apexY-3)` 居中；箭头三角形落在 dependent 的 `cx` 处指向词。
6. **尺寸**：`width=lastToken.x+lastToken.width+padX*2`；`height=baselineY+baselinePad+8`。
7. **返回**：`{ tokens, arcs:[{from,to,relation,level,lo,hi,pathD,labelX,labelY,dir,arrowPoints}], rootMarks, baselineY, width, height, maxLevel }`（弧上暴露 `lo/hi` 供单测断言非重叠）。

## 组件 API — `DependencyTree.vue`

`<script setup>`、纯 JS、`defineProps` 对象式、`alph-` BEM、`<style scoped>`。
- **props**：`nodes`(Array,必填)、`edges`(Array,默认`()=>[]`)、`highlightId`([Number,String],默认 null)。**emits**：`select(tokenId)`。
- `const layout = computed(()=>layoutDependencyTree({nodes:props.nodes,edges:props.edges},{highlightId:props.highlightId}))`。
- `<svg :width :height :viewBox role="img" :aria-label>`，绘制顺序：弧组 → root 标记 → token 组（词在最上）。token `<g tabindex="0" @click/@keydown.enter,space=$emit('select',id)>`。
- **样式（仅 token）**：form `font-family:'Lato','Noto Serif',serif; font-size:14px; font-weight:500; fill:var(--on-surface)`（root/highlight→700）；label `font-size:9px; fill:var(--on-surface-variant); letter-spacing:.08em`（默认 Inter）；arc `fill:none; stroke:var(--outline-variant); stroke-width:1.2`；rel 标签 `9px fill:var(--outline) weight:500 ls:.05em`；arrow `fill:var(--outline-variant)`；root 标签/竖线 `var(--tertiary)`。**不写任何 hex**。

## ResourcesPage + 数据接线

- **模板**：在 `<template v-else-if="mode==='tree'">` 内、现有 iframe 分支**之前**插入：
  `v-if="tree.nodes && tree.nodes.length"` → `.alph-resources__tree-toolbar`(sentence-id) + `.alph-resources__tree-canvas` > `.alph-resources__tree-svg-wrap` > `<DependencyTree class="alph-resources__tree-svg" :nodes :edges="tree.edges||[]" :highlight-id="tree.highlightId??null"/>` + `v-if="tree.text"` 的 `.alph-resources__tree-strip`。其余三分支（iframe/no-metadata/idle）原样保留。
- `import DependencyTree from '../primitives/DependencyTree.vue'`；`tree` computed 默认补 `edges:[], text:''`。**复用现有未接线的 scoped CSS**：`.alph-resources__tree-canvas`(滚动+radial 背景+暗色变体)、`__tree-svg-wrap`、`__tree-svg`、`__tree-strip`。footerMeta 经现有 computed + `emit('footer-meta')` 自动上报。
- **POC 数据注入**（临时、非破坏）：`App.vue` 顶部 `import aeneidTree from './fixtures/treebank-aeneid-6-1.json'`；`const POC_NATIVE_TREE = true /* TEMP */`；在 `liveTreeFallback()` 两个 return 之前加：若 `POC_NATIVE_TREE` 返回 `{kind:'native', ref:'<strong>'+cite+'</strong> · '+provider, text, nodes, edges, highlightId:null, footerMeta, treebankSrc:null, officialReaderUrl:OFFICIAL_READER_URL, isOfficialTextsPage:false, suppressTree:false}`。因 `treePageData = {tree: resources.treeData.value || liveTreeFallback()}`，dev/sandbox 无 controller 时 `treeData.value` 为 null 即走样例；有 live `treebankSrc` 时仍走 iframe。`POC_NATIVE_TREE=false` 可完全恢复原行为（回归保险）。
- `use-resources.js`：live 与 no-metadata 两处 `treeData.value` 补 `edges:[]`。

## 复用的既有资产

- ResourcesPage 已定义但未接线的 tree CSS（上述 4 个类，含 `:deep(.alph-resources__hl)` 与暗色变体）。
- `src/primitives/Icon.vue` 的内联 SVG 范式（viewBox、reactive 属性、currentColor）。
- `src/tokens/tokens.css` 变量（已确认：`--tertiary/--on-tertiary/--tertiary-container/--outline/--outline-variant/--on-surface/--on-surface-variant/--divider/--radius-lg`，亮暗双套）。
- `src/tokens/fonts.css`：Inter（默认 UI）+ Lato（`'Lato','Noto Serif',serif`，古典语文本）。
- `src/fixtures/`、`src/lib/`、`tests/` 既有约定与 `node --test` 测试范式。

## 验证

1. `cd <v3> && npm run dev`（Vite，自动开 sandbox.html）→ 看新增 **DependencyTree** section：16 个真实词按序左→右、弧在词上方、关系标签在弧顶、箭头指向 dependent；`from:0` 的 `et`(COORD)/句末`.`(AuxK) 显示为 tertiary root 小标签而非长弧、无 `[0]` 节点；非投射弧分层不重叠；highlight chip 让 `fatur` 变粗；明暗主题切换所有颜色随 token 翻转；宽句横向滚动不挤压。
2. App 入口加 `?surface=drawer&page=tree`（可加 `&theme=dark`）→ tree 模式在 ~380px 抽屉内渲染、`.alph-resources__tree-canvas` 滚动、底部 text-strip、footer 显示 `6.1 · 16 tokens · Perseus AGLDT v2.1`；将 `POC_NATIVE_TREE=false` 验证 idle/no-metadata/iframe 原状（回归）。
3. `cd <v3> && npm test`（`node --test tests/*.test.js`）→ `treebank-layout.test.js` 断言：token 数=16 且无 id0、id 严格递增；`from:0` 两条→2 个 rootMark 且无对应弧；所有弧 `from≥1&&to≥1`、`level≥0` 整数、`maxLevel≥1`（本句有交叉）；同 level 弧对的 `[lo,hi]` 不严格重叠；`width/height/baselineY>0` 且每 token 在界内；`pathD` 非空、`arrowPoints` 3 点；`highlightId:2` 使该 token 与两个 root 目标 `formWeight=700`；退化输入（仅虚拟根）→ tokens/arcs 空、不抛错。

## 风险

- 文本宽度无 DOM 量测→按字符估算；弧/标签居中锚定，拓扑对小误差稳健。需精确时后续可加 `getComputedTextLength` 二次量测。
- 密集句弧重叠→严格区间分层解决，代价是 SVG 变高（可接受）。
- 380px 抽屉→刻意横向滚动；SVG 必须保持固有宽度（**勿设 `width:100%`**，否则词/弧变形）。
- POC 注入仅在 `treeData.value` 为 null 时生效，`POC_NATIVE_TREE` 开关便于干净移除。
- 若 Node 版本拒绝裸 JSON import，单测内联一份小 `{nodes,edges}` 字面量。
