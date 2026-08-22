import CustomRenderer from './CustomRenderer'

// diagram-js 模块定义：__init__ 保证 renderer 在模型初始化时被实例化并注册到事件总线
export const customRendererModule = {
  __init__: ['customRenderer'],
  customRenderer: ['type', CustomRenderer]
}

export default CustomRenderer
