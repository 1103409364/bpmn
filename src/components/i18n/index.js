import customTranslate from './customTranslate'

// diagram-js 模块定义：用自定义翻译函数覆盖默认的 translate 服务
export const translateModule = {
  translate: ['value', customTranslate]
}
