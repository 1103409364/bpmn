import { createRouter, createWebHashHistory } from 'vue-router'
import BpmnDesigner from '../views/BpmnDesigner.vue'
import LogicTree from '../views/LogicTree.vue'
import CmdDemo from '../views/CmdDemo.vue'
import TimelineDemo from '../views/TimelineDemo.vue'

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
  },
  {
    path: '/cm-demo',
    name: 'CmdDemo',
    component: CmdDemo
  },
  {
    path: '/timeline-demo',
    name: 'TimelineDemo',
    component: TimelineDemo
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
