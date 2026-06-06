# Alpheios Grammar Reader 现代化渲染方案

日期：2026-06-05

## 1. 背景

当前 `grammars.alpheios.net/allen-greenough/` 下的 Allen & Greenough's New Latin Grammar 页面属于老旧静态 HTML 页面。

根据请求分析结果：

- 没有动态 API。
- 没有 JSON/XML 响应。
- 没有鉴权流程。
- 所有内容均来自静态 HTML、图片和 CSS。
- 页面由 Amazon S3 + CloudFront 提供。
- 主要内容通过 `#page-wrapper` 包裹。
- 页面结构稳定，适合通过 Web Extension 的 content script 重新排版。

目标是在浏览器扩展中对这些老旧页面进行现代化阅读体验改造，使其更适合阅读、查阅和学习。

---

## 2. 目标

将原始语法书页面改造成类似现代文档站或学术阅读器的界面：

- 提升正文排版质量。
- 保留原始 HTML 内容。
- 保留原始交叉引用、锚点和图片。
- 增强表格、脚注、图片和目录的可读性。
- 支持后续扩展为完整语法阅读器。
- 尽量避免改动远端资源或重写内容。

---

## 3. 内容结构分析

这些页面的结构较稳定，可以直接通过 DOM 选择器处理。

| 内容类型 | 原始结构 | 建议处理 |
|---|---|---|
| 主体容器 | `#page-wrapper` | 作为现代阅读区域 |
| 章节标题 | `h2`, `h3`, `h4` | 建立清晰层级和间距 |
| 正文段落 | `p` | 增加字号、行距、限制行宽 |
| 拉丁语词 | `.foreign` | 斜体、深色、保持学术感 |
| 英文释义 | `.gloss` | 柔和颜色、斜体 |
| 注释标签 | `.noteLabel` | 做成小型 badge |
| 交叉引用 | `a[href*=".htm#sect"]` | 保留链接，增加可识别样式 |
| 脚注引用 | `a[href^="#fn"]`, `sup` | 可保留或增强为 tooltip |
| 脚注内容 | `a[id^="fn"]` | 底部脚注区样式优化 |
| 表格 | `.table table`, `table` | 响应式横向滚动、边框、斑马纹 |
| 变格图 | `img` | 自适应宽度、懒加载、点击放大 |
| 目录页 | `index.htm` | 改造成现代目录导航页 |

---

## 4. 推荐方案

### 4.1 首选方案

推荐使用：

```text
Manifest V3 Web Extension
+ Content Script
+ 本地 CSS / 编译后的 TailwindCSS
+ 少量 DOM enhancement
```

核心思路：

```text
原始静态 HTML 页面
  ↓
content script 注入
  ↓
移除或覆盖旧 site.css
  ↓
给 #page-wrapper 应用现代阅读布局
  ↓
增强表格、图片、脚注、导航
  ↓
保留原始链接和锚点行为
```

### 4.2 为什么选择 Content Script

不建议用 Service Worker 拦截或完整重写页面，原因是：

- 原页面已经包含完整内容。
- 页面没有 API 依赖。
- 只需修改 DOM 和 CSS 即可获得明显提升。
- 原始图片、链接、锚点可以继续使用。
- 实现成本低，风险小，适合逐步迭代。

---

## 5. 不建议的方案

### 5.1 不建议运行时加载 CDN Tailwind

不推荐在 content script 中使用：

```js
https://cdn.jsdelivr.net/npm/tailwindcss...
```

原因：

- Manifest V3 对 CSP 限制较严格。
- 扩展审核更偏向本地资源。
- CDN 有可用性和隐私风险。
- 本地打包更稳定。

建议使用本地 CSS：

```text
extension/
  styles/
    reader.css
```

或者使用 Tailwind 构建生成：

```text
src/reader.css
  ↓ tailwind build
extension/styles/reader.css
```

### 5.2 第一阶段不建议 React/Vue 全量重写

React/Vue 重新渲染可以作为后续方案，但第一阶段不建议直接做。

原因：

- 工作量更大。
- 需要 HTML sanitizer。
- 需要建立内容模型。
- 需要处理所有原始 HTML 细节。
- 当前目标只是现代化阅读体验，CSS + DOM enhancement 已足够。

---

## 6. 视觉风格建议

### 6.1 推荐风格：沿用 Mockups 的 Scholarly Glass

`packages/doc/ui/mockups/` 中现有设计图已经形成了一套比较稳定的 Alpheios v3 视觉语言，主要特征是：

