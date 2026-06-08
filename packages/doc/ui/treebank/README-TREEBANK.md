# Treebank 原生SVG渲染器 POC

## 概述

本POC实现了Perseus Treebank数据的原生SVG依存句法树渲染器，用于Alpheios Web扩展。

## 架构

### 核心组件

1. **DependencyTree.vue** (`src/primitives/DependencyTree.vue`)
   - 原生SVG渲染器
   - 基于预计算布局数据绘制依存树
   - 支持token交互、高亮、词性筛选

2. **treebank-layout.js** (`src/lib/treebank-layout.js`)
   - 树形布局算法
   - 计算token位置、弧线路径、层级
   - 输出纯数据（x/y坐标、路径D值）

3. **TreebankPage.vue** (`src/pages/TreebankPage.vue`)
   - 完整的treebank浏览页面
   - 句子导航（上一句/下一句）
   - 词性过滤器
   - 底部元信息展示

4. **treebank-loader.js** (`src/lib/treebank-loader.js`)
   - 数据加载抽象层
   - 支持三种模式：embedded / cdn / api
   - 缓存管理

5. **treebank-data.js** (`src/lib/treebank-data.js`)
   - 数据查找和资源构建工具
   - 标准化docId处理

### 数据流

```
Perseus AGLDT XML (v2.1)
    ↓ (aldt-to-treebank.mjs 清洗)
JSON格式 { nodes[], edges[] }
    ↓ (treebank-loader.js 加载)
TreebankSentence对象
    ↓ (treebank-layout.js 布局)
Layout数据 { tokens[], arcs[], width, height }
    ↓ (DependencyTree.vue 渲染)
SVG DOM
```

## 数据加载方案

由于完整数据集约185MB（38,409句），不适合打包在扩展内，采用分层加载策略：

### 1. Embedded模式（默认）
- 精选小型文本打包在扩展内（如Vergil Aeneid 6.1示例）
- 用于演示和离线查看
- 数据存储：`src/fixtures/treebank-*.json`

### 2. CDN模式（推荐）
- 将清洗后的JSON按文本分割，托管在CDN
- 按需加载，首次访问时下载并缓存
- CDN结构：
  ```
  https://cdn.alpheios.net/treebank/v2.1/
    ├── latin/
    │   ├── phi0690.phi003.json  (Vergil Aeneid, 811KB)
    │   ├── phi0972.phi001.json  (Ovid, 4MB)
    │   └── ...
    └── greek/
        ├── tlg0012.tlg001.json  (Homer Iliad, 24MB)
        ├── tlg0012.tlg002.json  (Homer Odyssey, 19MB)
        └── ...
  ```

### 3. API模式（未来扩展）
- 按需查询单个句子（适合移动端或带宽受限环境）
- API端点：`https://api.alpheios.net/treebank/v2.1/sentence?doc={docId}&id={sentenceId}`
- 不支持全文加载，仅按需

### 配置优先级
```
auto模式: embedded → cdn → api
```

## 数据清洗

### 运行清洗脚本

```bash
cd perseus_treebankdata/cleaning

# 清洗所有希腊文本
node aldt-to-treebank.mjs ../v2.1/Greek/texts/

# 清洗所有拉丁文本
node aldt-to-treebank.mjs ../v2.1/Latin/texts/

# 输出位置：./out/greek/ 和 ./out/latin/
```

### 清洗结果统计

- **希腊语**: 33个文件 → 33,511句（162MB）
- **拉丁语**: 12个文件 → 4,898句（23MB）
- **总计**: 38,409句（185MB）

### 数据质量

- 自动排除了82个有结构问题的句子（self-loop或cycle）
- 自动修复了6个missing-head问题
- 所有保留的句子都通过了树形结构不变性检查

## 部署到CDN

### 方案A：GitHub Pages（免费）

```bash
# 1. 创建独立仓库 alpheios-treebank-data
# 2. 复制清洗后的数据
cp -r perseus_treebankdata/cleaning/out/* alpheios-treebank-data/v2.1/

# 3. 启用GitHub Pages，设置CORS
# 4. 访问地址：https://alpheios.github.io/alpheios-treebank-data/v2.1/
```

### 方案B：专用CDN（Cloudflare/jsDelivr）

```bash
# 通过npm包发布到jsDelivr
# 访问地址：https://cdn.jsdelivr.net/npm/@alpheios/treebank-data@2.1/
```

### 方案C：对象存储（S3/R2）

```bash
# 上传到S3，配置CloudFront分发
# 设置CORS头和缓存策略
```

## 使用示例

### 基础用法

```vue
<script setup>
import DependencyTree from '@alpheios/components-v3/primitives/DependencyTree.vue'
import { loadTreebankData } from '@alpheios/components-v3/lib/treebank-loader.js'

const sentence = await loadTreebankData({
  docId: 'phi0690.phi003.perseus-lat1',
  sentenceId: '1',
  mode: 'auto'
})
</script>

<template>
  <DependencyTree
    :nodes="sentence.nodes"
    :edges="sentence.edges"
    :highlight-ids="[2, 7]"
    @select="handleTokenClick"
  />
</template>
```

