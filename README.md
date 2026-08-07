# BPMN 流程引擎页面

基于 Vue 3 + Vite + bpmn-js 的流程设计器页面，内置属性面板，支持流程图的创建、编辑、保存与导出。

## 技术栈

- [Vue 3](https://vuejs.org/) + `<script setup>` 语法
- [Vite](https://vite.dev/) 构建工具
- [bpmn-js](https://bpmn.io/toolkit/bpmn-js/) BPMN 2.0 渲染与建模
- [bpmn-js-properties-panel](https://github.com/bpmn-io/bpmn-js-properties-panel) 元素属性面板
- [camunda-bpmn-moddle](https://github.com/camunda/camunda-bpmn-moddle) Camunda 扩展模型定义

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
        └── BpmnModeler.vue        # 核心流程设计器组件
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

## 常见问题

- **属性面板不生效**：bpmn-js-properties-panel v5 的样式已内嵌在 JS 中，无需额外引入 CSS 文件。
- **`.bpmn` 文件解析报错**：需要在 `vite.config.js` 中配置 `assetsInclude: ['**/*.bpmn']`，并以 `?raw` 后缀引入，确保 XML 以文本形式加载。
