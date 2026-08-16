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
        ├── behavior/
        │   ├── index.js                     # 默认创建行为模块（DI 定义）
        │   └── DefaultCreateBehavior.js     # 新建元素时写入默认属性（如 StartEvent 默认名）
        ├── palette/
        │   ├── index.js                   # 自定义 palette 模块（DI 定义）
        │   ├── CustomPaletteProvider.js   # 扩展默认工具栏的自定义条目
        │   ├── CustomElementsProvider.js  # 自定义元素引导模块（挂载 Vue 面板到持久宿主）
        │   ├── CustomElementsPanel.vue    # 自定义元素面板（声明式：接口请求 / 搜索 / 分组 / 分页）
        │   ├── PaletteToolbar.vue         # 工具栏收起 / 展开（声明式）
        │   └── pagination.css             # 分页条 / 搜索框 / 状态提示样式
        ├── api/
        │   └── customElements.js  # 自定义元素 API 适配层（含 mock 示例）
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
| 未保存提醒 | 工具栏保存按钮显示脏标记圆点，提示存在未保存的修改（详见"未保存修改检测"一节） |
| 选中联动 | 显示当前选中元素的 id、类型、属性 |
| 网格显示 | 画布上的点状网格，便于元素对齐 |
| 只读预览 | 一键切换到只读预览，画布不可编辑（详见"只读预览"一节） |

**Props：**

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `xml` | `String` | `''` | 要加载的 BPMN XML；为空时加载示例流程 |
| `title` | `String` | `''` | 设计器顶部标题 |
| `formData` | `Object` | `{}` | 流程表单元数据（workflowCode、workflowName 等）；支持 `v-model:form-data` 双向绑定 |

**Events：**

| Event | 说明 |
| --- | --- |
| `saved` | 保存完成通知（无参数），完整数据已通过 `update:formData` 同步给父组件 |
| `update:formData` | formBean / 表单元数据变更时触发（支持 v-model 双向绑定） |

**Exposed 方法：**

| 方法 | 说明 |
| --- | --- |
| `save(extra)` | 保存当前流程，序列化 XML 并通过 `v-model:form-data` 同步完整 formBean |
| `getFormBean(extra)` | 不触发保存，直接返回当前状态的 formBean |
| `getXml()` | 获取最近一次序列化的 XML 字符串 |
| `taskInfo` | 节点属性数组（ref，唯一数据源） |
| `download(type)` | 下载文件，`type` 为 `'xml'` 或 `'svg'` |
| `undo()` / `redo()` | 撤销 / 重做 |
| `autoLayout()` | 对流程自动排版并重新导入画布 |

### PropertyPanel.vue

右侧属性编辑面板，包含两种编辑模式：

- **未选中元素时**：编辑流程表单元数据（workflowCode、workflowName、workflowType、publishedFlag 等）
- **选中元素时**：编辑该元素的自定义属性（xxx、executeType、taskType、handleStrategy 等）

自定义属性仅保存在内存中（taskInfo 数组），不会写入 BPMN XML；标准 `name` 属性会同步回 businessObject 并随 XML 保存。

### App.vue

页面外壳和数据管理层：

- 通过 `v-model:form-data` 双向绑定流程表单元数据
- 监听 `saved` 事件获取完整的 formBean（bpmn XML + taskInfo + 表单数据）
- 未保存修改的提醒由设计器工具栏的"脏标记圆点"承担（见"未保存修改检测"一节）
- 显示保存成功提示与流程大小信息（KB 单位）
- 提供全局样式和过渡动画

## 数据流与持久化

### 三层数据模型

1. **BPMN XML**：标准 BPMN 2.0 流程定义，包含所有标准元素、属性、条件表达式等
2. **taskInfo 数组**：内存中的自定义任务属性集合（与元素 id 关联），以数组类型随 formData 同步
3. **formData 对象**：流程表单元数据（workflowCode、workflowName、workflowType、publishedFlag 等）

### 保存流程

点击保存按钮后，设计器会生成并返回 formBean 对象：

