<script setup>
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
// bpmn-js 的核心 Modeler 类：同时具备"查看"(Viewer)和"编辑"(建模)能力。内部是依赖注入(IoC)架构，所有功能都以 "service" 形式注册，可用 modeler.get('xxx') 获取。
import BpmnModeler from 'bpmn-js/lib/Modeler'
// 这三个是 bpmn-js 自带的样式：画布基础样式 + BPMN 图形样式 + 字体图标
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'
// 手风琴折叠式 palette 的样式（替换默认 palette 后必须引入）
import 'diagram-js-accordion-palette/assets/index.css'
// 属性编辑器组件：选中元素时编辑节点属性，未选中时编辑流程表单元数据
import PropertyPanel from './properties/PropertyPanel.vue'
// 顶部工具栏组件：标题 + 撤销/重做 + 缩放 + 预览 + 下载 + 保存
import ModelerToolbar from './toolbar/ModelerToolbar.vue'

// 组件对外暴露的属性
const props = defineProps({
  // 父组件传入的流程表单元数据（workflowCode / workflowName / workflowType / publishedFlag 等），
  // 支持 v-model:form-data 双向绑定：未选中元素时右侧基础信息编辑器会修改它，
  // 保存时与 bpmn、taskInfo 一起合并进 formBean，供数据库最终落库
  formData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['saved', 'update:formData'])

// 模板 ref：modeler 的容器(canvas)由 Vue 渲染出来，再用原生 DOM 交给 bpmn-js
const canvasRef = ref(null)

// 本地 formData 副本：右侧基础信息编辑器直接修改它，改动后同步回父组件
const formDataLocal = ref({ ...props.formData })

// v-model 透传桥：setter 里既更新本地副本又 emit 给父组件，使 PropertyPanel 的 v-model:form-data 改动一路同步到最外层
const formDataModel = computed({
  get: () => formDataLocal.value,
  set: (val) => updateFormDataLocal(val)
})

// 数据类型转换 (JSON <-> Array)
const taskInfo = computed({
  get: () => parseTaskInfo(),
  set: (arr) => updateFormDataLocal({ taskInfo: JSON.stringify(arr) })
})

function parseTaskInfo() {
  try {
    return JSON.parse(formDataLocal.value.taskInfo || '[]')
  } catch (e) {
    return []
  }
}

// 统一写操作函数（单一收口点）
function updateFormDataLocal(patch) {
  formDataLocal.value = { ...formDataLocal.value, ...patch }
  emit('update:formData', formDataLocal.value)
}

// modeler 实例必须在 DOM 挂载后才创建，所以不能用 ref 包裹，用普通变量存即可
let modeler = null
// modeler 初始化完成标志（响应式）：用于控制顶部工具栏、属性面板的显示
const modelerReady = ref(false)
// bpmn-auto-layout 的 layoutProcess：懒加载，首次自动布局时动态 import
let layoutProcess = null

// 当前选中的元素信息（用于右侧属性面板定位）。
// 必须用 shallowRef：bpmn-js 元素含非可配置属性（如 labels），深度代理会导致 updateProperties 抛错、节点标签不刷新
const activeElement = shallowRef(null)

// 撤销/重做按钮是否可用
const canUndo = ref(false)
const canRedo = ref(false)
const isSaving = ref(false)
// 保存成功时的完整状态快照（对象形态，与 formDataLocal 同构），用于脏检测
const savedSnapshot = ref({ ...props.formData })

// bpmn 比较前做归一化：撤销/重做后 bpmn-js 可能在 DI 中残留空的 <bpmndi:BPMNLabel />，
// 这是无 bounds、无语义的空标签，与初始状态仅差这一个元素，归一化后视为一致
function normalizeBpmn(xml) {
  return (xml || '')
    .replace(/[ \t]*<bpmndi:BPMNLabel[ \t]*\/>[ \t]*\r?\n?/g, '')
    .replace(/[ \t]*<bpmndi:BPMNLabel[ \t]*>[ \t]*<\/bpmndi:BPMNLabel>[ \t]*\r?\n?/g, '')
}

// 逐 key 比较两个状态对象（键序无关）：先比 key 集合，再比值，遇到首个差异即返回。
// 相比把整个对象（含整段 BPMN XML）拼成字符串全量对比，更高效
function sameState(a, b) {
  const ka = Object.keys(a).sort()
  const kb = Object.keys(b).sort()
  if (ka.length !== kb.length) return false
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return false
    const va = a[ka[i]]
    const vb = b[ka[i]]
    if (va === vb) continue
    // 引用不同但内容相同的对象/数组（如 processBarInfo），退化为深比较
    if (va && vb && typeof va === 'object' && typeof vb === 'object' && JSON.stringify(va) === JSON.stringify(vb)) continue
    // bpmn XML 用归一化后比较，容忍撤销/重做残留的空 BPMNLabel
    if (ka[i] === 'bpmn' && typeof va === 'string' && typeof vb === 'string' && normalizeBpmn(va) === normalizeBpmn(vb)) continue
    return false
  }
  return true
}

