import { createRouter, createWebHashHistory } from 'vue-router'
import BpmnApp from '../views/BpmnApp.vue'
import Tree from '../views/Tree.vue'

const routes = [
  { path: '/', redirect: '/bpmn' },
  {
    path: '/bpmn',
    name: 'BpmnApp',
    component: BpmnApp
  },
  {
    path: '/tree',
    name: 'Tree',
    component: Tree
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
