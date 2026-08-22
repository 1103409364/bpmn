import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// 应用入口：创建 Vue 应用，注册路由并挂载到 index.html 中的 #app 节点
createApp(App).use(router).mount('#app')
