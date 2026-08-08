<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
// bpmn-js 的核心 Modeler 类：同时具备"查看"(Viewer)和"编辑"(建模)能力。
// 内部是依赖注入(IoC)架构，所有功能都以 "service" 形式注册，可用 modeler.get('xxx') 获取。
import BpmnModeler from 'bpmn-js/lib/Modeler'
// 这三个是 bpmn-js 自带的样式：画布基础样式 + BPMN 图形样式 + 字体图标
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'
// ?raw 表示 Vite 把 .bpmn 文件当纯文本字符串导入（不经过打包处理）
import initialXml from '../assets/bpmn/initial.bpmn?raw'
// 手风琴折叠式 palette 的样式（替换默认 palette 后必须引入）
import 'diagram-js-accordion-palette/assets/index.css'
// 属性编辑器组件：选中元素时编辑节点属性，未选中时编辑流程表单元数据
import PropertyPanel from './properties/PropertyPanel.vue'

// 组件对外暴露的属性
const props = defineProps({
  // 父组件传入的 BPMN XML 字符串；为空时加载内置示例流程
  xml: {
    type: String,
    default: ''
  },
  // 设计器顶部标题
  title: {
    type: String,
    default: ''
  },
  // 父组件传入的流程表单元数据（workflowCode / workflowName / workflowType / publishedFlag 等），
  // 支持 v-model:form-data 双向绑定：未选中元素时右侧基础信息编辑器会修改它，
  // 保存时与 bpmn、taskInfo 一起合并进 formBean，供数据库最终落库
  formData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['command-stack-changed', 'saved', 'update:formData'])

// 模板 ref：modeler 的容器(canvas)由 Vue 渲染出来，再用原生 DOM 交给 bpmn-js
const canvasRef = ref(null)

// 本地 formData 副本：右侧基础信息编辑器直接修改它，改动后同步回父组件
const formDataLocal = ref({ ...props.formData })

// 父组件传入的 formData 变化时同步进本地副本（如从数据库回显）
watch(
  () => props.formData,
  (val) => {
    formDataLocal.value = { ...formDataLocal.value, ...val }
  },
  { deep: true }
)

// modeler 实例必须在 DOM 挂载后才创建，所以不能用 ref 包裹，用普通变量存即可
let modeler = null
// modeler 初始化完成标志（响应式）：用于控制顶部工具栏、属性面板的显示
const modelerReady = ref(false)
// 保存后的流程 XML 字符串
let bpmnXml = ''

// 当前选中的元素信息（用于右侧属性面板定位）
const activeElement = ref(null)
// 流程节点属性数据（唯一数据源）：与画布元素通过 id + $type 一一对应
// 自定义属性（progressBarName / executeType / taskType / handleStrategy）仅存于内存，
// 不写入 BPMN XML；标准 name 属性会同步回 businessObject 以更新节点标签并随 XML 保存
const taskInfo = ref([])
// 撤销/重做按钮是否可用
const canUndo = ref(false)
const canRedo = ref(false)
const isSaving = ref(false)
// 右侧属性面板显示/隐藏状态
const panelVisible = ref(true)

/**
 * 初始化 bpmn-js Modeler。
 * 动态 import 两个包：它们体积较大，只在用到时加载，可以减小首屏体积。
 */
async function initModeler() {
  // Camunda 的 moddle 扩展定义（JSON）：保证解析带 camunda:* 扩展属性的流程 XML
  const { default: camundaModdle } = await import('camunda-bpmn-moddle/resources/camunda.json')
  // 自定义 palette 模块：保留默认工具栏的基础上扩展额外工具
  const { paletteModule } = await import('./palette/index')
  // 中文本地化模块：覆盖 translate 服务，把默认工具提示翻译成中文
  const { translateModule } = await import('./i18n/index')
  // 手风琴折叠式 palette 模块：替换默认的 palette 服务，按分组折叠/展开
  const { default: AccordionPaletteModule } = await import('diagram-js-accordion-palette')
  // 视觉网格模块：在画布上显示点状网格（SVG 实现，无需引入样式）
  const { default: gridModule } = await import('diagram-js-grid')

  // 创建 modeler 实例：
  modeler = new BpmnModeler({
    // container: 画布挂载到哪个 DOM 元素（bpmn-js 会在此元素内渲染 svg 图形）
    container: canvasRef.value,
    // additionalModules: 额外注册的模块（自定义 palette、手风琴 palette、网格、中文本地化）
    additionalModules: [paletteModule, translateModule, AccordionPaletteModule, gridModule],
    // accordionPalette: 手风琴 palette 的配置
    accordionPalette: {
      showName: false, // 显示工具名称
      accordion: false, // 关闭手风琴模式，允许多个分组同时展开
      defaultOpenGroups: ['default', 'custom'] // 默认展开的分组
    },
    // moddleExtensions: 扩展 XML 模型，告诉解析器 camunda: 命名空间下的属性如何解析
    moddleExtensions: {
      camunda: camundaModdle
    }
  })

  // importXML: 把 BPMN XML 字符串导入并渲染到画布（这是最核心的入口之一）
  try {
    await modeler.importXML(props.xml || initialXml)
  } catch (err) {
    console.error('导入流程失败:', err)
  }

  // 根据画布元素初始化 taskInfo（自定义属性默认置空，name 取自 businessObject）
  syncTaskInfo()

  // canvas service：负责图形的缩放、平移、视图定位
  const canvas = modeler.get('canvas')
  // 第二个参数 'auto'：以视口中心为锚点，让整个流程图在画布中居中（缩放上限为 1，小图不会被放大）
  canvas.zoom('fit-viewport', 'auto')

  // eventBus service：bpmn-js 的事件总线，所有交互都通过它发布/订阅事件
  const eventBus = modeler.get('eventBus')

  // selection.changed：选中元素发生变化时触发，newSelection 是当前选中的元素数组
  eventBus.on('selection.changed', ({ newSelection }) => {
    activeElement.value = newSelection && newSelection[0]
    // 选中元素时自动显示属性面板
    if (newSelection && newSelection[0]) {
      panelVisible.value = true
    }
  })

  // commandStack.changed：任何编辑操作（增删改）发生后触发，借此刷新撤销/重做按钮
  eventBus.on('commandStack.changed', () => {
    // 画布上新增/删除了节点时，同步 taskInfo（已有条目的自定义属性保留）
    syncTaskInfo()
    updateCommandState()
    emit('command-stack-changed')
  })
  updateCommandState()

  // modeler 初始化完成，通知 Vue 重渲染以显示顶部工具栏
  modelerReady.value = true

  // 为手风琴 palette 挂载收起按钮：点击收起隐藏，点击左上角手柄重新展开
  setupPaletteCollapse()
}

// 不作为流程节点（无 taskInfo 条目）的图形元素类型
const NON_FLOW_NODE_TYPES = [
  'bpmn:Process',
  'bpmn:Collaboration',
  'bpmn:Participant',
  'bpmn:Lane',
  'bpmn:TextAnnotation',
  'bpmn:Group',
  'bpmn:DataObjectReference',
  'bpmn:DataStoreReference'
]

/**
 * 收集画布上所有流程节点（含连线、泳道等被排除）
 * 返回 { element, bo } 列表，bo 为对应的 businessObject
 */
function collectFlowNodes() {
  const elementRegistry = modeler.get('elementRegistry')
  const nodes = []
  elementRegistry.getAll().forEach((element) => {
    // 连线（SequenceFlow/Association 等）带 waypoints，直接跳过
    if (element.waypoints) return
    const bo = element.businessObject
    if (!bo || typeof bo.$type !== 'string' || !bo.$type.startsWith('bpmn:')) return
    if (NON_FLOW_NODE_TYPES.includes(bo.$type)) return
    nodes.push({ element, bo })
  })
  return nodes
}

/**
 * 生成某个流程节点的默认 taskInfo 条目。
 * 自定义属性（progressBarName 等）仅在内存中维护，默认置空；name 取自 businessObject
 */
function defaultTaskInfoEntry(bo) {
  const entry = {
    $type: bo.$type,
    id: bo.id,
    name: bo.name || '',
    progressBarName: ''
  }
  if (bo.$type === 'bpmn:UserTask') {
    entry.executeType = ''
    entry.taskType = ''
    entry.handleStrategy = ''
  }
  return entry
}

/**
 * 把画布元素与 taskInfo 对齐：
 * - 画布中已删除的元素，从 taskInfo 中移除
 * - 画布中新增的元素（如从 palette 拖入），追加默认条目
 * - 已存在的条目保留其自定义属性值
 */
function syncTaskInfo() {
  if (!modeler) return
  const nodes = collectFlowNodes()
  const ids = nodes.map(({ bo }) => bo.id)
  // 删除已被移除的节点条目
  taskInfo.value = taskInfo.value.filter((t) => ids.includes(t.id))
  // 追加新增节点的默认条目
  nodes.forEach(({ bo }) => {
    if (!taskInfo.value.some((t) => t.id === bo.id && t.$type === bo.$type)) {
      taskInfo.value.push(defaultTaskInfoEntry(bo))
    }
  })
}

/**
 * 属性面板 change 事件处理：更新 taskInfo。
 * name 是标准 BPMN 属性，同步回 businessObject 更新节点标签并随 XML 保存；
 * 其余自定义属性仅存于内存 taskInfo，不写入 XML
 */
function onTaskInfoChange({ key, value }) {
  const element = activeElement.value
  if (!element) return
  const bo = element.businessObject
  const entry = taskInfo.value.find((t) => t.id === bo.id && t.$type === bo.$type)
  if (!entry) return
  entry[key] = value
  if (key === 'name') {
    // 走 modeling.updateProperties 让节点标签刷新并进入撤销栈
    modeler.get('modeling').updateProperties(element, { name: value })
  }
}

/**
 * 基础信息编辑器 change 事件处理：更新本地 formData 并同步回父组件（v-model:form-data）
 */
function onFormDataChange({ key, value }) {
  formDataLocal.value = { ...formDataLocal.value, [key]: value }
  emit('update:formData', { ...formDataLocal.value })
}

/**
 * 手风琴 palette 收起/展开：
 * - 展开时顶部工具栏提供"收起"按钮，点击后隐藏 palette
 * - 隐藏后只留一个左上角的小手柄，点击即可重新展开
 */
function setupPaletteCollapse() {
  const palette = modeler.get('palette')
  const paletteEl = canvasRef.value.querySelector('.djs-accordion-palette')
  if (!palette || !paletteEl) return

  // 顶部工具栏：标题 + 收起按钮（仅展开时显示）
  const toolbar = document.createElement('div')
  toolbar.className = 'djs-accordion-palette-toolbar'
  const title = document.createElement('span')
  title.className = 'djs-accordion-palette-title'
  title.textContent = '工具栏'
  const collapseBtn = document.createElement('button')
  collapseBtn.type = 'button'
  collapseBtn.className = 'djs-accordion-palette-collapse'
  collapseBtn.title = '收起工具栏'
  collapseBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
    '<path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>'
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (palette.isOpen()) {
      palette.close()
    }
  })
  toolbar.appendChild(title)
  toolbar.appendChild(collapseBtn)
  // 插入到条目容器之前，让工具栏显示在 palette 顶部
  paletteEl.prepend(toolbar)

  // 隐藏后的展开入口：左上角的小手柄（点击重新展开）
  const handle = document.createElement('div')
  handle.className = 'djs-accordion-palette-handle'
  handle.title = '展开工具栏'
  handle.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
    '<path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>'
  handle.addEventListener('click', () => {
    if (!palette.isOpen()) {
      palette.open()
    }
  })
  paletteEl.appendChild(handle)
}

