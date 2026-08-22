import { createRouter, createWebHashHistory } from 'vue-router'
import BpmnApp from '../views/BpmnApp.vue'
import LogicTree from '../views/LogicTree.vue'

const routes = [
  { path: '/', redirect: '/bpmn' },
  {
    path: '/bpmn',
    name: 'BpmnApp',
    component: BpmnApp
  },
  {
    path: '/logic-tree',
    name: 'LogicTree',
    component: LogicTree
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
