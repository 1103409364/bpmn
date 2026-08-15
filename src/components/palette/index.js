import './pagination.css'

import CustomPaletteProvider from './CustomPaletteProvider'
import CustomElementsProvider from './CustomElementsProvider'

// diagram-js 的模块定义：__init__ 保证 provider 被实例化（构造函数中完成注册）
export const paletteModule = {
  __init__: ['customPaletteProvider', 'customElementsProvider'],
  customPaletteProvider: ['type', CustomPaletteProvider],
  customElementsProvider: ['type', CustomElementsProvider]
}

export default CustomPaletteProvider