```javascript
{
  bpmn: "<?xml version='1.0' encoding='UTF-8'?><bpmn2:definitions...>", // 格式化后的 BPMN XML
  taskInfo: [{ id: 'UserTask_1', xxx: '...', executeType: '...' }, ...], // 节点属性数组
  workflowCode: "DEMO",
  workflowName: "请假审批流程",
  workflowType: "W",
  publishedFlag: "1"
  // 其他 formData 中定义的字段
}
```

父组件可通过监听 `saved` 事件获取 formBean，然后上传到数据库。

## 属性面板与流程图画布同步机制

属性面板（PropertyPanel）与 bpmn-js 画布通过 `taskInfo` 数组 + `activeElement` 两个核心数据源联动：

### 数据源约定

- **taskInfo 数组**：节点属性的唯一数据源，元素通过 `id + $type` 与画布元素一一对应
- **activeElement**：当前选中的 bpmn-js 元素（`shallowRef`，详见"注意事项"）
- **formData 对象**：未选中节点时编辑的流程表单元数据

### 同步流程

```txt
① 选中联动
[画布节点] ──click──> selection.changed ──> activeElement = newSelection[0]
                                                  │
② 属性编辑                                         ▼
[属性面板 input] ──@input──> emit('change', { key, value }) ──> onTaskInfoChange
                                                                     │
                        ┌────────────────────────────────────────────┘
                        ▼
            entry[key] = value        （taskInfo 内存同步，画布即时响应）
                        │
                        └── key === 'name' ?
                            ├─ 否：仅存内存，不写 XML
                            └─ 是：modeling.updateProperties(element, { name })
                                      │
                                      ├─> LabelBehavior.updateLabel ──> 画布节点标签刷新
                                      ├─> 进入 commandStack（支持撤销/重做）
                                      └─> commandStack.changed ──> syncTaskInfo()
                                                                       │
                                                                       └─> taskInfo 与画布元素对齐
```

### 三个关键机制

1. **选中联动**：`selection.changed` 事件把当前选中的第一个元素写入 `activeElement`，属性面板据此定位对应的 taskInfo 条目并展示可编辑字段。

2. **name 标准属性回写**：节点名称是标准 BPMN 属性。修改时调用 `modeling.updateProperties(element, { name })`，经 `commandStack` 执行 `element.updateProperties` 命令，`LabelBehavior` 在 `postExecute` 中调用 `modeling.updateLabel` 刷新画布标签，同时该操作进入撤销栈，并随 `saveXML` 写入 BPMN XML。

3. **自定义属性仅存内存**：`xxx`、`executeType`、`taskType`、`handleStrategy` 等只存在 taskInfo 数组中，不写入 XML；taskInfo 以数组形式随 formData 一起返回。

### 元素增删的自动对齐

`commandStack.changed` 触发时执行 `syncTaskInfo()`：

- 删除画布中已不存在的元素条目
- 为 palette 新增的元素追加默认条目
- 已有条目（按 `id + $type` 匹配）保留其自定义属性值，不会丢失

## 未保存修改检测（脏检查）

设计器的保存按钮带有一个"脏标记"圆点（类似 VS Code 中文件变更后的 tab 圆点），提示当前存在未保存的修改。

当画布或表单发生编辑且尚未保存时，圆点出现；点击保存后圆点消失；撤销回上次保存的状态后圆点同样消失。

### 检测原理

脏标记不再用"是否发生过编辑"的布尔标记（那会让撤销回原状后圆点依然残留），而是**实时对比当前状态与最近一次保存的快照**：

```txt
实时状态 formDataLocal ──对比──> savedSnapshot（初始 / 最近保存时的快照）
      │                              │
      └─ 任一 key 不同 ──────────────┘
                    │
                    ▼
              isDirty = true（显示圆点）
```

### 核心机制

1. **实时序列化**：`refreshCanvasState()` 在每次 `commandStack.changed`（编辑、撤销、重做）后，把当前画布序列化为 XML 并同步 `taskInfo`，写回 `formDataLocal` 的 `bpmn` / `taskInfo` 字段，使 `formDataLocal` 始终代表画布的最新真实状态。