- 中性灰阶 surface 系统。
- 黑白作为 primary，减少装饰性彩色。
- 绿色 `tertiary` 用于表示 verified、root、当前命中等正向语义。
- 红色 `error` 仅用于错误状态。
- Inter 作为 UI 字体，Lato / serif 作为古典语言和阅读字体。
- 卡片、drawer、popup 使用轻量 glass / surface container 层级。
- 视觉风格偏学术、克制、现代，而不是传统仿书本的暖色系。

因此语法阅读器建议不要另起一套深红、米白的主题，而是复用 mockups 中的 token，并在长文阅读区域做轻微调整。

推荐风格：

- 基础 UI 使用 mockups 的 `Scholarly Glass v2.0`。
- 语法正文使用更宽松的阅读排版。
- 保留中性灰背景和白色阅读 surface。
- 只在章节锚点、当前命中、引用提示中使用少量强调色。
- 不使用过度装饰的古典羊皮纸、深红金边等样式，避免和现有扩展 UI 脱节。

### 6.2 Mockups 中的现有颜色 token

以下 token 来自 `mockups/index.html`、`mockups/popup-states.html`、`mockups/drawer-resources.html`：

```css
:root {
  --surface: #f9f9fb;
  --surface-container-lowest: #ffffff;
  --surface-container-low: #f3f3f5;
  --surface-container: #edeef0;
  --surface-container-high: #e8e8ea;

  --on-surface: #1a1c1d;
  --on-surface-variant: #4c4546;

  --glass-surface: rgba(255, 255, 255, 0.55);
  --glass-surface-low: rgba(255, 255, 255, 0.35);
  --glass-border: rgba(255, 255, 255, 0.6);
  --glass-shadow: rgba(0, 0, 0, 0.08);

  --primary: #000000;
  --on-primary: #ffffff;

  --secondary: #5e5e5e;
  --secondary-container: #e1dfdf;
  --on-secondary-container: #3a3a3a;

  --tertiary: #0e6b4f;

  --error: #ba1a1a;
  --error-container: #ffdad6;
  --on-error-container: #410002;

  --outline: #7e7576;
  --outline-variant: #cfc4c5;
  --divider: rgba(0, 0, 0, 0.06);
}
```

### 6.3 语法阅读器适配 token

为了避免和 mockups 脱节，语法阅读器建议基于现有 token 增加 `--ag-*` 语义别名，而不是使用完全独立的颜色系统。

Light theme：

```css
:root {
  --ag-bg: var(--surface, #f9f9fb);
  --ag-reader-surface: var(--surface-container-lowest, #ffffff);
  --ag-reader-muted-surface: var(--surface-container-low, #f3f3f5);
  --ag-text: var(--on-surface, #1a1c1d);
  --ag-muted: var(--on-surface-variant, #4c4546);
  --ag-border: var(--outline-variant, #cfc4c5);
  --ag-divider: var(--divider, rgba(0, 0, 0, 0.06));

  --ag-primary: var(--primary, #000000);
  --ag-on-primary: var(--on-primary, #ffffff);
  --ag-accent: var(--tertiary, #0e6b4f);
  --ag-link: var(--primary, #000000);
  --ag-error: var(--error, #ba1a1a);

  --ag-note-bg: var(--surface-container-low, #f3f3f5);
  --ag-mark-bg: rgba(14, 107, 79, 0.08);
  --ag-mark-border: rgba(14, 107, 79, 0.35);
}
```

建议用途：

| Token | 用途 |
|---|---|
| `--ag-bg` | 页面整体背景 |
| `--ag-reader-surface` | 正文阅读卡片背景 |
| `--ag-text` | 正文主文字 |
| `--ag-muted` | 注释、meta、页脚、次级文字 |
| `--ag-border` | 卡片、表格、图片边框 |
| `--ag-primary` | 主要按钮、品牌标识、当前目录项 |
| `--ag-accent` | 当前命中、verified、重要语法提示 |
| `--ag-link` | 普通交叉引用链接 |
| `--ag-note-bg` | note、blockquote、脚注背景 |
| `--ag-mark-bg` | 命中词或引用高亮背景 |

### 6.4 推荐不要使用的颜色方向

初版不建议使用：

- 大面积米黄色 / 羊皮纸背景。
- 大面积深红作为章节标题色。
- 多彩标签系统。
- 高饱和蓝色链接。
- 和 mockups 中黑白灰 + 绿色语义系统冲突的独立配色。