// 是否存在未保存的修改：formDataLocal（含实时 bpmn/taskInfo）与最近一次保存的快照不一致，
// 驱动工具栏保存按钮的提醒标记（类似 VS Code 文件变更后的 tab 圆点）
const isDirty = computed(() => !sameState(formDataLocal.value, savedSnapshot.value))
// 右侧属性面板显示/隐藏状态
const panelVisible = ref(true)
// 所有面板是否都已收起（用于切换按钮文案）
const allPanelsCollapsed = ref(false)

/**
 * 核心导入逻辑：把 XML 载入 modeler 实例
 */
async function importDiagram(xml) {
  if (!modeler || !xml) return
  try {
    await modeler.importXML(xml)
  } catch (err) {
    console.error('导入流程失败:', err)
  }
}

/**
 * 内部统一的数据应用与视图重构控制函数
 */
async function applyFormData(newFormData) {
  if (!modeler || !newFormData) return
  formDataLocal.value = { ...formDataLocal.value, ...newFormData }
  
  if (formDataLocal.value.bpmn) {
    await importDiagram(formDataLocal.value.bpmn)
  }

  // 根据画布元素初始化 taskInfo
  syncTaskInfo()
  // 把实际加载的画布状态序列化进 formDataLocal
  await refreshCanvasState()

  // 视口自适应居中与尺寸刷新
  const canvas = modeler.get('canvas')
  canvas.resized()
  canvas.zoom('fit-viewport', 'auto')
}

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

  // 统一加载初始数据并自适应视口
  await applyFormData(formDataLocal.value)
  savedSnapshot.value = { ...formDataLocal.value }

  // eventBus service：bpmn-js 的事件总线，所有交互都通过它发布/订阅事件
  const eventBus = modeler.get('eventBus')

  // selection.changed：选中元素发生变化时触发
  eventBus.on('selection.changed', ({ newSelection }) => {
    activeElement.value = newSelection && newSelection[0]
    // 选中元素时自动显示属性面板
    if (newSelection && newSelection[0]) {
      panelVisible.value = true
    }
  })

  // commandStack.changed：任何编辑操作（增删改、撤销/重做）发生后触发，
  // 借此同步 taskInfo、刷新撤销/重做按钮，并把最新画布序列化进 formDataLocal（驱动脏检测）
  eventBus.on('commandStack.changed', () => {
    refreshCanvasState()
  })
  updateCommandState()

  // modeler 初始化完成，通知 Vue 重渲染
  modelerReady.value = true

  // 为手风琴 palette 挂载收起按钮
  setupPaletteCollapse()
}

/**
 * 外部主动调用：用新的 formData 覆盖本地 state 并重新加载流程图。
 * 常用于弹窗重用、组件未销毁时切换流程数据等场景。
 */