2. **对象级快照对比**：`savedSnapshot` 以对象形态保存最近一次保存时的完整状态；`sameState()` 逐 key 比较（键序无关，`bpmn` 为字符串、`processBarInfo` 等对象退化为深比较），与字符串拼接比较相比更高效。

3. **XML 归一化**：`normalizeBpmn()` 在比较 `bpmn` 前剔除撤销/重做后 bpmn-js 残留在 DI 中的空 `<bpmndi:BPMNLabel />`。这类空标签无 bounds、无语义，撤销改名后模型状态已还原、但序列化 XML 会多出这一元素，不归一化会导致误判为"有修改"。

4. **初始快照取自实时状态**：组件初始化时先 `await refreshCanvasState()` 再用其结果建立快照，而不是直接用父组件传入的 `props.formData`。否则快照里仍是旧 XML / 空 taskInfo，与实时状态不一致，会误判初始即"脏"或撤销回原状后仍显示脏。

5. **自定义属性也参与脏检测**：修改属性面板的自定义属性（`xxx` 等）不触发 `commandStack.changed`，`onTaskInfoChange` 会手动把最新 `taskInfo` 同步进 `formDataLocal`，保证这类改动同样点亮圆点。

6. **保存清除脏标记**：`save()` 成功后把 `buildFormBean(extra)` 的结果合并进 `formDataLocal` 并重建快照，`isDirty` 立即为 `false`。

7. **下载不附带保存副作用**：`download('xml')` 直接对当前画布 `saveXML` 导出，不经过 `save()`，因此下载不会清除脏标记、也不会把未保存的修改"洗白"。

### 代码位置

- 脏检测与快照：`BpmnModeler.vue` 顶部 `savedSnapshot` / `sameState` / `normalizeBpmn` / `isDirty`
- 实时状态刷新：`BpmnModeler.vue` 中 `refreshCanvasState()`（`commandStack.changed`、初始化、`autoLayout()` 后调用）
- 圆点展示：`ModelerToolbar.vue` 的 `:is-dirty` prop 与 `.bpmn-btn-dirty-dot` 样式

## 只读预览

工具栏的「预览」按钮用于把流程切换到**只读预览模式**，与「收起面板」这类纯视图操作不同，预览模式真正禁止一切编辑。

### 实现原理

预览模式在画布上覆盖一层 bpmn-js 的 `NavigatedViewer`（`bpmn-js/lib/NavigatedViewer`）：

- `NavigatedViewer` 只注册渲染与导航服务，**不注册** palette、contextPad、modeling、editorActions 等编辑服务，因此元素无法拖动、无法增删改、无法连线，天然满足「不可编辑」
- 内置 `movecanvas` / `zoomscroll` / `keyboard-move` 导航模块：支持**鼠标拖动画布平移**与滚轮缩放（纯 `Viewer` 只能通过空格键平移）
- 进入预览前先用 `modeler.saveXML()` 序列化当前画布最新 XML，保证预览内容与编辑态实时一致
- 覆盖层遮住左侧 palette 与网格；右侧属性面板**保持显示但置为只读**（输入框禁用，仅可查看），点击预览层节点时面板同步展示对应节点属性
- 预览模式下工具栏的撤销/重做、自动布局、保存按钮被禁用；缩放/适应按钮仍可用（作用于 Viewer）
- 退出预览时销毁 Viewer 覆盖层，属性面板恢复可编辑状态

### 代码位置

- `BpmnModeler.vue`：`enterPreview()` / `exitPreview()` / `togglePreview()` / `getActiveCanvas()`，覆盖层样式 `.bpmn-preview-container`
- `ModelerToolbar.vue`：`is-preview` prop、预览按钮高亮与「退出预览」文案、预览模式下禁用编辑类按钮

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

