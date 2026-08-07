<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'
import initialXml from '../assets/bpmn/initial.bpmn?raw'

const props = defineProps({
  xml: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['command-stack-changed', 'saved', 'exported'])

const canvasRef = ref(null)
const panelRef = ref(null)
let modeler = null
let bpmnXml = ''

const activeElement = ref(null)
const elementId = ref('')
const elementType = ref('')
const canUndo = ref(false)
const canRedo = ref(false)
const isSaving = ref(false)

async function initModeler() {
  const { BpmnPropertiesPanelModule, BpmnPropertiesPanelProvider } = await import(
    'bpmn-js-properties-panel'
  )
  const { default: camundaModdle } = await import('camunda-bpmn-moddle/resources/camunda.json')

  modeler = new BpmnModeler({
    container: canvasRef.value,
    propertiesPanel: {
      parent: panelRef.value
    },
    additionalModules: [BpmnPropertiesPanelModule],
    moddleExtensions: {
      camunda: camundaModdle
    }
  })

  try {
    await modeler.importXML(props.xml || initialXml)
  } catch (err) {
    console.error('导入流程失败:', err)
  }

  const canvas = modeler.get('canvas')
  canvas.zoom('fit-viewport')

  const eventBus = modeler.get('eventBus')
  eventBus.on('selection.changed', ({ newSelection }) => {
    const element = newSelection && newSelection[0]
    if (element) {
      activeElement.value = element
      elementId.value = element.id
      elementType.value = element.businessObject?.$type || ''
    } else {
      activeElement.value = null
      elementId.value = ''
      elementType.value = ''
    }
  })

  eventBus.on('commandStack.changed', () => {
    updateCommandState()
    emit('command-stack-changed')
  })
  updateCommandState()
}

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
  canvas.zoom({ x: 0, y: 0 }, Math.min(2, canvas.zoom() + 0.2))
}

function zoomOut() {
  const canvas = modeler.get('canvas')
  canvas.zoom({ x: 0, y: 0 }, Math.max(0.2, canvas.zoom() - 0.2))
}

function resetZoom() {
  modeler.get('canvas').zoom('fit-viewport')
}

async function save() {
  if (!modeler) return
  isSaving.value = true
  try {
    const { xml } = await modeler.saveXML({ format: true })
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

async function download(type) {
  if (type === 'xml') {
    if (!bpmnXml) await save()
    downloadBlob(new Blob([bpmnXml], { type: 'application/xml' }), 'diagram.bpmn')
  } else {
    const { svg } = await modeler.saveSVG()
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'diagram.svg')
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await nextTick()
  initModeler()
})

onBeforeUnmount(() => {
  if (modeler) modeler.destroy()
})

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
      <div class="bpmn-panel" v-show="modeler">
        <template v-if="activeElement">
          <div class="bpmn-panel-head">
            <div class="bpmn-panel-title">{{ elementType.replace('bpmn:', '') }}</div>
            <div class="bpmn-panel-id">{{ elementId }}</div>
          </div>
          <div class="bpmn-panel-body" ref="panelRef"></div>
        </template>
        <div v-else class="bpmn-panel-empty">选择一个元素查看属性</div>
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

.bpmn-panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: #9ca3af;
  font-size: 13px;
}
</style>

<style>
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
