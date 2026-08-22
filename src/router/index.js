import { createRouter, createWebHashHistory } from 'vue-router'
import BpmnDesigner from '../views/BpmnDesigner.vue'
import LogicTree from '../views/LogicTree.vue'

const routes = [
  { path: '/', redirect: '/bpmn' },
  {
    path: '/bpmn',
    name: 'BpmnDesigner',
    component: BpmnDesigner
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