// commandStack service：记录所有编辑操作，提供撤销/重做
function updateCommandState() {
  const stack = modeler.get('commandStack')
  canUndo.value = stack.canUndo()
  canRedo.value = stack.canRedo()
}

function undo() {
  modeler.get('commandStack').undo()
}

function redo() {
  modeler.get('commandStack').redo()
}

function zoomIn() {
  const canvas = modeler.get('canvas')
  // canvas.zoom(newScale) 第一个参数是缩放系数，不传第二个参数时自动以视口中心为锚点缩放
  // 之前误把 { x: 0, y: 0 } 当第一个参数传入，导致 1/currentScale * {object} = NaN 而报错
  canvas.zoom(Math.min(2, canvas.zoom() + 0.2))
}

function zoomOut() {
  const canvas = modeler.get('canvas')
  canvas.zoom(Math.max(0.2, canvas.zoom() - 0.2))
}

function resetZoom() {
  const canvas = modeler.get('canvas')
  canvas.resized();
  canvas.zoom('fit-viewport', 'auto')
}

/**
 * 组装最终落库的 formBean：
 * - bpmn：序列化后的流程 XML
 * - taskInfo：节点属性 JSON 字符串（唯一数据源）
 * - 其余为流程表单元数据，父组件可通过 formData prop 或 save/getFormBean 的 extra 参数覆盖
 * - processBarInfo 为进度条信息，默认空数组，由业务侧填充
 */
