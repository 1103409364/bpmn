<script setup>
import { ref } from 'vue'
import BpmnModeler from './components/BpmnModeler.vue'
import Toast from './components/toast/Toast.vue'
import { useToast } from './composables/useToast.js'
// ?raw 表示 Vite 把 .bpmn 文件当纯文本字符串导入（不经过打包处理） 把示例流程 XML 以纯文本导入，作为设计器初始内容
import initialXml from './assets/bpmn/initial.bpmn?raw'

// 子组件实例引用：可通过 modelerRef.value.save() 等方式调用组件暴露的方法
const modelerRef = ref(null)
// 单一数据源：流程表单元数据 + bpmn + taskInfo，供数据库落库。
// 初始化时 bpmn 取 initialXml，taskInfo 为空数组 JSON；saved 事件后用最新序列化结果整体替换
const formBean = ref({
  workflowCode: 'DEMO',
  workflowName: '请假审批流程',
  workflowType: 'W',
  publishedFlag: '1',
  bpmn: initialXml,
  taskInfo: '[]'
})
// 页面右上角的轻提示（渲染在 <Toast /> 中，这里只取触发函数）
const { showToast } = useToast()

// 监听子组件 saved 事件：保存完成通知（数据已由 v-model:form-data 自动同步）
function onSaved() {
  showToast('流程保存成功')
}
</script>

<template>
  <div class="flow-page">
    <BpmnModeler
      ref="modelerRef"
      :xml="formBean.bpmn"
      :title="formBean.workflowName"
      v-model:form-data="formBean"
      @saved="onSaved"
    />
    <div v-if="formBean.bpmn" class="flow-info">
      流程 XML: {{ (formBean.bpmn.length / 1024).toFixed(1) }} KB /
      taskInfo: {{ (formBean.taskInfo.length / 1024).toFixed(1) }} KB
    </div>
    <Toast />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Microsoft YaHei', sans-serif;
}

.flow-page {
  height: 100%;
}

.flow-info {
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: 100;
  padding: 6px 12px;
  background: rgba(17, 24, 39, 0.8);
  color: #fff;
  border-radius: 6px;
  font-size: 12px;
}

.custom-icon-test {
  background-image: url('./assets/vite.svg');
  background-size: 100% 100%;
}
</style>
