// 仅使用本地自定义翻译覆盖，否则原文不再替换。
const zhCN = {
  // 对第三方资源不满意或缺失的文案，可在此处直接覆盖对应 key
  'Create expanded sub-process': '创建展开子流程',
  'Create pool/participant': '创建泳道/参与者',

  // 手风琴 palette 的分组名称（summary 通过 translate(entry.group) 渲染）
  'default': '默认',
  'tools': '工具',
  'event': '事件',
  'gateway': '网关',
  'activity': '活动',
  'data-object': '数据对象',
  'data-store': '数据存储',
  'collaboration': '协作',
  'artifact': '工件',
  'custom': '自定义'
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