如果需要更有“书籍感”，可以只在阅读正文中用极轻微的暖色倾向，例如 `#fffdf8`，但导航、按钮、drawer、popup 仍应使用 mockups 的 token。

---

## 7. 字体建议

### 7.1 正文字体

适合语法书、拉丁语例句和脚注：

```css
font-family:
  Georgia,
  "Times New Roman",
  "Noto Serif",
  serif;
```

### 7.2 UI 字体

适合导航栏、按钮、设置面板：

```css
font-family:
  Inter,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

---

## 8. 推荐扩展结构

```text
grammar-reader-extension/
  manifest.json
  content-script.js
  styles/
    reader.css
  assets/
    icons/
  popup/
    popup.html
    popup.js
    popup.css
```

---

## 9. Manifest 示例

```json
{
  "manifest_version": 3,
  "name": "Alpheios Grammar Reader",
  "version": "0.1.0",
  "description": "Modern reading layout for Alpheios grammar pages.",
  "permissions": ["storage"],
  "host_permissions": [
    "https://grammars.alpheios.net/allen-greenough/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://grammars.alpheios.net/allen-greenough/*"
      ],
      "js": ["content-script.js"],
      "css": ["styles/reader.css"],
      "run_at": "document_end"
    }
  ]
}
```

---

## 10. Content Script 示例

```js
(() => {
  const wrapper = document.getElementById('page-wrapper');
  if (!wrapper) return;

  document.documentElement.classList.add('ag-modern-reader');

  const oldCss = document.querySelector('link[href="site.css"]');
  oldCss?.remove();

  const nav = document.createElement('nav');
  nav.className = 'ag-reader-nav';
  nav.innerHTML = `
    <a class="ag-reader-nav__link" href="index.htm">Contents</a>
    <span class="ag-reader-nav__title">Allen & Greenough</span>
  `;

  document.body.insertBefore(nav, document.body.firstChild);

  enhanceTables();
  enhanceImages();
})();

function enhanceTables() {
  document.querySelectorAll('.table, table').forEach((node) => {
    if (node.closest('.ag-table-scroll')) return;

    const table = node.tagName === 'TABLE' ? node : node.querySelector('table');
    if (!table) return;

    const scroll = document.createElement('div');
    scroll.className = 'ag-table-scroll';

    node.parentNode.insertBefore(scroll, node);
    scroll.appendChild(node);
  });
}