function buildFormBean(extra = {}) {
  return {
    workflowCode: '',
    workflowName: '',
    workflowType: 'W',
    publishedFlag: '1',
    bpmn: bpmnXml,
    workflowParam: '',
    modelId: '',
    version: '',
    newFlag: '',
    taskInfo: JSON.stringify(taskInfo.value),
    processBarInfo: [],
    ...formDataLocal.value,
    ...extra,
    // bpmn / taskInfo 始终取当前实时状态
    bpmn: bpmnXml,
    taskInfo: JSON.stringify(taskInfo.value)
  }
}

/**
 * 保存流程：把画布上的所有改动序列化回 BPMN XML，组装 formBean 并通过 saved 事件抛出
 * saveXML 是 importXML 的逆操作
 */
async function save(extra = {}) {
  if (!modeler) return
  isSaving.value = true
  try {
    const { xml } = await modeler.saveXML({ format: true }) // format: 格式化缩进
    bpmnXml = xml
    emit('saved', buildFormBean(extra))
  } catch (err) {
    console.error('保存失败:', err)
  } finally {
    isSaving.value = false
  }
}

/**
 * 不触发保存，直接返回当前状态的 formBean（bpmn 为最近一次序列化结果，未保存过则为空）
 */
function getFormBean(extra = {}) {
  return buildFormBean(extra)
}

