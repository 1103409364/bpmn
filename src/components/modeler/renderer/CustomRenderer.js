import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer'
import { is } from 'bpmn-js/lib/util/ModelUtil'

/**
 * 自定义展示文字规则：返回该元素在画布上实际渲染的文字。
 *
 * 原理：bpmn-js 的内嵌标签（Task / ServiceTask / SubProcess 等图形内部文字）
 * 由 BpmnRenderer.renderEmbeddedLabel 在绘制时直接读取 businessObject.name，
 * 没有开放的"标签内容"钩子；外置标签（事件/网关/连线）走 util/LabelUtil#getLabel。
 * 因此想改展示内容，标准做法是注册一个比默认 BpmnRenderer（priority=1000）
 * 优先级更高的自定义 Renderer，在绘制阶段接管：
 * - canRender 返回 true 的元素由本类绘制（其余仍交给默认渲染器）
 * - drawShape 里临时把 businessObject.name 替换为自定义文字，
 *   复用 BpmnRenderer 完整的默认绘制（圆角矩形 + 图标 + 文字排版），绘完立即还原
 *
 * 返回 null 表示"不干预"，该元素回落到默认渲染器按 name 展示。
 */
function getDisplayText(element) {
  const bo = element.businessObject
  if (!bo || element.type === 'label') return null

  // ====== 在这里扩展你的自定义展示规则 ======

  // 示例：ServiceTask 图标内展示 "name(busId)"，busId 取自 $attrs 扩展属性
  if (is(bo, 'bpmn:ServiceTask') && bo.$attrs && bo.$attrs.busId) {
    return `${bo.name || ''}(${bo.$attrs.busId})`
  }

  // 例 2：也可以从 taskInfo 数据源取字段展示（需自行注入或查询）

  return null
}

export default class CustomRenderer extends BaseRenderer {
  // didi 注入器优先读取 fn.$inject，静态字段写法与原型式赋值等价
  static $inject = ['eventBus', 'bpmnRenderer']

  constructor(eventBus, bpmnRenderer) {
    // priority=2000 高于默认 BpmnRenderer 的 1000，canRender 命中时优先采用本类的绘制结果
    super(eventBus, 2000)

    this._bpmnRenderer = bpmnRenderer
  }

  canRender(element) {
    return !!getDisplayText(element)
  }

  drawShape(parentGfx, element) {
    const bo = element.businessObject
    const original = bo.name

    // 渲染是同步过程：临时替换 name 让默认渲染器按自定义文字排版，完成后立即还原，
    // 这样不复制任何绘制代码，图标/边框/颜色/字体全部与原生一致
    bo.name = getDisplayText(element)
    try {
      return this._bpmnRenderer.drawShape(parentGfx, element)
    } finally {
      bo.name = original
    }
  }

  drawConnection(parentGfx, element) {
    // 连线默认不在本类范围内（canRender 已过滤），此处仅做同构委托兜底
    return this._bpmnRenderer.drawConnection(parentGfx, element)
  }

  // canRender 命中的元素也会拦截路径计算事件（用于连线端点定位、隐藏图形、命中检测），必须委托回默认实现
  getShapePath(shape) {
    return this._bpmnRenderer.getShapePath(shape)
  }

  getConnectionPath(connection) {
    return this._bpmnRenderer.getConnectionPath(connection)
  }
}
