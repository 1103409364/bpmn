<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
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
  }
})

const emit = defineEmits(['command-stack-changed', 'saved'])

// 模板 ref：modeler 的容器(canvas)和属性面板挂载点(panel)由 Vue 渲染出来，再用原生 DOM 交给 bpmn-js
const canvasRef = ref(null)
const panelRef = ref(null)

// modeler 实例必须在 DOM 挂载后才创建，所以不能用 ref 包裹，用普通变量存即可
let modeler = null
// 保存后的流程 XML 字符串
let bpmnXml = ''

// 当前选中的元素信息（用于右侧属性面板头部展示）
const activeElement = ref(null)
const elementId = ref('')
const elementType = ref('')
// 撤销/重做按钮是否可用
const canUndo = ref(false)
const canRedo = ref(false)
const isSaving = ref(false)

/**
 * 初始化 bpmn-js Modeler。
 * 动态 import 两个包：它们体积较大，只在用到时加载，可以减小首屏体积。
 */
async function initModeler() {
  // BpmnPropertiesPanelModule：属性面板模块（additionalModules 注入到 modeler 中）
  const { BpmnPropertiesPanelModule } = await import('bpmn-js-properties-panel')
  // Camunda 的 moddle 扩展定义（JSON）：让属性面板能识别并编辑 camunda:* 扩展属性
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
    propertiesPanel: {
      // parent: 属性面板渲染到哪个 DOM 元素（挂在右侧面板内）
      parent: panelRef.value
    },
    // additionalModules: 额外注册的模块，属性面板本身就是一个模块
    additionalModules: [BpmnPropertiesPanelModule, paletteModule, translateModule, AccordionPaletteModule, gridModule],
    // accordionPalette: 手风琴 palette 的配置
    accordionPalette: {
      showName: false, // 显示工具名称
      accordion: false, // 关闭手风琴模式，允许多个分组同时展开
      defaultOpenGroups: ['tools', 'event', 'gateway', 'activity', 'custom'] // 默认展开的分组
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

  // canvas service：负责图形的缩放、平移、视图定位
  const canvas = modeler.get('canvas')
  // 第二个参数 'auto'：以视口中心为锚点，让整个流程图在画布中居中（缩放上限为 1，小图不会被放大）
  canvas.zoom('fit-viewport', 'auto')

  // eventBus service：bpmn-js 的事件总线，所有交互都通过它发布/订阅事件
  const eventBus = modeler.get('eventBus')

  // selection.changed：选中元素发生变化时触发，newSelection 是当前选中的元素数组
  eventBus.on('selection.changed', ({ newSelection }) => {
    const element = newSelection && newSelection[0]
    if (element) {
      activeElement.value = element
      elementId.value = element.id
      // businessObject: 元素对应的 BPMN 业务模型对象，$type 如 'bpmn:UserTask'
      elementType.value = element.businessObject?.$type || ''
    } else {
      activeElement.value = null
      elementId.value = ''
      elementType.value = ''
    }
  })

  // commandStack.changed：任何编辑操作（增删改）发生后触发，借此刷新撤销/重做按钮
  eventBus.on('commandStack.changed', () => {
    updateCommandState()
    emit('command-stack-changed')
  })
  updateCommandState()

  // 为手风琴 palette 挂载收起按钮：点击收起隐藏，点击左上角手柄重新展开
  setupPaletteCollapse()
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
  modeler.get('canvas').zoom('fit-viewport')
}

/**
 * 保存流程：把画布上的所有改动序列化回 BPMN XML
 * saveXML 是 importXML 的逆操作
 */
async function save() {
  if (!modeler) return
  isSaving.value = true
  try {
    const { xml } = await modeler.saveXML({ format: true }) // format: 格式化缩进
    bpmnXml = xml
    emit('saved', xml)
  } catch (err) {
    console.error('保存失败:', err)
  } finally {
    isSaving.value = false
  }
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

// onMounted 后再初始化：确保 canvasRef/panelRef 对应的 DOM 已经渲染到页面中
onMounted(async () => {
  await nextTick()
  initModeler()
})

// 组件销毁时释放 modeler 实例，避免内存泄漏和事件残留
onBeforeUnmount(() => {
  if (modeler) modeler.destroy()
})

// 暴露给父组件调用的方法
defineExpose({ save, download, getXml, undo, redo })
</script>

<template>
  <div class="bpmn-page">
    <div class="bpmn-header">
      <div class="bpmn-header-left">
        <span class="bpmn-logo">flow</span>
        <span class="bpmn-title">{{ title || '流程设计器' }}</span>
      </div>
      <div class="bpmn-header-right">
        <template v-if="modeler">
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
      <div class="bpmn-panel" v-show="modeler && activeElement">
        <template v-if="activeElement">
          <div class="bpmn-panel-head">
            <div class="bpmn-panel-title">{{ elementType.replace('bpmn:', '') }}</div>
            <div class="bpmn-panel-id">{{ elementId }}</div>
          </div>
          <div class="bpmn-panel-body" ref="panelRef"></div>
        </template>
      </div>
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

.bpmn-panel-head {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.bpmn-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.bpmn-panel-id {
  margin-top: 2px;
  font-size: 12px;
  color: #9ca3af;
  word-break: break-all;
}

.bpmn-panel-body {
  padding: 8px;
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

.djs-accordion-palette.open .djs-accordion-palette-toolbar {
  display: flex;
}

.djs-accordion-palette-title {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
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

.bpmn-panel-body .bio-properties-panel {
  --color-000000: #111827;
  --color-ffffff: #ffffff;
  --color-grey-225-10-15: #374151;
  --color-grey-225-10-35: #6b7280;
  --color-grey-225-10-55: #9ca3af;
  --color-grey-225-10-75: #d1d5db;
  --color-grey-225-10-90: #e5e7eb;
  --color-grey-225-10-95: #f3f4f6;
  --color-blue-205-100-45: #10b981;
  --color-blue-205-100-50: #059669;
  --color-blue-205-100-55: #059669;
  --color-blue-205-100-80: #a7f3d0;
  --color-green-150-50-40: #059669;
  --color-red-360-100-45: #ef4444;
}
</style>