`CustomPaletteProvider` 会把默认 palette 中非白名单分组的条目统一归入 `default` 分组，而 `custom` 分组保持不变（后端自定义元素现在由 Vue 面板 `CustomElementsPanel.vue` 渲染，见"自定义元素"一节）。

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
  xxx: '审批进度',         // 自定义属性
  executeType: 'serial',              // 自定义属性
  taskType: 'user-defined',           // 自定义属性
  handleStrategy: 'auto-approve'      // 自定义属性
}
```

### 默认创建行为（DefaultCreateBehavior）

`src/components/behavior/DefaultCreateBehavior.js` 在**新建元素**时统一写入默认属性，当前给 `bpmn:StartEvent` 写入默认 name（"开始"）。从 palette 拖入 / contextPad 追加新建的开始事件会直接显示该名称，且保存时序列化到 XML。

**原理：**

新建元素的操作最终都会执行 `shape.create` 命令。该行为模块是一个 `CommandInterceptor`，在命令的 `preExecute` 阶段（真正执行前）按元素类型写入默认值；随后 bpmn-js 的 `LabelBehavior` 会自动创建标签，画布即时显示默认名称。

**扩展其他默认属性：**

在 `preExecute` 回调里按 `bo.$type` 分支追加即可：

```javascript
this.preExecute('shape.create', (event) => {
  const shape = event.context && event.context.shape
  const bo = shape && shape.businessObject
  if (!bo) return

  if (bo.$type === 'bpmn:StartEvent' && !bo.name) {
    bo.name = '开始'
  }

  // 例如：给所有用户任务写入默认 name
  // if (bo.$type === 'bpmn:UserTask' && !bo.name) {
  //   bo.name = '审批任务'
  // }
})
```

注意：

- 只在属性为空时写入，不覆盖已命名 / 已导入的流程（`importXML` 不走 `shape.create` 命令，不会触发本行为）
- 直接给 `businessObject` 赋值写入的是标准 BPMN 属性（如 `name`），会随 `saveXML` 序列化到 XML；扩展属性需用 `businessObject.set(key, value)` 才能被 moddle 追踪并序列化

## 工具栏（Palette）

使用 [diagram-js-accordion-palette](https://github.com/miyuesc/diagram-js-accordion-palette) 替换默认 palette，支持按分组折叠 / 展开。

工具栏顶部的「收起」按钮与收起后左上角的「展开」手柄由 `PaletteToolbar.vue`（声明式组件）渲染，点击直接调用 palette 服务的 `open() / close()`，显隐交给 CSS 的 `.open` 类控制。

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

### 自定义元素（后端分页）

`CustomElementsPanel.vue` 会把后端接口返回的自定义元素渲染到 palette 中，支持**分页浏览**与**按名称搜索**，元素按 `item.group` 归类到不同分组。

**数据契约：**

接口请求与配置全部在 `CustomElementsPanel.vue` 内完成。`fetchPage` 为组件的 prop 并有默认值，默认指向 `src/api/customElements.js` 的 mock 实现；接入真实后端时修改组件内默认值（或调用方传入 props 覆盖）：

```javascript
// CustomElementsPanel.vue
import { fetchCustomElements } from '../../api/customElements'

defineProps({
  fetchPage: { type: Function, default: fetchCustomElements }, // 分页拉取函数
  pageSize:  { type: Number,   default: 12 },                  // 每页条数
  groupName: { type: String,   default: '自定义元素' }          // item.group 缺失时的兜底分组名
})
```

`fetchPage` 的签名与返回值约定：

```javascript
fetchPage({ page, pageSize, keyword }) // keyword 为搜索关键字，可为空串
  => Promise<{ list, total }>          // total 用于计算总页数
