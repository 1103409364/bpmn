<script setup>
import { computed } from 'vue'

// 属性编辑器组件：合并了基础信息与节点属性编辑。
// 选中流程节点时展示并编辑该节点的 taskInfo 条目；未选中时展示并编辑流程表单元数据。
// 字段通过 change / form-change 事件抛给父组件（父组件负责同步 taskInfo、formData 与画布）。
const props = defineProps({
  // 当前选中的 bpmn-js 元素；为空表示未选中，展示基础信息
  element: {
    type: Object,
    default: null
  },
  // 流程节点属性数据（唯一数据源）
  taskInfo: {
    type: Array,
    default: () => []
  },
  // 流程表单元数据（未选中节点时编辑）
  formData: {
    type: Object,
    default: () => ({})
  },
  // 面板是否收起（收起时仅显示展开按钮）
  collapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['change', 'form-change', 'close', 'expand'])

// 类型展示名（去掉 bpmn: 前缀）
const typeName = computed(() => (props.element?.businessObject?.$type || '').replace('bpmn:', ''))

// 当前选中元素在 taskInfo 中对应的条目
const entry = computed(() => {
  if (!props.element) return null
  const bo = props.element.businessObject
  return props.taskInfo.find((t) => t.id === bo.id && t.$type === bo.$type) || null
})

// 流程表单元数据字段配置
const BASIC_FIELDS = [
  { key: 'workflowCode', label: '流程代码' },
  { key: 'workflowName', label: '流程名称' },
  { key: 'workflowType', label: '流程类型' },
  { key: 'publishedFlag', label: '发布标志' },
  { key: 'workflowParam', label: '流程参数' },
  { key: 'modelId', label: '模型ID' },
  { key: 'version', label: '版本号' },
  { key: 'newFlag', label: '新建标志' }
]

// 各元素类型可编辑的字段配置
const TASK_FIELDS = {
  'bpmn:StartEvent': [
    { key: 'name', label: '节点名称' },
    { key: 'progressBarName', label: '进度条名称' }
  ],
  'bpmn:UserTask': [
    { key: 'name', label: '节点名称' },
    { key: 'progressBarName', label: '进度条名称' },
    { key: 'executeType', label: '执行方式' },
    { key: 'taskType', label: '任务类型' },
    { key: 'handleStrategy', label: '处理策略' }
  ],
  'bpmn:EndEvent': [
    { key: 'name', label: '节点名称' },
    { key: 'progressBarName', label: '进度条名称' }
  ]
}

const taskFields = computed(() => TASK_FIELDS[entry.value?.$type] || [{ key: 'name', label: '节点名称' }])

function updateField(key, value) {
  emit('change', { key, value })
}

function updateFormField(key, value) {
  emit('form-change', { key, value })
}
</script>

<template>
  <div class="bpmn-panel" :class="{ collapsed }">
    <div class="panel-root">
      <button v-if="collapsed" class="panel-expand" title="展开属性" @click="emit('expand')">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <template v-else>
        <button class="panel-toggle" title="收起" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="panel-head">
          <div class="panel-head-main">
            <template v-if="entry">
              <div class="panel-type">{{ typeName }}</div>
              <div class="panel-id">{{ entry.id }}</div>
            </template>
            <div v-else class="panel-type">基础信息</div>
          </div>
        </div>
        <div class="panel-fields">
          <template v-if="entry">
            <div v-for="field in taskFields" :key="field.key" class="panel-field">
              <label class="panel-label">{{ field.label }}</label>
              <input
                class="panel-input"
                :value="entry[field.key] ?? ''"
                @input="updateField(field.key, $event.target.value)"
              />
            </div>
          </template>
          <template v-else>
            <div v-for="field in BASIC_FIELDS" :key="field.key" class="panel-field">
              <label class="panel-label">{{ field.label }}</label>
              <input
                class="panel-input"
                :value="formData[field.key] ?? ''"
                @input="updateFormField(field.key, $event.target.value)"
              />
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.bpmn-panel {
  position: relative;
  width: 320px;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  overflow-y: auto;
  flex-shrink: 0;
}

.bpmn-panel.collapsed {
  width: 0;
  border-left: none;
  overflow: visible;
}

.panel-root {
  padding: 12px 16px 12px 40px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-head-main {
  min-width: 0;
}

.panel-toggle,
.panel-expand {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 32px;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background-color 0.15s;
}

.panel-toggle {
  left: 8px;
}

.panel-expand {
  right: 12px;
}

.panel-toggle:hover,
.panel-expand:hover {
  border-color: #10b981;
  color: #10b981;
  background: #f0fdf4;
}

.panel-type {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.panel-id {
  margin-top: 2px;
  font-size: 12px;
  color: #9ca3af;
  word-break: break-all;
}

.panel-fields {
  padding-top: 12px;
}

.panel-field {
  margin-bottom: 12px;
}

.panel-field:last-child {
  margin-bottom: 0;
}

.panel-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.panel-input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #111827;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.panel-input:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}
</style>