function getXml() {
  return bpmnXml
}

// 下载导出：type 为 'xml' 或 'svg'
async function download(type) {
  if (type === 'xml') {
    if (!bpmnXml) await save() // 还没保存过就先保存一次
    downloadBlob(new Blob([bpmnXml], { type: 'application/xml' }), 'diagram.bpmn')
  } else {
    // saveSVG: 导出画布当前视图为 SVG 矢量图
    const { svg } = await modeler.saveSVG()
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'diagram.svg')
  }
}

// 通用浏览器文件下载工具函数
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// onMounted 后再初始化：确保 canvasRef 对应的 DOM 已经渲染到页面中
onMounted(async () => {
  await nextTick()
  initModeler()
})

// 组件销毁时释放 modeler 实例，避免内存泄漏和事件残留
onBeforeUnmount(() => {
  if (modeler) modeler.destroy()
})

// 暴露给父组件调用的方法
defineExpose({ save, download, getXml, getFormBean, undo, redo, taskInfo })
</script>

<template>
  <div class="bpmn-page">
    <div class="bpmn-header">
      <div class="bpmn-header-left">
        <span class="bpmn-logo">flow</span>
        <span class="bpmn-title">{{ title || '流程设计器' }}</span>
      </div>
      <div class="bpmn-header-right">
        <template v-if="modelerReady">
          <button class="bpmn-btn" :disabled="!canUndo" @click="undo" title="撤销">撤销</button>
          <button class="bpmn-btn" :disabled="!canRedo" @click="redo" title="重做">重做</button>
          <span class="bpmn-divider"></span>
          <button class="bpmn-btn" @click="zoomOut" title="缩小">-</button>
          <button class="bpmn-btn" @click="resetZoom" title="适应窗口">适应</button>
          <button class="bpmn-btn" @click="zoomIn" title="放大">+</button>
          <span class="bpmn-divider"></span>
          <button class="bpmn-btn" @click="download('svg')">下载SVG</button>
          <button class="bpmn-btn" @click="download('xml')">下载XML</button>
          <button class="bpmn-btn bpmn-btn-primary" :disabled="isSaving" @click="save">
            {{ isSaving ? '保存中...' : '保存' }}
          </button>
        </template>
      </div>
    </div>
    <div class="bpmn-body">
      <div class="bpmn-canvas" ref="canvasRef"></div>
      <div class="bpmn-panel" v-show="modelerReady && panelVisible">
        <PropertyPanel
          :element="activeElement"
          :task-info="taskInfo"
          :form-data="formDataLocal"
          @change="onTaskInfoChange"
          @form-change="onFormDataChange"
          @close="panelVisible = false"
        />
      </div>
      <button
        v-if="modelerReady && !panelVisible"
        class="bpmn-panel-expand"
        title="展开属性"
        @click="panelVisible = true"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.bpmn-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.bpmn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.bpmn-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bpmn-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #10b981;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
}