```

`list` 中每个元素的结构：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 唯一标识 |
| `name` | 是 | 显示名称（参与搜索匹配） |
| `type` | 是 | 要创建的 BPMN 类型，如 `bpmn:UserTask` |
| `group` | 否 | 所属分组名（palette 分组标题），缺失时归入 `groupName` |
| `iconClass` | 否 | 图标 CSS 类；不传时按 `type` 兜底映射内置图标 |
| `options` | 否 | 创建元素时的额外属性（如 Camunda 扩展属性） |
| `businessData` | 否 | 业务数据对象，创建元素时通过 `businessObject.set()` 逐字段写入（如 `{ busId: 'BUS-001' }`），保存时序列化到 XML |

读取方式：`element.businessObject.busId`（字段名按需替换）。若只想内存生效、不写入 XML，可改为直接赋值 `businessObject.busId = ...`（moddle 不追踪，保存不进 XML），但复制/粘贴会重建 businessObject 导致该字段丢失。

**交互与布局（声明式实现）：**

- **声明式渲染**：搜索框、状态提示、分组列表、分页条全部由 `CustomElementsPanel.vue` 模板渲染；分页 / 搜索状态是组件内 `ref`，接口请求（`fetchPage`）在组件内 `onMounted` / 防抖 `watch` 中发起，状态变化由 Vue 自动驱动重渲染，无需任何手动 DOM 注入 / 重建
- **搜索**：`v-model` + 300ms 防抖自动搜索、回车立即搜索；输入框由 Vue 管理，搜索后焦点与光标位置天然保留
- **分页**：分页条位于面板最底部；数据多于 1 页时显示 上一页 / 页码 / 下一页，按钮可用态由 `hasPrev / hasNext / loading` 派生
- **状态提示**：加载中、首载失败（可点击重试）、无匹配 / 暂无数据均为条件渲染（`v-if`）的浮动消息
- **分组折叠状态保留**：分组 `<details>` 的展开 / 折叠状态保存在响应式 `Map` 中，搜索或翻页后按分组名自动恢复
- **独立于分组**：搜索框、状态提示、分页条不属于任何手风琴分组，折叠 / 展开分组不会影响它们

**关于分组折叠结构 `<details>`：**

分组折叠没有自己造轮子，直接用 HTML 原生 `<details>` + `<summary>` 实现：

```html
<details class="djs-accordion-group" :open="isGroupOpen(group.name)" @toggle="onToggleGroup(group.name, $event)">
  <summary>{{ group.name }}</summary>
  <div class="djs-palette-group"><!-- 该分组的元素条目 --></div>
</details>
```

- **交互**：点击 `<summary>` 标题即切换展开 / 收起，无需任何 JS；`open` 属性控制默认状态，浏览器在开合变化时触发原生 `toggle` 事件，组件用它把状态写回响应式 `Map`，实现翻页 / 搜索后状态保留
- **兼容性**：所有现代浏览器原生支持（Chrome / Edge / Firefox / Safari，Safari 自 6.0 起），仅 IE11 及更早不支持（已停止维护，可忽略）。且手风琴 palette（`diagram-js-accordion-palette`）内部正是用同一结构渲染各分组，样式类（`.djs-accordion-group`）天然对齐、无需额外适配
- **样式复用**：`<details>` 与手风琴 palette 分组同款结构，因此分组标题的字体 / 行高等样式（`.djs-accordion-palette .djs-accordion-group summary`）由 `BpmnModeler.vue` 统一控制

**架构说明：**

`CustomElementsProvider` 把两个 Vue 应用（`CustomElementsPanel.vue` 与 `PaletteToolbar.vue`）挂载到 `.djs-palette` 容器内**持久存在的宿主节点**上。宿主节点是 `.djs-palette-entries` 的兄弟节点，不参与 layout（`display: contents`），因此不会随 diagram-js 的 `_update()` 清空重建，Vue 应用跨重建存活，状态与 DOM 均无需手动同步。`PaletteToolbar.vue` 负责工具栏的收起 / 展开（显隐由 CSS `.open` 类控制）。

**接入真实后端：**

默认的 `src/api/customElements.js` 提供 mock 实现（内置示例数据）。真实项目把 `fetchCustomElements` 替换为你的接口，并在字段不一致时按文件内注释做映射即可。由于 `fetchCustomElements` 作为 `CustomElementsPanel.vue` 的 `fetchPage` 默认值直接引用，替换后自动生效。

## 常见问题

### Q: 如何加载我自己的 BPMN 流程？

A: 将你的 BPMN XML 文件放在 `src/assets/bpmn/` 目录下，然后在 `App.vue` 中使用 `?raw` 导入：

```javascript
import myXml from './assets/bpmn/my-flow.bpmn?raw'

