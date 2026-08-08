import bpmnZh from 'bpmn-js-i18n-zh/lib/bpmn-js'
import propertiesPanelZh from 'bpmn-js-i18n-zh/lib/properties-panel'
import camundaPropertiesPanelZh from 'bpmn-js-i18n-zh/lib/camunda-properties-panel'

// 合并 bpmn-js、属性面板、Camunda 属性面板的中文翻译资源。
// bpmn-js 通过注入的 translate 服务取文案，这里用自定义模块覆盖默认 translate，
// 未命中的 key 原样返回并照常做 {key} 占位符替换。
const zhCN = {
  ...bpmnZh,
  ...propertiesPanelZh,
  ...camundaPropertiesPanelZh,

  // 对第三方资源不满意或缺失的文案，可在此处直接覆盖对应 key
  'Create expanded sub-process': '创建展开子流程',
  'Create pool/participant': '创建泳道/参与者'
}

/**
 * 自定义 translate：先查翻译表，再执行 {key} 占位符替换。
 */
export default function customTranslate(template, replacements) {
  replacements = replacements || {}

  template = zhCN[template] || template

  return template.replace(/{([^}]+)}/g, function (_, key) {
    return replacements[key] || '{' + key + '}'
  })
}
