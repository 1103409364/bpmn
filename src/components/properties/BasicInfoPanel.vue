<script setup>
// 基础信息编辑器组件：未选中任何流程节点时，默认展示并编辑流程表单元数据。
// 字段通过 change 事件抛给父组件（父组件负责更新 formData 并同步回 formBean）
const props = defineProps({
  formData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['change'])

const FIELDS = [
  { key: 'workflowCode', label: '流程代码' },
  { key: 'workflowName', label: '流程名称' },
  { key: 'workflowType', label: '流程类型' },
  { key: 'publishedFlag', label: '发布标志' },
  { key: 'workflowParam', label: '流程参数' },
  { key: 'modelId', label: '模型ID' },
  { key: 'version', label: '版本号' },
  { key: 'newFlag', label: '新建标志' }
]

function updateField(key, value) {
  emit('change', { key, value })
}
</script>

<template>
  <div class="basicinfo-panel">
    <div class="basicinfo-head">基础信息</div>
    <div class="basicinfo-fields">
      <div v-for="field in FIELDS" :key="field.key" class="basicinfo-field">
        <label class="basicinfo-label">{{ field.label }}</label>
        <input
          class="basicinfo-input"
          :value="formData[field.key] ?? ''"
          @input="updateField(field.key, $event.target.value)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.basicinfo-panel {
  padding: 12px 16px;
}

.basicinfo-head {
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.basicinfo-fields {
  padding-top: 12px;
}

.basicinfo-field {
  margin-bottom: 12px;
}

.basicinfo-field:last-child {
  margin-bottom: 0;
}

.basicinfo-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.basicinfo-input {
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

.basicinfo-input:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}
</style>