### 完整页面

```vue
<script setup>
import TreebankPage from '@alpheios/components-v3/pages/TreebankPage.vue'
</script>

<template>
  <TreebankPage
    doc-id="phi0690.phi003.perseus-lat1"
    sentence-id="1"
    :word-ids="[2]"
    @token-select="handleSelect"
  />
</template>
```

## 开发和测试

### 启动开发服务器

```bash
cd alpheios_alpheios-core/packages/components-v3
npm run dev
```

访问 `http://localhost:5173` 查看Sandbox演示。

### 构建

```bash
npm run build
```

输出到 `dist/`，包含：
- `components-v3.js` - ES模块
- `components-v3.umd.cjs` - UMD格式
- `style.css` - 样式

### 测试

```bash
npm test
```

运行单元测试：
- `tests/treebank-layout.test.js`
- `tests/treebank-data.test.js`
- `tests/treebank-pos.test.js`

## 集成到Webextension

### 1. 更新依赖

在 `alpheios_webextension/package.json` 中：

```json
{
  "dependencies": {
    "alpheios-components-v3": "file:../alpheios_alpheios-core/packages/components-v3"
  }
}
```

### 2. 导入组件

```js
import TreebankPage from 'alpheios-components-v3/pages/TreebankPage.vue'
import 'alpheios-components-v3/style.css'
```

### 3. 配置CDN base URL

在扩展初始化时：

```js
// 设置CDN地址
window.ALPHEIOS_TREEBANK_CDN = 'https://cdn.alpheios.net/treebank/v2.1'
```

### 4. 打包fixture数据

只打包精选示例（<1MB）：

```js
// webpack.config.mjs
export default {
  resolve: {
    alias: {
      '@fixtures': path.resolve(__dirname, '../alpheios_alpheios-core/packages/components-v3/src/fixtures')
    }
  }
}
```

## 性能优化

### 1. 虚拟滚动（大文本）

对于超过1000句的文本（如Homer Iliad 8408句），考虑实现虚拟滚动：

```js
// 仅渲染可见范围±缓冲区的句子
const visibleRange = computed(() => {
  const start = Math.max(0, currentIndex.value - 10)
  const end = Math.min(sentences.value.length, currentIndex.value + 10)
  return { start, end }
})
```

### 2. Web Worker解析

将layout计算移到Worker：

```js
// treebank-worker.js
self.addEventListener('message', ({ data }) => {
  const layout = layoutDependencyTree(data.tree, data.options)
  self.postMessage(layout)
})
```

### 3. IndexedDB缓存

缓存CDN数据到本地：

```js
const db = await openDB('alpheios-treebank', 1, {
  upgrade(db) {
    db.createObjectStore('sentences', { keyPath: 'docId' })
  }
})

await db.put('sentences', { docId, sentences })
```

## 数据Schema

详见 `packages/doc/ui/treebank/treebank-sentence.schema.json`

核心结构：

```typescript
interface TreebankSentence {
  id: string              // 句子ID
  index: number           // 1-based序号
  total: number           // 文本总句数
  docId: string           // CTS URN
  cite: string            // 引用标识，如 "6.1"
  text: string            // 纯文本
  provider: string        // 数据来源
  version: string         // 版本号
  nodes: TreebankNode[]   // 词节点
  edges: TreebankEdge[]   // 依存弧
}

interface TreebankNode {
  id: number              // 词ID（0为虚拟根）
  form: string            // 词形
  lemma?: string          // 词源
  pos: string             // 词性（UD UPOS）
  morph?: string          // 形态特征
  label?: string          // 组合标签
  isRoot: boolean         // 是否虚拟根
  artificial?: boolean    // 是否人工节点
}

interface TreebankEdge {
  from: number            // 支配词ID
  to: number              // 依存词ID
  relation: string        // 依存关系
}
```

## 后续计划

### 短期（POC完成）
- [x] 原生SVG渲染器
- [x] 布局算法
- [x] 数据清洗脚本
- [x] 数据加载器
- [x] TreebankPage完整页面
- [ ] 部署示例数据到CDN
- [ ] 集成到webextension构建

### 中期（生产就绪）
- [ ] 单元测试覆盖
- [ ] 词形标注hover tooltip
- [ ] 导出为PNG/SVG
- [ ] 键盘导航（←/→切换句子）
- [ ] 深链接支持（URL参数）

### 长期（高级功能）
- [ ] 并列结构可视化增强
- [ ] 句法树编辑器（标注工具）
- [ ] 跨句子搜索（词性模式）
- [ ] 统计分析面板

## 许可证

- 代码：MIT License
- Perseus Treebank数据：CC BY-SA 3.0 US

## 联系方式

技术问题请提交issue到 `alpheios/alpheios-core`
