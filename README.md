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
        │   ├── CustomPaletteProvider.js  # 扩展默认工具栏的自定义条目
        │   ├── CustomElementsProvider.js # 后端自定义元素 provider（分页 + 搜索 + 浮动布局）
        │   ├── CustomElementsStore.js    # 自定义元素分页 / 搜索状态管理
        │   └── pagination.css            # 分页条 / 搜索框 / 状态提示样式
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
- **选中元素时**：编辑该元素的自定义属性（progressBarName、executeType、taskType、handleStrategy 等）

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
  taskInfo: [{ id: 'UserTask_1', progressBarName: '...', executeType: '...' }, ...], // 节点属性数组
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

3. **自定义属性仅存内存**：`progressBarName`、`executeType`、`taskType`、`handleStrategy` 等只存在 taskInfo 数组中，不写入 XML；taskInfo 以数组形式随 formData 一起返回。

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

5. **自定义属性也参与脏检测**：修改属性面板的自定义属性（`progressBarName` 等）不触发 `commandStack.changed`，`onTaskInfoChange` 会手动把最新 `taskInfo` 同步进 `formDataLocal`，保证这类改动同样点亮圆点。

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

`CustomPaletteProvider` 会把默认 palette 中非白名单分组的条目统一归入 `default` 分组，而 `custom` 与 `custom-elements`（后端自定义元素，见"工具栏"一节）分组保持不变。

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

### 自定义元素（后端分页）

`CustomElementsProvider` 会把后端接口返回的自定义元素渲染到 palette 中，支持**分页浏览**与**按名称搜索**，元素按 `item.group` 归类到不同分组。

**数据契约：**

在 `BpmnModeler.vue` 中通过 `customElements` 配置提供分页拉取函数：

```javascript
customElements: {
  fetchPage: fetchCustomElements, // 分页拉取函数
  pageSize: 12,                   // 每页条数
  groupName: '自定义元素'          // item.group 缺失时的兜底分组名
}
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

**交互与布局：**

- **搜索**：搜索框固定在分组区顶部；输入防抖 300ms 自动搜索、回车立即搜索；搜索结果从第 1 页开始，关键字保留在输入框内并保持焦点
- **分页**：分页条固定在面板最底部；数据多于 1 页时显示 上一页 / 页码 / 下一页
- **状态提示**：加载中、首载失败（可点击重试）、无匹配 / 暂无数据提示均为浮动消息
- **独立于分组**：搜索框、状态提示、分页条都不属于任何手风琴分组，折叠 / 展开分组不会影响它们
- **分组折叠状态保留**：搜索或翻页触发重建后，各分组的展开 / 折叠状态会按分组名恢复

**接入真实后端：**

默认的 `src/api/customElements.js` 提供 mock 实现（内置示例数据）。真实项目把 `fetchCustomElements` 替换为你的接口，并在字段不一致时按文件内注释做映射即可。

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

A: 在 `src/api/customElements.js` 中把 `fetchCustomElements` 换成真实接口，返回 `{ list, total }`（字段不一致时做映射）。无需改动 `CustomElementsProvider`，它会自动获得分页与搜索能力（详见"自定义元素"一节）。

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
- 自定义属性（`progressBarName`、`executeType` 等）仅存内存，**刷新页面会丢失**，需要持久化时必须在保存后由业务侧将 formBean.taskInfo 落库

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
