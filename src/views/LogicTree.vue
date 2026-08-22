<script setup>
import { ref } from 'vue'
import LogicConditionTree from '../components/logictree/LogicConditionTree.jsx'

// 根节点固定为 GROUP 且不可删除；组与条件可任意嵌套
const tree = ref({
  type: 'GROUP',
  operator: 'OR',
  children: [
    {
      type: 'GROUP',
      operator: 'AND',
      children: [
        {
          type: 'CONDITION',
          field: 'age',
          operator: 'LT',
          value: 30
        }
      ]
    },
    {
      type: 'CONDITION',
      field: 'name',
      operator: 'LT',
      value: 30
    }
  ]
})
</script>

<template>
  <div class="logic-tree-page">
    <h1>LogicTree</h1>
    <LogicConditionTree v-model="tree" is-root />
    <details class="json-preview">
      <summary>查看 JSON</summary>
      <pre>{{ JSON.stringify(tree, null, 2) }}</pre>
    </details>
  </div>
</template>

<style scoped>
.logic-tree-page {
  padding: 24px;
}

h1 {
  margin-bottom: 16px;
  font-size: 18px;
}

.json-preview {
  display: block;
  max-width: 560px;
  margin-top: 16px;
}

.json-preview pre {
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  background: #111827;
  color: #e5e7eb;
  border-radius: 8px;
}
</style>
