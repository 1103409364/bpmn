<script setup>
import { ref } from 'vue'
import BpmnModeler from './components/BpmnModeler.vue'
import initialXml from './assets/bpmn/initial.bpmn?raw'

const modelerRef = ref(null)
const savedXml = ref('')
const toast = ref('')

let toastTimer = null

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2500)
}

function onSaved(xml) {
  savedXml.value = xml
  showToast('流程保存成功')
}

function onCommandChanged() {
  showToast('已变更，请记得保存')
}
</script>

<template>
  <div class="flow-page">
    <BpmnModeler
      ref="modelerRef"
      :xml="initialXml"
      title="请假审批流程"
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
