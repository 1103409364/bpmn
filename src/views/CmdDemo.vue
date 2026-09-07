<script setup>
import { ref } from 'vue'
import CodeEditor from '@/components/code-editor/index.vue'

// CodeMirror 6 demo：使用封装的 code-editor 组件
const SAMPLES = {
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="开始" />
    <bpmn:userTask id="UserTask_1" name="人工审批">
      <bpmn:incoming>Flow_1</bpmn:incoming>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_1"
      sourceRef="StartEvent_1" targetRef="UserTask_1" />
  </bpmn:process>
</bpmn:definitions>`,
  js: `// 节点条件表达式示例
function evaluateCondition(ctx) {
  const age = ctx.get('age')
  if (age == null) return false
  return age < 30 && ctx.get('approved') === true
}`,
  json: `{
  "id": "UserTask_1",
  "busId": "task-1001",
  "executeType": "AUTO",
  "assignee": { "type": "ROLE", "value": "manager" }
}`,
  // Groovy 脚本示例：流程引擎后端常用的脚本语言（无官方 lang 包，用 legacy-mode 提供高亮）
  groovy: `// 节点脚本示例：审批人计算
def assignee = null
def amount = execution.getVariable("amount")

if (amount != null && amount > 10000) {
  assignee = "senior-manager"          // 大额走高级管理员
} else {
  assignee = "manager"
}

execution.setVariable("preApprover", assignee)
return assignee`
}

const code = ref(SAMPLES.xml)
const lang = ref('xml')
const readOnly = ref(false)

function switchLang(key) {
  code.value = SAMPLES[key]
  lang.value = key
}
</script>

<template>
  <div class="cmd-demo-page">
    <h1>CodeMirror 6 Demo</h1>
    <div class="toolbar">
      <label v-for="(label, key) in { xml: 'XML', js: 'JavaScript', json: 'JSON', groovy: 'Groovy' }" :key="key">
        <input type="radio" :value="key" v-model="lang" @change="switchLang(key)" />
        {{ label }}
      </label>
      <label class="readonly-toggle">
        <span>只读</span>
        <input type="checkbox" v-model="readOnly" />
      </label>
    </div>

    <CodeEditor
      v-model="code"
      :language="lang"
      :read-only="readOnly"
      height="420px"
    />

    <details class="value-preview">
      <summary>当前值 ({{ code.length }} 字符)</summary>
      <pre>{{ code }}</pre>
    </details>
  </div>
</template>

<style scoped>
.cmd-demo-page {
  padding: 24px;
}

h1 {
  margin-bottom: 16px;
  font-size: 18px;
}

.toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 12px;
}

.toolbar label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 14px;
}

.readonly-toggle {
  margin-left: auto;
}

.value-preview {
  display: block;
  max-width: 720px;
  margin-top: 16px;
}

.value-preview pre {
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  max-height: 300px;
  background: #111827;
  color: #e5e7eb;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>