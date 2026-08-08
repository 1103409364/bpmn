# BPMN 流程引擎页面

基于 Vue 3 + Vite + bpmn-js 的流程设计器页面，内置属性面板，支持流程图的创建、编辑、保存与导出。

## 技术栈

- [Vue 3](https://vuejs.org/) + `<script setup>` 语法
- [Vite](https://vite.dev/) 构建工具
- [bpmn-js](https://bpmn.io/toolkit/bpmn-js/) BPMN 2.0 渲染与建模
- [bpmn-js-properties-panel](https://github.com/bpmn-io/bpmn-js-properties-panel) 元素属性面板
- [camunda-bpmn-moddle](https://github.com/camunda/camunda-bpmn-moddle) Camunda 扩展模型定义
- [diagram-js-accordion-palette](https://github.com/miyuesc/diagram-js-accordion-palette) 可折叠展开的左侧工具栏
- [bpmn-js-i18n-zh](https://github.com/miyuesc/bpmn-js-i18n-zh) bpmn-js 中文本地化资源

## 快速开始

```bash
npm install       # 安装依赖
npm run dev       # 启动开发服务器 http://localhost:5173
npm run build     # 生产构建
npm run preview   # 预览生产构建
```

## 项目结构

```txt
bpmn/
├── index.html                     # 入口 HTML
├── package.json
├── vite.config.js                 # Vite 配置（含 .bpmn 文件 raw 导入支持）
└── src/
    ├── main.js                    # 应用入口
    ├── App.vue                    # 主页面：加载流程、保存提示、toast 通知
    ├── assets/
    │   └── bpmn/
    │       └── initial.bpmn       # 示例流程 XML（请假审批流程）
    └── components/
        ├── BpmnModeler.vue        # 核心流程设计器组件
        ├── palette/
        │   ├── index.js           # 自定义 palette 模块（DI 定义）
        │   └── CustomPaletteProvider.js  # 扩展默认工具栏的自定义条目
        └── i18n/
            ├── index.js           # translate 模块（DI 定义）
            └── customTranslate.js # 中文翻译资源合并与覆盖
```

## 核心组件

### `BpmnModeler.vue`

流程设计器核心组件，封装了 bpmn-js Modeler，提供：

| 功能 | 说明 |
| --- | --- |
| 属性面板 | 选中元素后可编辑其 Camunda 扩展属性 |
| 撤销 / 重做 | 通过 `commandStack` 实现，状态实时刷新 |
| 缩放 | 放大、缩小、适应窗口 |
| 保存 | 导出格式化 XML，通过 `saved` 事件回传 |
| 下载 | 导出 `.bpmn`（XML）或 `.svg` 文件 |
| 选中联动 | 显示当前选中元素的 id 与类型 |

#### Props

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `xml` | `String` | `''` | 要加载的 BPMN XML；为空时加载示例流程 |
| `title` | `String` | `''` | 设计器顶部标题 |

#### Events

| Event | 说明 |
| --- | --- |
| `saved` | 点击保存后触发，参数为格式化后的 XML |
| `command-stack-changed` | 画布内容变更时触发 |

#### Exposed 方法

| 方法 | 说明 |
| --- | --- |
| `save()` | 保存当前流程，返回 XML |
| `download(type)` | 下载文件，`type` 为 `'xml'` 或 `'svg'` |
| `getXml()` | 获取已保存的 XML 字符串 |
| `undo()` / `redo()` | 撤销 / 重做 |

### `App.vue`

页面外壳，通过 `xml` prop 将示例流程传入设计器，监听 `saved` 事件展示保存提示与流程大小信息。

## 示例流程

`src/assets/bpmn/initial.bpmn` 内置了一个完整的「请假审批流程」示例，包含：

- 开始 / 结束事件
- 用户任务（提交申请、重新修改）
- 排他网关（审批通过？）
- 带条件表达式的顺序流（`${approved}`）

## 自定义流程

传入自定义 XML 即可加载自己的流程：

```vue
<BpmnModeler :xml="myBpmnXml" title="我的流程" />
```

## 左侧工具栏（palette）

使用 [diagram-js-accordion-palette](https://github.com/miyuesc/diagram-js-accordion-palette) 替换默认 palette，支持按分组折叠 / 展开，并显示工具名称。

### 分组构成

每个条目通过 `group` 属性归属到某个分组，分组标题（`<summary>`）由 `translate(entry.group)` 渲染：

| 分组 | 名称 | 来源 |
| --- | --- | --- |
| `tools` | 工具 | bpmn-js 默认（抓手 / 框选 / 空间 / 全局连接） |
| `event` | 事件 | bpmn-js 默认 |
| `gateway` | 网关 | bpmn-js 默认 |
| `activity` | 活动 | bpmn-js 默认 |
| `data-object` | 数据对象 | bpmn-js 默认 |
| `data-store` | 数据存储 | bpmn-js 默认 |
| `collaboration` | 协作 | bpmn-js 默认 |
| `artifact` | 工件 | bpmn-js 默认 |
| `custom` | 自定义 | `src/components/palette/CustomPaletteProvider.js` |

### 修改分组

#### 1. 修改分组显示名称

分组标题对应 `translate(entry.group)`，在 `src/components/i18n/customTranslate.js` 的覆盖区增加 key 即可（优先于第三方翻译资源）：

```js
const zhCN = {
  // ...第三方资源
  'tools': '工具栏',
  'activity': '节点',
  'custom': '我的工具'
}
```

#### 2. 移动条目到其他分组 / 新建分组

修改条目上的 `group` 属性（`src/components/palette/CustomPaletteProvider.js`）：

```js
// 把用户任务并入默认"活动"组，与通用任务并列
'create.user-task': createAction('bpmn:UserTask', 'activity', 'bpmn-icon-user-task', translate('创建用户任务')),

// 或单独开一个分组（需在 customTranslate.js 补充分组名，如 'custom-node': '自定义节点'）
'create.script-task': createAction('bpmn:ScriptTask', 'custom-node', 'bpmn-icon-script-task', translate('创建脚本任务')),
```

> 分组渲染顺序 = 条目首次出现顺序；`separator` 类型条目在手风琴 palette 中会被跳过，无需保留。

#### 3. 修改默认展开的分组

`BpmnModeler.vue` 的 `accordionPalette.defaultOpenGroups`：

```js
accordionPalette: {
  showName: true,
  accordion: false, // 手风琴模式与 defaultOpenGroups 互斥，需保持关闭
  defaultOpenGroups: ['tools', 'event', 'custom']
}
```

#### 4. 删除 / 重排默认条目

默认条目定义在 bpmn-js 的 `PaletteProvider`（node_modules 内），需继承它并覆盖 `getPaletteEntries()`：先调用 `super` 拿到默认条目，再删除或重排键顺序（键顺序即分组与条目顺序）：

```js
import PaletteProvider from 'bpmn-js/lib/features/palette/PaletteProvider'

export default function CustomPaletteProvider(palette, create, elementFactory,
    spaceTool, lassoTool, handTool, globalConnect, translate) {
  PaletteProvider.call(this, palette, create, elementFactory,
    spaceTool, lassoTool, handTool, globalConnect, translate)
  palette.registerProvider(this)
}

CustomPaletteProvider.prototype.getPaletteEntries = function () {
  const entries = PaletteProvider.prototype.getPaletteEntries.call(this)
  delete entries['create.data-object']   // 删除数据对象
  delete entries['create.group']         // 删除分组
  // 重排键顺序即可调整分组顺序
  return entries
}
```

## 常见问题

- **属性面板不生效**：bpmn-js-properties-panel v5 的样式已内嵌在 JS 中，无需额外引入 CSS 文件。
- **`.bpmn` 文件解析报错**：需要在 `vite.config.js` 中配置 `assetsInclude: ['**/*.bpmn']`，并以 `?raw` 后缀引入，确保 XML 以文本形式加载。
