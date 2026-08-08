import CustomPaletteProvider from './CustomPaletteProvider'

// diagram-js 的模块定义：__init__ 保证 provider 被实例化（构造函数中完成注册）
export const paletteModule = {
  __init__: ['customPaletteProvider'],
  customPaletteProvider: ['type', CustomPaletteProvider]
}

export default CustomPaletteProvider