function enhanceImages() {
  document.querySelectorAll('img').forEach((img) => {
    img.loading = 'lazy';
    img.decoding = 'async';
    img.classList.add('ag-readable-image');

    img.addEventListener('click', () => {
      window.open(img.src, '_blank', 'noopener,noreferrer');
    });
  });
}
```

---

## 11. Reader CSS 示例

```css
.ag-modern-reader body {
  margin: 0;
  background: var(--ag-bg, #f8f5ef);
  color: var(--ag-text, #1f2933);
  font-family: Georgia, "Times New Roman", serif;
}

.ag-modern-reader #page-wrapper {
  max-width: 760px;
  margin: 0 auto;
  padding: 48px 24px 80px;
  background: var(--ag-surface, #fffdf8);
  box-shadow: 0 12px 40px rgb(15 23 42 / 0.08);
}

.ag-modern-reader h2 {
  margin: 0 0 24px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--ag-border, #d8d0c2);
  color: var(--ag-accent, #8b1e1e);
  font-size: 1.75rem;
  line-height: 1.25;
  letter-spacing: 0.04em;
}

.ag-modern-reader h3 {
  margin-top: 36px;
  margin-bottom: 16px;
  color: #334155;
  font-size: 1.25rem;
}

.ag-modern-reader p {
  margin: 0 0 18px;
  font-size: 1.0625rem;
  line-height: 1.8;
}

.ag-modern-reader .foreign {
  font-style: italic;
  color: #111827;
}

.ag-modern-reader .gloss {
  font-style: italic;
  color: var(--ag-muted, #667085);
}

.ag-modern-reader .noteLabel {
  display: inline-block;
  margin-right: 4px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--ag-note-bg, #f1eadc);
  color: #7c2d12;
  font-size: 0.75rem;
  font-style: normal;
  vertical-align: baseline;
}

.ag-modern-reader a {
  color: var(--ag-link, #1d4ed8);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.ag-table-scroll {
  overflow-x: auto;
  margin: 24px 0;
}

.ag-modern-reader table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.ag-modern-reader td,
.ag-modern-reader th {
  padding: 10px 12px;
  border: 1px solid var(--ag-border, #d8d0c2);
  vertical-align: top;
}

.ag-modern-reader tr:nth-child(even) {
  background: #faf7f0;
}

.ag-modern-reader img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 24px auto;
  border: 1px solid var(--ag-border, #d8d0c2);
  border-radius: 8px;
  background: white;
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.12);
  cursor: zoom-in;
}

.ag-reader-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 24px;
  border-bottom: 1px solid var(--ag-border, #d8d0c2);
  background: color-mix(in srgb, var(--ag-bg, #f8f5ef) 92%, transparent);
  backdrop-filter: blur(8px);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.ag-reader-nav__title {
  color: var(--ag-muted, #667085);
  font-size: 0.875rem;
}

.ag-modern-reader [id] {
  scroll-margin-top: 72px;
}

@media (max-width: 640px) {
  .ag-modern-reader #page-wrapper {
    max-width: none;
    margin: 0;
    padding: 24px 18px 64px;
    box-shadow: none;
  }

  .ag-modern-reader p {
    font-size: 1rem;
    line-height: 1.75;
    text-align: left;
  }

  .ag-reader-nav {
    padding: 10px 16px;
  }
}
```

---

## 12. 分阶段实施计划

### 阶段 1：基础阅读体验

优先实现：

1. 创建 Manifest V3 扩展。
2. content script 匹配 `https://grammars.alpheios.net/allen-greenough/*`。
3. 注入本地 `reader.css`。
4. 覆盖或移除旧 `site.css`。
5. 优化正文宽度、字号、行距。
6. 优化标题层级。
7. 优化链接、表格、图片。
8. 保留原始锚点和交叉引用。

### 阶段 2：阅读增强

建议实现：

1. sticky 顶部导航栏。
2. 返回目录按钮。
3. 明暗主题切换。
4. 字号调节。
5. 图片点击放大。
6. 脚注 tooltip 或弹层预览。
7. 当前页面标题目录。
8. 滚动进度条。

### 阶段 3：学习工具化

后续可选：

1. 全文搜索。
2. 章节收藏。
3. 最近阅读位置恢复。
4. 交叉引用预览。
5. 语法条目索引。
6. 拉丁词高亮。
7. 用户笔记。

---

## 13. 可访问性和 UX 注意事项

实现时需要注意：

- 正文对比度至少满足 WCAG AA。
- 链接需要可见 hover 和 focus 状态。
- 不要移除浏览器默认 focus ring，除非提供替代样式。
- 移动端正文不建议使用 `text-align: justify`。
- 表格需要横向滚动容器，避免撑破视口。
- 图片应设置 `max-width: 100%` 和 `height: auto`。
- 锚点跳转需要 `scroll-margin-top`，避免被 sticky nav 遮挡。
- 字号不应低于 16px。
- 暗色模式需要单独检查文本、链接、边框、表格对比度。

---

## 14. 后续 React/Vue 组件化方向

如果后续需要把扩展升级为完整阅读器，可以将原始 HTML 解析为内容模型：

```ts
export type GrammarPage = {
  title: string;
  sections: GrammarSection[];
  footnotes: Footnote[];
};

export type GrammarSection = {
  id?: string;
  heading: string;
  blocks: GrammarBlock[];
};

export type GrammarBlock =
  | { type: 'paragraph'; html: string }
  | { type: 'table'; html: string }
  | { type: 'image'; src: string; alt?: string }
  | { type: 'list'; html: string };

export type Footnote = {
  id: string;
  html: string;
};
```

升级流程：

```text
fetch 原始 HTML
  ↓
DOMParser 解析
  ↓
提取 #page-wrapper
  ↓
转换为 GrammarPage 内容模型
  ↓
React/Vue 组件渲染
```

该方向适合实现搜索、收藏、笔记、交叉引用预览等高级功能。

---

## 15. 最终建议

第一版建议保持简单：

```text
Content Script
+ Local Reader CSS
+ Minimal DOM Enhancement
```

不要一开始就重写为 React/Vue。

优先把原页面改造成现代阅读体验，再根据实际使用需求逐步增强。

推荐实施顺序：

1. 完成基础 CSS 重排。
2. 修正移动端阅读体验。
3. 增强表格和图片。
4. 增加顶部导航。
5. 增加主题和字号设置。
6. 再考虑组件化和搜索功能。
