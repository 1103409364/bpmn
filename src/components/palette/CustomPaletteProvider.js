import { assign } from 'min-dash'

/**
 * 自定义 palette 提供者。
 *
 * 原理：diagram-js 的 Palette 支持注册多个 provider，渲染时会把所有 provider 返回的
 * entries 合并（见 Palette.js 的 addPaletteEntries）。默认的 PaletteProvider 依然生效，
 * 这里只是再新增一个 provider 补充额外的工具条目，实现"保留默认 + 扩展"。
 *
 * 通过 additionalModules 注入，构造函数里调用 palette.registerProvider(this) 完成注册。
 */
export default function CustomPaletteProvider(palette, create, elementFactory, modeling, selection, translate) {
  this._palette = palette
  this._create = create
  this._elementFactory = elementFactory
  this._modeling = modeling
  this._selection = selection
  this._translate = translate

  palette.registerProvider(this)
}

CustomPaletteProvider.$inject = [
  'palette',
  'create',
  'elementFactory',
  'modeling',
  'selection',
  'translate'
]

CustomPaletteProvider.prototype.getPaletteEntries = function () {
  const create = this._create
  const elementFactory = this._elementFactory
  const modeling = this._modeling
  const selection = this._selection
  const translate = this._translate

  // 与默认 PaletteProvider 中 createAction 相同的模式：点击/拖拽时创建元素
  function createAction(type, group, className, title, options) {
    function createListener(event) {
      const shape = elementFactory.createShape(assign({ type }, options))
      create.start(event, shape)
    }

    return {
      group,
      className,
      title,
      action: {
        dragstart: createListener,
        click: createListener
      }
    }
  }

  return {
    // 所有自定义条目统一放到新分组 'custom' 里（手风琴 palette 会按分组折叠展示，
    // 该分组在默认分组之后创建，因此渲染在 palette 底部）。

    // 常用任务类型快捷入口（默认 palette 只有通用 Task）
    'create.user-task': createAction('bpmn:UserTask', 'custom', 'bpmn-icon-user-task', translate('创建用户任务')),
    'create.service-task': createAction('bpmn:ServiceTask', 'custom', 'bpmn-icon-service-task', translate('创建服务任务')),
    'create.script-task': createAction('bpmn:ScriptTask', 'custom', 'bpmn-icon-script-task', translate('创建脚本任务')),
    'create.send-task': createAction('bpmn:SendTask', 'custom', 'bpmn-icon-send-task', translate('创建发送任务')),
    'create.receive-task': createAction('bpmn:ReceiveTask', 'custom', 'bpmn-icon-receive-task', translate('创建接收任务')),

    // 文本标注（默认 palette 没有）
    'create.text-annotation': createAction('bpmn:TextAnnotation', 'custom', 'bpmn-icon-text-annotation', translate('创建文本标注')),

    // 自定义动作工具（非创建类动作，可以调用任意 service）：
    // 一键删除当前选中的元素
    'custom.delete-selection': {
      group: 'custom',
      className: 'bpmn-icon-trash',
      title: translate('删除选中的元素'),
      action: {
        click: function () {
          modeling.removeElements(selection.get())
        }
      }
    }
  }
}