// 然后传入 BpmnModeler 组件
<BpmnModeler :xml="myXml" />
```

### Q: 自定义属性保存到哪里？

A: 自定义属性保存在 taskInfo 数组中（内存），直接以数组形式传回给父组件，由你决定是否上传数据库。标准 BPMN 属性（如元素名称、类型）会同步写入 XML 中。

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

### Q: 如何接入后端的自定义元素列表？

A: 在 `src/api/customElements.js` 中把 `fetchCustomElements` 换成真实接口，返回 `{ list, total }`（字段不一致时做映射）。无需改动 `CustomElementsProvider`，由于 `CustomElementsPanel.vue` 的 `fetchPage` 默认值直接引用该函数，替换后自动生效（详见"自定义元素"一节）。

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

bpmn-js 内部使用了依赖注入 (IoC) 架构。所有功能（canvas、eventBus、selection 等）都以 service 的形式注册，可通过 `modeler.get('serviceId')` 获取。自定义模块（paletteModule、contextPadModule、translateModule、defaultCreateBehaviorModule 等）通过 `additionalModules` 参数注入，遵循相同的 DI 模式。

### 非 Vue 组件接入 Vue 的重构技巧（palette 实战）

本项目在把 palette（diagram-js 拥有的 DOM）从命令式 DOM 操作重构为 Vue 声明式/响应式时，沉淀了一套可复用的技巧。核心思想：**Vue 不接管第三方库持有的 DOM，而是在其旁边"另起炉灶"**。

#### 约束与问题

palette 的 DOM 归 diagram-js 所有：`AccordionPalette._update()` 每次调用都会 `domClear` 后重建 `.djs-palette-entries`，所以：

- Vue 无法接管这些节点（会被随时删除重建）
- 旧实现只能用 `createElement`/`innerHTML`/`querySelector`/事件委托手动维护，代码长且易错

#### 技巧 1：持久宿主节点 + `display: contents`

在库管理的 DOM **之外**（`.djs-palette-entries` 的兄弟位置）创建宿主 `<div>`，把 Vue 应用挂载进去：

```js
const entries = container.querySelector('.djs-palette-entries')
container.insertBefore(toolbarHost, entries) // 工具栏
container.insertBefore(panelHost, entries.nextSibling) // 面板（放在 entries 之后）
```

宿主节点不在重建范围内，Vue 状态跨 `_update()` 存活。宿主设置 `display: contents`，不产生任何盒子，其子元素直接参与 `.djs-palette` 的布局，顺序由插入位置决定：

```css
.djs-custom-elements-host { display: contents; }
```

#### 技巧 2：数据请求与状态收进组件（`ref` 化）

接口请求与分页状态直接放回 Vue 组件（`CustomElementsPanel.vue`）——状态用 `ref` / `computed` 声明，`onMounted` 首载、`watch` 防抖搜索、翻页方法直接调 `fetchPage`。请求竞态用序号 `seq` 保护（后发请求未返回时丢弃先发结果）：

```js
const page = ref(1)
const total = ref(0)
const items = ref([])
const loading = ref(false)
const error = ref(null)

