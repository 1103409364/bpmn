import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // 让 Vite 把 *.bpmn 当作可导入的文本资源处理，
  // 配合 `?raw` 后缀即可在 JS 里直接拿到流程 XML 字符串（见 BpmnModeler.vue 中的导入）。
  // 若不配置，import xx.bpmn 会被当作普通模块解析而导致报错。
  assetsInclude: ['**/*.bpmn'],
  worker: {
    format: 'es'
  }
})
