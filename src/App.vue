<script setup>
import { ref } from 'vue'
import BpmnModeler from './components/BpmnModeler.vue'
// ?raw 把示例流程 XML 以纯文本导入，作为设计器初始内容
import initialXml from './assets/bpmn/initial.bpmn?raw'

// 子组件实例引用：可通过 modelerRef.value.save() 等方式调用组件暴露的方法
const modelerRef = ref(null)
// 保存成功后返回的流程 XML
const savedXml = ref('')
// 页面右上角的轻提示文案，空字符串表示不显示
const toast = ref('')

let toastTimer = null

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2500)
}

// 监听子组件 saved 事件：拿到序列化后的流程 XML
function onSaved(xml) {
  savedXml.value = xml
  showToast('流程保存成功')
}

// 监听 command-stack-changed：画布内容有改动时提醒用户保存
function onCommandChanged() {
  showToast('已变更，请记得保存')
}
</script>

<template>
  <div class="flow-page">
    <BpmnModeler
      ref="modelerRef"
      :xml="initialXml"
      title="BPMN 流程设计器"
      @saved="onSaved"
      @command-stack-changed="onCommandChanged"
    />
    <div v-if="savedXml" class="flow-info">
      已保存的流程定义大小: {{ (savedXml.length / 1024).toFixed(1) }} KB
    </div>
    <transition name="fade">
      <div v-if="toast" class="flow-toast">{{ toast }}</div>
    </transition>
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

.flow-toast {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  padding: 8px 16px;
  background: #10b981;
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