.bpmn-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.bpmn-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bpmn-btn {
  height: 30px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.bpmn-btn:hover:not(:disabled) {
  border-color: #10b981;
  color: #10b981;
}

.bpmn-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.bpmn-btn-primary {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

.bpmn-btn-primary:hover:not(:disabled) {
  background: #059669;
  color: #fff;
}

.bpmn-divider {
  width: 1px;
  height: 20px;
  background: #e5e7eb;
  margin: 0 4px;
}

.bpmn-body {
  position: relative;
  display: flex;
  flex: 1;
  overflow: hidden;
}

.bpmn-canvas {
  flex: 1;
  background: #f3f4f6;
  min-width: 0;
}

.bpmn-panel {
  width: 320px;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  overflow-y: auto;
  flex-shrink: 0;
}

.bpmn-panel-expand {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 48px;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.bpmn-panel-expand:hover {
  border-color: #10b981;
  color: #10b981;
}
</style>

<style>
/* 此样式块不加 scoped，因为 bpmn-js 是动态注入的 DOM，不在 Vue 模板里，scoped 选择器无法命中 */

/* 隐藏右下角 bpmn-js 自动注入的 "Powered by bpmn.io" 水印 logo */
/* .bjs-powered-by {
  display: none;
} */

/* ---------- 手风琴 palette 收起/展开 ---------- */
/* 基础定位：展开/折叠时都固定在画布左上角 */
.djs-accordion-palette {
  position: absolute;
  left: 20px;
  top: 20px;
  z-index: 100;
}

/* 展开时的顶部工具栏：标题 + 收起按钮 */
.djs-accordion-palette-toolbar {
  display: none;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  margin-bottom: 2px;
}
.djs-accordion-palette.open {
  width: 160px;
}
.djs-accordion-palette.open .djs-accordion-palette-toolbar {
  display: flex;
}

.djs-accordion-palette-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.djs-entry-title {
  font-size: 13px;
  color: #374151;
}

/* 折叠面板分组标题（事件/网关/活动等） */
.djs-accordion-palette .djs-accordion-group summary {
  font-size: 14px;
}

.djs-accordion-palette-collapse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  border-radius: 4px;
  background: none;
  color: #6b7280;
  cursor: pointer;
  line-height: 1;
}

.djs-accordion-palette-collapse:hover {
  color: #111827;
  background: #f3f4f6;
}

/* 收起后收缩成一个小手柄，点击重新展开 */
.djs-accordion-palette.djs-palette:not(.open) {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 4px;
  box-shadow: 0 0 10px var(--color-black-opacity-10);
  background-color: var(--color-white);
}

.djs-accordion-palette-handle {
  display: none;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #374151;
}

.djs-accordion-palette.djs-palette:not(.open) .djs-accordion-palette-handle {
  display: flex;
}

</style>
