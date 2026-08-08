<script setup>
import { ref, onMounted } from 'vue'
import BpmnModeler from './components/BpmnModeler.vue'
import Toast from './components/toast/Toast.vue'
import { useToast } from './composables/useToast.js'
// ?raw 表示 Vite 把 .bpmn 文件当纯文本字符串导入（不经过打包处理） 把示例流程 XML 以纯文本导入，作为设计器初始内容
import defaultBpmn from './assets/bpmn/default.bpmn?raw'
import testXml from './assets/bpmn/initial.bpmn?raw'

// 子组件实例引用：可通过 modelerRef.value.save() 等方式调用组件暴露的方法
const modelerRef = ref(null)

// 单一数据源：流程表单元数据 + bpmn + taskInfo，供数据库落库。 saved 事件后用最新序列化结果整体替换
const formBean = ref({
  workflowCode: 'DEMO',
  workflowName: '请假审批流程',
  workflowType: 'W',
  publishedFlag: '1',
  bpmn: defaultBpmn,
  taskInfo: '[]'
})
// 页面右上角的轻提示（渲染在 <Toast /> 中，这里只取触发函数）
const { showToast } = useToast()

// 监听子组件 saved 事件：保存完成通知（数据已由 v-model:form-data 自动同步）
function onSaved() {
  showToast('流程保存成功')
}

// 模拟异步加载：组件挂载后通过定时器模拟从后端获取数据并调用子组件的 loadFormData
onMounted(() => {
  setTimeout(() => {
    const asyncData = {
      workflowCode: 'ASYNC',
      workflowName: '异步加载流程示例',
      workflowType: 'W',
      publishedFlag: '1',
      bpmn: testXml,
      taskInfo: '[]'
    }
    // loadFormData 触发 v-model:form-data 的更新，taskInfo 计算属性 set 触发
     modelerRef.value?.loadFormData(asyncData)
    showToast('异步加载完成')
  }, 2500)
})
</script>

<template>
  <div class="flow-page">
    <BpmnModeler
      ref="modelerRef"
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
