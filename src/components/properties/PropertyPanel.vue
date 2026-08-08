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
  }
})

const emit = defineEmits(['change', 'form-change'])

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
  <div class="panel-root">
    <template v-if="entry">
      <div class="panel-head">
        <div class="panel-type">{{ typeName }}</div>
        <div class="panel-id">{{ entry.id }}</div>
      </div>
      <div class="panel-fields">
        <div v-for="field in taskFields" :key="field.key" class="panel-field">
          <label class="panel-label">{{ field.label }}</label>
          <input
            class="panel-input"
            :value="entry[field.key] ?? ''"
            @input="updateField(field.key, $event.target.value)"
          />
        </div>
      </div>
    </template>
    <template v-else>
      <div class="panel-head">基础信息</div>
      <div class="panel-fields">
        <div v-for="field in BASIC_FIELDS" :key="field.key" class="panel-field">
          <label class="panel-label">{{ field.label }}</label>
          <input
            class="panel-input"
            :value="formData[field.key] ?? ''"
            @input="updateFormField(field.key, $event.target.value)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.panel-root {
  padding: 12px 16px;
}

.panel-head {
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
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
