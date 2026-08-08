<script setup>
// 轻提示展示组件：HTML + CSS 与状态（useToast 单例）在此封装，
// 业务侧只需调用 useToast().showToast() 触发，无需感知渲染细节
import { useToast } from '../../composables/useToast.js'

const { toast } = useToast()
</script>

<template>
  <transition name="fade">
    <div v-if="toast" class="flow-toast">{{ toast }}</div>
  </transition>
</template>

<style scoped>
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
