import DefaultCreateBehavior from './DefaultCreateBehavior'

// diagram-js 模块定义：__init__ 保证行为在模型初始化时被实例化并注册到事件总线
export const defaultCreateBehaviorModule = {
  __init__: ['defaultCreateBehavior'],
  defaultCreateBehavior: ['type', DefaultCreateBehavior]
}

export default DefaultCreateBehavior