async function fetch(pageNo = 1) {
  const current = ++seq
  loading.value = true
  try {
    const res = await props.fetchPage({ page: pageNo, pageSize, keyword })
    if (current !== seq) return
    page.value = pageNo
    total.value = Number(res && res.total) || 0
    items.value = (res && res.list) || []
  } finally {
    if (current === seq) loading.value = false
  }
}
```

这是 Vue 组件做数据获取的惯用做法；若状态需要脱离组件共享或单测，才考虑把状态类用 `reactive()` 包裹（getters 会自动成为响应式派生值）。本面板规模较小，最终采用了组件内 `ref` 方案。

#### 技巧 3：模板替代 `innerHTML`

搜索框、分页条、加载/空态提示全部改为 `<template>` 声明式渲染：

- `v-model` + `watch` 防抖替代手写 `input` 监听
- `v-if/v-else` 替代 `el.innerHTML = ...` 拼接
- `:disabled` / `@click` 替代手动改 `disabled` 属性和事件委托
- 文本自动转义，删掉手写 `escapeHtml`
- 输入框由 Vue 管理，重渲染不再丢失焦点/光标

#### 技巧 4：响应式状态替代快照/恢复

折叠状态存响应式 `Map`（`reactive(new Map())`），直接绑定 `<details>` 的 `:open` / `@toggle`；翻页后按分组 key 恢复展开状态，删掉了手动快照与还原逻辑。

#### 技巧 5：挂载时机与销毁清理

库容器在初始化完成前不存在，用事件保证挂载时机：

```js
eventBus.once('diagram.init', () => this._mount())
```

（需确认 `AccordionPalette` 的 `diagram.init` 监听先注册、`_container` 已创建；didi 会先执行完所有模块的 `__init__` 才触发 `diagram.init`。）

销毁时通过 `diagram.destroy` 事件 `unmount()`，避免泄漏。多个 `createApp` 作为互相独立的 Vue "island" 挂在宿主上，与主应用互不影响。

#### 适用边界

- 适用于**库持有 DOM 且频繁重建**的场景；若 DOM 由业务侧完全掌控，直接写 Vue 组件即可
- 库自身的渲染逻辑（如 palette 条目）仍需走其 provider API，不能越过库直接操作

## 注意事项

### 1. activeElement 必须使用 shallowRef

`BpmnModeler.vue` 中 `activeElement` 保存的是 bpmn-js 元素对象，**必须用 `shallowRef` 而不是 `ref`**。

bpmn-js 元素含非可配置的属性（如 `labels`），如果用 `ref` 声明，Vue 会把元素深度包装成 `reactive` 代理。调用 `modeling.updateProperties` 时 bpmn-js 内部读取这些属性会抛出：

```
TypeError: 'get' on proxy: property 'labels' is a read-only and non-configurable
data property on the proxy target but the proxy did not return its actual value
```

结果表现为：属性面板中修改节点名称后，画布上的节点标签不刷新（命令中断在抛出异常处）。改用 `shallowRef` 后元素保持原始对象，命令正常执行。

### 2. taskInfo 是唯一数据源，不要直接改 businessObject

- 修改 `name` 时必须走 `modeling.updateProperties`，让命令进入撤销栈、刷新标签并写入 XML
- 自定义属性（`xxx`、`executeType` 等）仅存内存，**刷新页面会丢失**，需要持久化时必须在保存后由业务侧将 formBean.taskInfo 落库

### 3. 属性面板采用单向数据流

PropertyPanel 输入框用 `:value` + `@input` 绑定，通过 `change` 事件把 `{ key, value }` 抛给父组件，由父组件更新 taskInfo。**不要在子组件内直接修改 `props.taskInfo`**，否则会破坏"唯一数据源"约束。

### 4. 多选元素只取第一个

`selection.changed` 中只处理 `newSelection[0]`，多选时仅第一个元素进入属性面板。目前不支持批量编辑。

### 5. 自动布局会重建元素实例

`autoLayout()` 通过 bpmn-auto-layout 重算坐标后重新 `importXML`，所有元素实例会重建。因此代码在重新导入后必须再次调用 `syncTaskInfo()`（按 id 对齐，保留自定义属性）并手动刷新命令栈状态；`importXML` 会清空命令栈，导致无法撤销自动布局。

### 6. 保存是"画布 XML"与"内存 taskInfo"两份数据的合并

`saveXML` 只序列化画布状态（含标准属性如 `name`），自定义属性不会出现在 XML 中，由 taskInfo 数组单独随 formData 返回。两者靠元素 `id` 关联，读取时需按 id 合并。

### 7. 自定义 palette / i18n 模块要遵循 DI 注入

新增模块（palette、翻译等）需通过 `additionalModules` 注册，并保持 `$inject` 声明的依赖注入写法，否则 bpmn-js 无法解析。

## License

MIT
