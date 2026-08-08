import { ref } from 'vue'

// 模块级单例状态：App 逻辑与 Toast 组件共享同一个 toast ref，
// 任何地方调用 showToast 都会驱动 Toast.vue 的渲染
const toast = ref('')
let timer = null

/**
 * 轻提示 composable：showToast 展示文案，duration 毫秒后自动消失，
 * 重复调用会重置计时（最新文案覆盖前一条）
 */
export function useToast(duration = 2500) {
  function showToast(msg) {
    toast.value = msg
    clearTimeout(timer)
    timer = setTimeout(() => (toast.value = ''), duration)
  }
  return { toast, showToast }
}
