import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer'
import { is } from 'bpmn-js/lib/util/ModelUtil'
// tiny-svg 的导出名是 create/append，svgXxx 是 bpmn-js 内部的重命名写法
import { append as svgAppend, create as svgCreate } from 'tiny-svg'

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
  if (is(bo, 'bpmn:ServiceTask')) {
    const busId = bo.$attrs && bo.$attrs.busId
    return busId ? `${bo.name || ''}(${busId})` : (bo.name || '')
  }

  // 例 2：也可以从 taskInfo 数据源取字段展示（需自行注入或查询）

  return null
}

// foreignObject 内嵌 HTML 时必须转义文本，防止 name/busId 含特殊字符破坏结构或 XSS
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch])
}

export default class CustomRenderer extends BaseRenderer {
  // didi 注入器优先读取 fn.$inject，静态字段写法与原型式赋值等价；
  // overlays 是 diagram-js 核心服务（Viewer 也内置），用于在元素上挂交互 HTML（示例三）
  static $inject = ['eventBus', 'bpmnRenderer', 'overlays']

  constructor(eventBus, bpmnRenderer, overlays) {
    // priority=2000 高于默认 BpmnRenderer 的 1000，canRender 命中时优先采用本类的绘制结果
    super(eventBus, 2000)

    this._bpmnRenderer = bpmnRenderer
    this._overlays = overlays
    this._overlayId = null

    // 示例三的入口：选中 ServiceTask 时在其下方挂交互 HTML 按钮
    eventBus.on('selection.changed', ({ newSelection }) => {
      this._updateOverlay(newSelection[0])
    })
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
      const gfx = this._bpmnRenderer.drawShape(parentGfx, element)

      if (is(bo, 'bpmn:ServiceTask')) {
        // 示例一：SVG 徽标（画布本身就是 SVG，可追加任意 SVG 节点，
        // 坐标系为元素本地坐标，(0,0) 即形状左上角；随画布缩放平移）
        this._drawSvgBadge(parentGfx, element)

        // 示例二：foreignObject 内嵌 HTML+CSS（宽高必填；
        // 内容缩放跟随画布，样式走 index.vue 非 scoped 全局块）
        this._drawHtmlChip(parentGfx, element)
      }

      return gfx
    } finally {
      bo.name = original
    }
  }

  /**
   * 示例一：ServiceTask 右上角画一枚徽标（圆角矩形 + busId 文本）。
   * 宽度按文本长度自适应，超长截断（底部 foreignObject 徽签仍显示完整值）。
   */
  _drawSvgBadge(parentGfx, element) {
    const bo = element.businessObject
    const busId = (bo.$attrs && bo.$attrs.busId) || ''

    const MAX_CHARS = 8
    const text = busId.length > MAX_CHARS
      ? `${busId.slice(0, MAX_CHARS)}…`
      : (busId || '无 busId')

    const fontSize = 10
    const height = 14
    const margin = 5
    const paddingX = 6
    // 文本宽度粗估：ASCII 约 0.6 倍字号，中文约 1 倍，取两者混合的保守值
    const textWidth = [...text].reduce(
      (w, ch) => w + (ch.charCodeAt(0) > 255 ? fontSize : fontSize * 0.6),
      0
    )
    const width = Math.ceil(textWidth) + paddingX * 2

    const rect = svgCreate('rect', {
      x: element.width - width - margin,
      y: margin,
      width,
      height,
      rx: height / 2,
      fill: '#10b981',
      stroke: '#fff',
      'stroke-width': 1.2
    })

    const label = svgCreate('text', {
      x: element.width - margin - width / 2,
      y: margin + height / 2,
      fill: '#fff',
      'font-size': fontSize,
      'font-weight': 'bold',
      'text-anchor': 'middle',
      'dominant-baseline': 'central'
    })
    label.textContent = text

    svgAppend(parentGfx, rect)
    svgAppend(parentGfx, label)
  }

  /**
   * 示例二：形状底部内嵌一个 HTML 徽签（chip），展示 busId 扩展属性。
   * foreignObject 是 SVG 与 HTML 的桥梁，浏览器按 HTML 规则解析其子节点。
   */
  _drawHtmlChip(parentGfx, element) {
    const bo = element.businessObject
    const busId = (bo.$attrs && bo.$attrs.busId) || '未设置 busId'

    const foreignObject = svgCreate('foreignObject', {
      x: 8,
      y: element.height - 20,
      width: element.width - 16,
      height: 14
    })
    foreignObject.innerHTML =
      `<div xmlns="http://www.w3.org/1999/xhtml" class="task-chip">${escapeHtml(busId)}</div>`

    svgAppend(parentGfx, foreignObject)
  }

  /**
   * 示例三：用 overlays 服务给选中的 ServiceTask 挂交互按钮。
   * overlays 独立于渲染层、位于交互层之上，HTML 可正常接收点击事件，
   * 且自动跟随元素的移动/缩放/平移；适合放操作按钮、tooltip 等。
   * （对比示例二：foreignObject 收不到鼠标事件，只适合纯展示内容）
   */
  _updateOverlay(element) {
    // 先移除上一次的 overlay（按 id 精确清理，不影响其他模块注册的 overlay）
    if (this._overlayId) {
      this._overlays.remove(this._overlayId)
      this._overlayId = null
    }

    const bo = element && element.businessObject
    if (!bo || !is(bo, 'bpmn:ServiceTask')) return

    const wrap = document.createElement('div')
    wrap.className = 'task-overlay-actions'

    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = '执行日志'
    button.addEventListener('click', () => {
      console.log('[CustomRenderer] overlays 按钮点击:', bo.id, bo.name)
    })
    wrap.appendChild(button)

    // position 相对元素边界定位：bottom:-26 表示整体悬在形状下方 26px 处；
    // 第二个参数是 overlay 类型名，便于按类型批量 remove
    this._overlayId = this._overlays.add(element, 'service-task-actions', {
      html: wrap,
      position: { bottom: -26, left: 0 }
    })
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
