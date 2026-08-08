<script setup>
import { computed } from 'vue'

// 属性编辑器组件：接收当前选中的 bpmn-js 元素与 taskInfo 数组，
// 通过 element.id + element.$type 找到对应条目并渲染可编辑字段，
// 任何修改通过 change 事件抛给父组件（父组件负责同步 taskInfo 与画布）。
const props = defineProps({
  // 当前选中的 bpmn-js 元素
  element: {
    type: Object,
    default: null
  },
  // 流程节点属性数据（唯一数据源）
  taskInfo: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['change'])

// 类型展示名（去掉 bpmn: 前缀）
const typeName = computed(() => (props.element?.businessObject?.$type || '').replace('bpmn:', ''))

// 当前选中元素在 taskInfo 中对应的条目
const entry = computed(() => {
  if (!props.element) return null
  const bo = props.element.businessObject
  return props.taskInfo.find((t) => t.id === bo.id && t.$type === bo.$type) || null
})

// 各元素类型可编辑的字段配置
const FIELDS = {
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

const fields = computed(() => FIELDS[entry.value?.$type] || [{ key: 'name', label: '节点名称' }])

function updateField(key, value) {
  emit('change', { key, value })
}
</script>

<template>
  <div class="taskinfo-panel">
    <template v-if="entry">
      <div class="taskinfo-head">
        <div class="taskinfo-type">{{ typeName }}</div>
        <div class="taskinfo-id">{{ entry.id }}</div>
      </div>
      <div class="taskinfo-fields">
        <div v-for="field in fields" :key="field.key" class="taskinfo-field">
          <label class="taskinfo-label">{{ field.label }}</label>
          <input
            class="taskinfo-input"
            :value="entry[field.key] ?? ''"
            @input="updateField(field.key, $event.target.value)"
          />
        </div>
      </div>
    </template>
    <div v-else class="taskinfo-empty">该元素暂无属性配置</div>
  </div>
</template>

<style scoped>
.taskinfo-panel {
  padding: 12px 16px;
}

.taskinfo-head {
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.taskinfo-type {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.taskinfo-id {
  margin-top: 2px;
  font-size: 12px;
  color: #9ca3af;
  word-break: break-all;
}

.taskinfo-fields {
  padding-top: 12px;
}

.taskinfo-field {
  margin-bottom: 12px;
}

.taskinfo-field:last-child {
  margin-bottom: 0;
}

.taskinfo-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.taskinfo-input {
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

.taskinfo-input:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.taskinfo-empty {
  padding: 16px;
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
}
</style>
