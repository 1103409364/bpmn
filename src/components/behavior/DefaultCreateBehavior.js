import inherits from 'inherits-browser'

import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor'

/**
 * 默认创建行为模块：在新元素创建时写入默认属性（默认 name、默认扩展属性等）。
 *
 * 原理：从 palette 拖入 / contextPad 追加等新建元素的操作最终都会执行
 * shape.create 命令，在 preExecute 阶段（命令真正执行前）按需给
 * businessObject 写入默认值，可扩展为任意元素类型、任意属性的默认值。
 * 例如给 bpmn:StartEvent 写入默认 name（"开始"）：
 * 随后 LabelBehavior 的 postExecute 会据此自动创建标签，因此画布上会
 * 直接显示默认名称，且保存时正常序列化到 XML。
 *
 * 注意：
 * - 只在 name 为空时写入，不覆盖已命名/导入的流程（importXML 不走
 *   shape.create 命令，不会触发本行为）。
 * - 新增默认值时，在下方 handler 里按 bo.$type 分支扩展即可。
 */
export default function DefaultCreateBehavior(eventBus) {
  CommandInterceptor.call(this, eventBus)

  this.preExecute('shape.create', (event) => {
    const shape = event.context && event.context.shape
    const bo = shape && shape.businessObject
    if (!bo) return

    if (bo.$type === 'bpmn:StartEvent' && !bo.name) {
      bo.name = '开始'
    }
  })
}

inherits(DefaultCreateBehavior, CommandInterceptor)

DefaultCreateBehavior.$inject = ['eventBus']
