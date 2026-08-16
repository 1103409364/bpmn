// 自定义元素 API 适配层
//
// 约定：本层只负责把后端数据拉回来，并统一转换成
//   { list: Array<{ id, name, type, group?, iconClass?, options?, businessData? }>, total: number }
// 交给 palette 分页使用。
// list 元素字段：
//   id           唯一标识（必填）
//   name         显示名称（必填）
//   type         要创建的 BPMN 类型，如 'bpmn:UserTask'（必填）
//   group        所属分组名，作为 palette 分组标题；缺省时归入 modeler 配置的 groupName（可选）
//   iconClass    图标 CSS 类，不传则按 type 兜底映射到 bpmn-font 图标（可选）
//   options      创建元素时的额外属性（可选，如 camunda 扩展属性）
//   businessData 业务数据对象，创建元素时写入 businessObject（可选，示例字段 busId）

const MOCK_TOTAL = 25
const MOCK_TYPES = [
  'bpmn:UserTask',
  'bpmn:ServiceTask',
  'bpmn:ScriptTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:ManualTask',
  'bpmn:BusinessRuleTask',
  'bpmn:CallActivity',
  'bpmn:SubProcess',
  'bpmn:TextAnnotation'
]
const MOCK_NAMES = ['审批', '校验', '通知', '抄送', '归档', '分派', '驳回', '回退', '抽取', '汇总']
// 模拟元素分布在多个分组（真实后端按各自业务字段返回 group）
const MOCK_GROUPS = ['基础节点', '业务节点', '审批组件', '集成服务']

function mockFetchCustomElements({ page, pageSize, keyword }) {
  const kw = String(keyword || '').trim().toLowerCase()
  const all = Array.from({ length: MOCK_TOTAL }, (_, i) => {
    const type = MOCK_TYPES[i % MOCK_TYPES.length]
    const seq = i + 1
    return {
      id: 'ce-' + seq,
      name: MOCK_NAMES[i % MOCK_NAMES.length] + '任务' + seq,
      type,
      group: MOCK_GROUPS[i % MOCK_GROUPS.length],
      // 示例业务数据：创建元素时会写入元素的 businessObject
      businessData: { busId: 'BUS-' + seq }
    }
  })

  // 名称模糊过滤（模拟后端 keyword 参数）
  const filtered = kw ? all.filter((it) => it.name.toLowerCase().includes(kw)) : all

  const start = (page - 1) * pageSize
  return {
    list: filtered.slice(start, start + pageSize),
    total: filtered.length
  }
}

/**
 * 分页拉取自定义元素。
 * 参数：{ page, pageSize, keyword }，keyword 为名称模糊搜索关键字（可为空串）。
 * 返回 Promise<{ list, total }>。
 *
 * 真实接入示例（把 mock 换成后端请求，字段不一致时在此处映射）：
 * ```
 * return http.get('/api/custom-elements', { params: { page, pageSize, keyword } }).then((res) => {
 *   const { records, total } = res.data
 *   return {
 *     list: records.map((r) => ({
 *       id: r.id,
 *       name: r.name,
 *       type: r.type,
 *       group: r.category, // 后端分组字段名不一致时在此映射
 *       iconClass: r.iconClass,
 *       businessData: { busId: r.busId } // 业务数据写入 businessObject
 *     })),
 *     total
 *   }
 * })
 * ```
 */
export function fetchCustomElements({ page, pageSize, keyword }) {
  return Promise.resolve(mockFetchCustomElements({ page, pageSize, keyword }))
}
