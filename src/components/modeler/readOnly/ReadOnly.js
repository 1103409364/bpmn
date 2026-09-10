/**
 * 只读模式模块：拦截所有编辑类操作（拖拽、创建、连线、缩放、双击编辑），
 * 并隐藏 Palette / ContextPad，使画布处于纯查看状态。
 *
 * 通过 setReadOnly(true/false) 切换状态，内部发布 readOnly.changed 事件
 * 供外部组件（如属性面板）响应只读状态变化。
 */
function ReadOnly(eventBus, contextPad, palette, directEditing) {
  this._readOnly = false

  const self = this

  // 设置/切换只读状态，对外发布事件
  this.setReadOnly = function (readOnly) {
    self._readOnly = readOnly
    eventBus.fire('readOnly.changed', { readOnly })
  }

  this.isReadOnly = function () {
    return self._readOnly
  }

  // 拦截编辑类操作：高优先级确保在其他处理器之前执行
  const intercept = function (event) {
    if (self._readOnly) {
      event.stopPropagation()
      event.preventDefault()
    }
  }

  // 阻止双击直接编辑文字
  eventBus.on('element.dblclick', 10000, intercept)
  // 阻止拖拽移动节点
  eventBus.on('shape.move.start', 10000, intercept)
  // 阻止从 Palette / ContextPad 拖入创建新节点
  eventBus.on('create.start', 10000, intercept)
  // 阻止拖拽连线
  eventBus.on('connect.start', 10000, intercept)
  // 阻止调整节点大小
  eventBus.on('resize.start', 10000, intercept)

  // 只读状态变化时的 UI 联动
  eventBus.on('readOnly.changed', function (e) {
    if (e.readOnly) {
      // 收起 Palette
      if (palette && palette.isOpen()) palette.close()
      // 取消正在进行的文字编辑
      if (directEditing) directEditing.cancel()
      // 关闭 ContextPad
      if (contextPad) contextPad.close()
    }
  })
}

ReadOnly.$inject = ['eventBus', 'contextPad', 'palette', 'directEditing']

export default ReadOnly
