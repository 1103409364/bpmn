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
- [diagram-js-grid](https://github.com/bpmn-io/diagram-js-grid) 画布网格显示

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
        ├── properties/
        │   └── PropertyPanel.vue   # 元素属性编辑面板
        ├── palette/
        │   ├── index.js           # 自定义 palette 模块（DI 定义）
        │   └── CustomPaletteProvider.js  # 扩展默认工具栏的自定义条目
        └── i18n/
            ├── index.js           # translate 模块（DI 定义）
            └── customTranslate.js # 中文翻译资源合并与覆盖
```

## 核心组件

### BpmnModeler.vue

流程设计器核心组件，封装了 bpmn-js Modeler，提供完整的流程设计与编辑能力。

**功能特性：**

| 功能 | 说明 |
| --- | --- |
| 属性面板 | 选中元素后可编辑其 Camunda 扩展属性和自定义任务属性 |
| 撤销 / 重做 | 通过 `commandStack` 实现，状态实时刷新 |
| 缩放 & 视图 | 放大、缩小、适应窗口、手风琴式工具栏 |
| 保存 & 导出 | 导出格式化 XML 或 SVG，通过 `saved` 事件回传完整 formBean |
| 选中联动 | 显示当前选中元素的 id、类型、属性 |
| 网格显示 | 画布上的点状网格，便于元素对齐 |

**Props：**

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `xml` | `String` | `''` | 要加载的 BPMN XML；为空时加载示例流程 |
| `title` | `String` | `''` | 设计器顶部标题 |
| `formData` | `Object` | `{}` | 流程表单元数据（workflowCode、workflowName 等）；支持 `v-model:form-data` 双向绑定 |

**Events：**

| Event | 说明 |
| --- | --- |
| `saved` | 点击保存后触发，参数为完整的 `formBean` 对象（包含 bpmn、taskInfo、表单数据） |
| `command-stack-changed` | 画布内容变更时触发 |
| `update:formData` | 表单元数据变更时触发（支持 v-model 双向绑定） |

**Exposed 方法：**

| 方法 | 说明 |
| --- | --- |
| `save()` | 保存当前流程，返回完整的 formBean |
| `download(type)` | 下载文件，`type` 为 `'xml'` 或 `'svg'` |
| `getXml()` | 获取已保存的 XML 字符串 |
| `getTaskInfo()` | 获取所有节点的自定义属性 (taskInfo 数组) |
| `undo()` / `redo()` | 撤销 / 重做 |

### PropertyPanel.vue

右侧属性编辑面板，包含两种编辑模式：

- **未选中元素时**：编辑流程表单元数据（workflowCode、workflowName、workflowType、publishedFlag 等）
- **选中元素时**：编辑该元素的自定义属性（progressBarName、executeType、taskType、handleStrategy 等）

自定义属性仅保存在内存中（taskInfo 数组），不会写入 BPMN XML；标准 `name` 属性会同步回 businessObject 并随 XML 保存。

### App.vue

页面外壳和数据管理层：

- 通过 `v-model:form-data` 双向绑定流程表单元数据
- 监听 `saved` 事件获取完整的 formBean（bpmn XML + taskInfo + 表单数据）
- 监听 `command-stack-changed` 提醒用户保存变更
- 显示保存成功提示与流程大小信息（KB 单位）
- 提供全局样式和过渡动画

## 数据流与持久化

### 三层数据模型

1. **BPMN XML**：标准 BPMN 2.0 流程定义，包含所有标准元素、属性、条件表达式等
2. **taskInfo 数组**：内存中的自定义任务属性集合（与元素 id 关联），保存时序列化为 JSON 字符串
3. **formData 对象**：流程表单元数据（workflowCode、workflowName、workflowType、publishedFlag 等）

### 保存流程

点击保存按钮后，设计器会生成并返回 formBean 对象：

```javascript
{
  bpmn: "<?xml version='1.0' encoding='UTF-8'?><bpmn2:definitions...>", // 格式化后的 BPMN XML
  taskInfo: "[{id: 'UserTask_1', progressBarName: '...', executeType: '...'}, ...]", // JSON 字符串
  workflowCode: "DEMO",
  workflowName: "请假审批流程",
  workflowType: "W",
  publishedFlag: "1"
  // 其他 formData 中定义的字段
}
```

父组件可通过监听 `saved` 事件获取 formBean，然后上传到数据库。

## 示例流程

`src/assets/bpmn/initial.bpmn` 内置了一个完整的「请假审批流程」示例，包含：

- **开始 / 结束事件**：流程的入口和出口
- **用户任务**：提交申请、重新修改（分配给指定人员或部门）
- **排他网关**：条件分支（审批通过？）
- **条件表达式**：顺序流上的 `${approved}` 判断逻辑

可直接在页面加载此流程进行编辑和测试。

## 自定义流程

### 加载流程

通过 `xml` prop 传入自定义 BPMN XML 字符串：

```vue
<script setup>
import { ref } from 'vue'
import BpmnModeler from './components/BpmnModeler.vue'
import customXml from './flows/my-process.bpmn?raw'

const formData = ref({
  workflowCode: 'MY_PROCESS',
  workflowName: '我的流程',
  workflowType: 'W',
  publishedFlag: '1'
})

function handleSaved(formBean) {
  console.log('保存的流程数据：', formBean)
  // 上传到数据库
}
</script>

<template>
  <BpmnModeler
    :xml="customXml"
    title="我的流程"
    v-model:form-data="formData"
    @saved="handleSaved"
  />
</template>
```

### 自定义工具栏

在 [src/components/palette/CustomPaletteProvider.js](src/components/palette/CustomPaletteProvider.js) 中定义自定义工具条目。

**添加创建元素工具：**

```javascript
// 在 getPaletteEntries 函数的返回对象中添加
'create.custom-task': createAction(
  'bpmn:UserTask',              // BPMN 元素类型
  'custom',                     // 分组名（显示在工具栏中）
  'bpmn-icon-user-task',        // CSS 类名（显示图标）
  translate('创建自定义任务')    // 悬停提示（已翻译）
)
```

**添加自定义动作工具：**

```javascript
'custom.export-data': {
  group: 'custom',
  className: 'bpmn-icon-trash',
  title: translate('导出流程数据'),
  action: {
    click: function () {
      // 你的导出逻辑
      console.log('导出流程')
    }
  }
}
```

**图标来源：**

- **bpmn-js 内置图标**：`bpmn-icon-user-task`、`bpmn-icon-service-task`、`bpmn-icon-script-task` 等（推荐用于标准 BPMN 元素）
- **自定义 CSS 类**：在全局 CSS 中定义，引用 SVG 或背景图片
- **Emoji / Unicode**：通过 CSS `::before` 伪元素插入符号
- **Font Icon**：FontAwesome、iconfont 等图标库

### 自定义任务属性

在 PropertyPanel 中添加新的任务属性字段，对应 taskInfo 数组中的元素。自定义属性可用于工作流引擎的业务逻辑处理，保存时会被序列化到 formBean 的 taskInfo 字段中。

**示例：**

```javascript
// taskInfo 数组中的元素结构
{
  id: 'UserTask_1',
  name: '提交申请',                    // 标准属性，会同步到 BPMN XML
  progressBarName: '审批进度',         // 自定义属性
  executeType: 'serial',              // 自定义属性
  taskType: 'user-defined',           // 自定义属性
  handleStrategy: 'auto-approve'      // 自定义属性
}
```

## 工具栏（Palette）

使用 [diagram-js-accordion-palette](https://github.com/miyuesc/diagram-js-accordion-palette) 替换默认 palette，支持按分组折叠 / 展开。

**默认分组：**

| 分组 | 名称 | 来源 |
| --- | --- | --- |
| `tools` | 工具 | bpmn-js 默认 |
| `event` | 事件 | bpmn-js 默认 |
| `gateway` | 网关 | bpmn-js 默认 |
| `activity` | 活动 | bpmn-js 默认 |
| `data-object` | 数据对象 | bpmn-js 默认 |
| `data-store` | 数据存储 | bpmn-js 默认 |
| `collaboration` | 协作 | bpmn-js 默认 |
| `artifact` | 工件 | bpmn-js 默认 |
| `custom` | 自定义 | `CustomPaletteProvider.js` |

**修改分组显示名称：**

编辑 `src/components/i18n/customTranslate.js`：

```javascript
const zhCN = {
  // ...
  'tools': '工具栏',
  'activity': '节点',
  'custom': '我的工具'
}
```

**修改默认展开的分组：**

在 `BpmnModeler.vue` 中修改 `accordionPalette` 配置：

```javascript
accordionPalette: {
  showName: false,                    // 是否显示工具名称
  accordion: false,                   // 是否启用手风琴模式（true 时只能展开一个分组）
  defaultOpenGroups: ['default', 'custom']  // 默认展开的分组
}
```

## 常见问题

### Q: 如何加载我自己的 BPMN 流程？

A: 将你的 BPMN XML 文件放在 `src/assets/bpmn/` 目录下，然后在 `App.vue` 中使用 `?raw` 导入：

```javascript
import myXml from './assets/bpmn/my-flow.bpmn?raw'

// 然后传入 BpmnModeler 组件
<BpmnModeler :xml="myXml" />
```

### Q: 自定义属性保存到哪里？

A: 自定义属性保存在 taskInfo 数组中（内存）并序列化为 JSON 字符串，传回给父组件，由你决定是否上传数据库。标准 BPMN 属性（如元素名称、类型）会同步写入 XML 中。

### Q: 如何获取保存后的流程数据？

A: 监听 `saved` 事件，回调函数会收到 formBean 对象：

```javascript
function onSaved(formBean) {
  console.log('BPMN XML:', formBean.bpmn)
  console.log('任务信息:', formBean.taskInfo)
  console.log('表单数据:', formBean.workflowCode, formBean.workflowName)
}
```

### Q: 如何添加新的工具到工具栏？

A: 编辑 `src/components/palette/CustomPaletteProvider.js`，在 `getPaletteEntries` 函数返回的对象中添加新条目（参考本文档的"自定义工具栏"部分）。

### Q: 如何修改工具栏图标？

A: 通过 `createAction` 函数的第三个参数 `className` 修改，支持 bpmn-js 内置图标类、自定义 CSS 类或 Font Icon。

### Q: 中文翻译在哪里修改？

A: 编辑 `src/components/i18n/customTranslate.js`，在 `zhCN` 对象中添加或覆盖翻译。

### Q: 属性面板不生效？

A: bpmn-js-properties-panel v5 的样式已内嵌在 JS 中，无需额外引入 CSS 文件。

### Q: `.bpmn` 文件解析报错？

A: 需要在 `vite.config.js` 中配置 `assetsInclude: ['**/*.bpmn']`，并以 `?raw` 后缀引入，确保 XML 以文本形式加载。

## 开发指南

### 项目依赖的动态加载

`BpmnModeler.vue` 在初始化时使用 `await import()` 动态加载较大的包（如 camunda-bpmn-moddle、diagram-js-accordion-palette），以减小首屏体积。如需修改这些包的版本或功能，请在 `initModeler()` 函数中相应调整。

### Vite 配置

`vite.config.js` 配置了 `.bpmn` 文件的 raw 导入支持，使得 BPMN XML 可以作为纯文本字符串导入，而不经过打包处理。这是为了方便流程文件的管理和版本控制。

### 依赖注入架构

bpmn-js 内部使用了依赖注入 (IoC) 架构。所有功能（canvas、eventBus、selection 等）都以 service 的形式注册，可通过 `modeler.get('serviceId')` 获取。自定义模块（paletteModule、translateModule 等）通过 `additionalModules` 参数注入，遵循相同的 DI 模式。

## License

MIT