async function loadFormData(newFormData) {
  if (!newFormData) return
  await applyFormData(newFormData)
  // 主动更新数据后重置快照，消除脏标记
  savedSnapshot.value = { ...formDataLocal.value }
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
    // 标签元素只是可视化注释，不是流程语义节点；它们会共享目标元素的 businessObject，
    // 若不跳过，会把连线标签误当成流程节点并生成多余 taskInfo 条目。
    if (element.labelTarget || element.type === 'label') return
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
 * - 已存在的条目保留其自定义属性值，并同步画布标准属性（name），
 *   使画布上双击改名等操作能实时反映到属性面板
 * - 元素类型被替换（id 相同 $type 变化，如 UserTask → ServiceTask）时重建条目，避免残留重复 id 的旧条目
 */
function syncTaskInfo() {
  if (!modeler) return parseTaskInfo()
  const nodes = collectFlowNodes()
  const ids = nodes.map(({ bo }) => bo.id)
  // 基于 formData 中的 taskInfo 构建新的数组，避免原地修改导致不一致
  let current = parseTaskInfo()
  // 删除已被移除的节点条目
  current = current.filter((t) => ids.includes(t.id))
  // 追加或更新节点条目；保持不可变赋值
  nodes.forEach(({ bo }) => {
    const idx = current.findIndex((t) => t.id === bo.id)
    if (idx !== -1) {
      const existing = current[idx]
      if (existing.$type !== bo.$type) {
        // 类型替换：用新条目替换
        current = current.filter((t) => t.id !== bo.id)
        current.push(defaultTaskInfoEntry(bo))
      } else {
        // 同步标准属性（name）
        const updated = { ...existing, name: bo.name || '' }
        current = current.slice()
        current[idx] = updated
      }
    } else {
      current = current.slice()
      current.push(defaultTaskInfoEntry(bo))
    }
  })

  return current // 不直接赋给 taskInfo.value，只返回对齐后的纯数组，不触发 v-model:form-data 的 setter，避免重复 emit
}

/**
 * 画布发生编辑（或重新导入）后刷新实时状态：
 * - 同步 taskInfo 与撤销/重做按钮
 * - 把最新 bpmn / taskInfo 序列化进 formDataLocal，使 isDirty 直接对比"实时状态 vs 保存快照"，
 *   撤销回原状时脏标记也能正确清除
 */
let canvasEditSeq = 0
async function refreshCanvasState() {
  if (!modeler) return
  const seq = ++canvasEditSeq
  
  // A. 获取节点对齐数据
  const nextTaskInfo = syncTaskInfo()
  updateCommandState()

  // B. 异步生成最新的 BPMN XML
  const { xml } = await modeler.saveXML({ format: true })
  // 丢弃并发编辑时较早的序列化结果，避免旧 XML 覆盖新状态
  if (seq !== canvasEditSeq) return

  // C. 【一次性合并更新】并发出【唯一一次 emit】
  const updatedFormData = {
    ...formDataLocal.value,
    bpmn: xml,
    taskInfo: JSON.stringify(nextTaskInfo)
  }
  
  formDataLocal.value = updatedFormData
  emit('update:formData', updatedFormData) // 👈 保证了 bpmn 与 taskInfo 数据的绝对同步，且只触发一次
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
  const arr = parseTaskInfo()
  const idx = arr.findIndex((t) => t.id === bo.id && t.$type === bo.$type)
  if (idx === -1) return
  const updated = { ...arr[idx], [key]: value }
  arr[idx] = updated
  taskInfo.value = arr
  if (key === 'name') {
    // 走 modeling.updateProperties 让节点标签刷新并进入撤销栈（其后 commandStack.changed 会刷新实时状态）
    modeler.get('modeling').updateProperties(element, { name: value })
  }
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
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
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
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
    '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M14 2v4M8 10v4M16 18v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
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

/**
 * 自动布局：利用 bpmn-auto-layout 对流程 XML 重新排版，再重新导入画布。
 * - 先把画布当前状态序列化为 XML
 * - layoutProcess 会整体重算所有节点/连线的坐标（元素 id 与扩展属性均保留）
 * - 重新导入后同步 taskInfo（按 id 匹配，自定义属性不丢失），并自适应缩放
 */
async function autoLayout() {
  if (!modeler) return
  try {
    // 懒加载自动布局库（体积较大，只用到时才加载）
    if (!layoutProcess) {
      const mod = await import('bpmn-auto-layout')
      layoutProcess = mod.layoutProcess
    }
    const { xml } = await modeler.saveXML({ format: true })
    const laidOutXml = await layoutProcess(xml)
    await modeler.importXML(laidOutXml)
    // 重新导入会重建元素实例，且命令栈被 clear(false) 清空、不会触发 commandStack.changed，
    // 这里手动刷新实时状态（taskInfo 对齐、撤销/重做按钮、formDataLocal 的 bpmn/taskInfo）
    await refreshCanvasState()
    const canvas = modeler.get('canvas')
    canvas.resized()
    canvas.zoom('fit-viewport', 'auto')
  } catch (err) {
    console.error('自动布局失败:', err)
  }
}

// 一键收起/展开所有面板（左侧工具栏 + 右侧属性面板）
function toggleAllPanels() {
  const palette = modeler.get('palette')
  const paletteOpen = palette && palette.isOpen()
  if (paletteOpen || panelVisible.value) {
    // 收起所有面板
    if (paletteOpen) palette.close()
    panelVisible.value = false
    allPanelsCollapsed.value = true
  } else {
    // 展开所有面板
    palette.open()
    panelVisible.value = true
    allPanelsCollapsed.value = false
  }
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
  canvas.resized()
  canvas.zoom('fit-viewport', 'auto')
}

/**
 * 组装最终落库的 formBean：
 * - taskInfo：节点属性 JSON 字符串（唯一数据源）
 * - processBarInfo 为进度条信息，默认空数组，由业务侧填充
 */
// function buildFormBean(extra = {}) {
//   return {
//     workflowCode: '',
//     workflowName: '',
//     workflowType: 'W',
//     publishedFlag: '1',
//     workflowParam: '',
//     modelId: '',
//     version: '',
//     newFlag: '',
//     processBarInfo: [],
//     ...formDataLocal.value,
//     taskInfo: JSON.stringify(taskInfo.value),
//     ...extra // extra 覆盖前面字段
//   }
// }

/**
 * 保存流程：把画布上的所有改动序列化回 BPMN XML，组装 formBean 并通过 v-model:form-data
 * 同步全部数据（表单元数据 + bpmn + taskInfo），saved 事件仅作为保存完成通知
 * saveXML 是 importXML 的逆操作
 */
async function save(extra = {}) {
  if (!modeler) return
  isSaving.value = true
  try {
    // v-model:form-data 已经实时同步了 bpmn/taskInfo，保存时无需再调用 saveXML 重新序列化
    // const { xml } = await modeler.saveXML({ format: true }) // format: 格式化缩进
    // formDataLocal.value.bpmn = xml
    // const bean = buildFormBean(extra)
    // formDataLocal.value = { ...formDataLocal.value, ...bean }
    // 把保存结果合并进本地状态并记录快照，保证保存后 isDirty 立即为 false
    savedSnapshot.value = { ...formDataLocal.value }
    // emit('update:formData', bean)
    emit('saved')
  } catch (err) {
    console.error('保存失败:', err)
  } finally {
    isSaving.value = false
  }
}

// 下载导出
async function download(type) {
  if (type === 'xml') {
    const { xml } = await modeler.saveXML({ format: true })
    downloadBlob(new Blob([xml], { type: 'application/xml' }), 'diagram.bpmn')
  } else {
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
  await initModeler()
})


// 组件销毁时释放 modeler 实例，避免内存泄漏和事件残留
onBeforeUnmount(() => {
  if (modeler) modeler.destroy()
})

// 暴露给父组件调用的方法
defineExpose({ save, download, undo, redo, autoLayout, taskInfo, loadFormData })
</script>

<template>
  <div class="bpmn-page">
    <ModelerToolbar
      :title="formDataLocal.workflowName || '流程设计器'"
      :modeler-ready="modelerReady"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :is-saving="isSaving"
      :is-dirty="isDirty"
      :all-panels-collapsed="allPanelsCollapsed"
      @undo="undo"
      @redo="redo"
      @layout="autoLayout"
      @zoom-out="zoomOut"
      @zoom-in="zoomIn"
      @reset-zoom="resetZoom"
      @toggle-panels="toggleAllPanels"
      @download="download"
      @save="save"
    />
    <div class="bpmn-body">
      <div class="bpmn-canvas" ref="canvasRef"></div>
      <PropertyPanel
        v-if="modelerReady"
        :element="activeElement"
        :task-info="taskInfo"
        v-model:form-data="formDataModel"
        :collapsed="!panelVisible"
        @change="onTaskInfoChange"
        @close="panelVisible = false"
        @expand="panelVisible = true"
      />
    </div>
  </div>
</template>

<style scoped>
.bpmn-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
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
  height: 36px;
  padding: 0 6px 0 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid #e5e7eb;
}

.djs-accordion-palette.open {
  width: 160px;
  border-radius: 6px;
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
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  line-height: 1;
  transition: border-color 0.15s, color 0.15s, background-color 0.15s;
}

.djs-accordion-palette-collapse:hover {
  border-color: #10b981;
  color: #10b981;
  background: #f0fdf4;
}

/* 收起后收缩成一个小手柄，点击重新展开 */
.djs-accordion-palette.djs-palette:not(.open) {
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  background-color: #fff;
}

.djs-accordion-palette-handle {
  display: none;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #374151;
  transition: color 0.15s;
}

.djs-accordion-palette.djs-palette:not(.open) .djs-accordion-palette-handle {
  display: flex;
}

.djs-accordion-palette-handle:hover {
  color: #10b981;
}
</style>
