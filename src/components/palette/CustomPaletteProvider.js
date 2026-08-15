import { assign, forEach } from 'min-dash'

/**
 * 自定义 palette 提供者。
 *
 * 原理：diagram-js 的 Palette 支持注册多个 provider，渲染时会把所有 provider 返回的
 * entries 合并（见 Palette.js 的 addPaletteEntries）。默认的 PaletteProvider 依然生效，
 * 这里只是再新增一个 provider 补充额外的工具条目，并把默认条目统一归类到 "default" 分组。
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

  /**
   * 与默认 PaletteProvider 中 createAction 相同的模式：点击/拖拽时创建元素
   *
   * @param {string} type - BPMN 元素类型，如 'bpmn:UserTask', 'bpmn:ServiceTask' 等
   * @param {string} group - 工具栏分组，用于在手风琴 palette 中归类
   * @param {string} className - 图标 CSS 类名，用于展示图标
   *
   * 【图标来源】
   * className 有多种来源：
   * 1. bpmn-js 内置图标类（推荐用于标准 BPMN 元素）
   *    - bpmn-icon-user-task         用户任务
   *    - bpmn-icon-service-task      服务任务
   *    - bpmn-icon-script-task       脚本任务
   *    - bpmn-icon-send-task         发送任务
   *    - bpmn-icon-receive-task      接收任务
   *    - bpmn-icon-manual-task       手动任务
   *    - bpmn-icon-business-rule-task 业务规则任务
   *    - bpmn-icon-text-annotation   文本标注
   *    - bpmn-icon-trash             删除/垃圾桶
   *    - bpmn-icon-start-event-*     各类开始事件
   *    - bpmn-icon-end-event-*       各类结束事件
   *    - 更多内置图标见 bpmn-js/dist/assets/bpmn-font/ 目录
   *
   * 2. 自定义 CSS 类（需在全局 CSS 中定义）
   *    示例：在 src/styles/custom-icons.css 中定义
   *    .custom-user-task-icon {
   *      background-image: url('/icons/user-task.svg') !important;
   *      background-size: contain;
   *      background-position: center;
   *      background-repeat: no-repeat;
   *    }
   *
   * 3. Emoji 或 Unicode（通过 CSS ::before 伪元素）
   *    示例：在 src/styles/custom-icons.css 中定义
   *    .custom-emoji-user-task::before {
   *      content: '👤 ';
   *      font-size: 14px;
   *      margin-right: 4px;
   *    }
   *
   * 4. Font Icon（如 FontAwesome、iconfont 等）
   *    className: 'fa fa-user'  // FontAwesome
   *    className: 'iconfont icon-user-task'  // iconfont
   *
   * 常见标准 BPMN 元素类型：
   * - bpmn:Task
   * - bpmn:UserTask
   * - bpmn:ServiceTask
   * - bpmn:ManualTask
   * - bpmn:BusinessRuleTask
   * - bpmn:ScriptTask
   * - bpmn:SendTask
   * - bpmn:ReceiveTask
   * - bpmn:StartEvent
   * - bpmn:EndEvent
   * - bpmn:ExclusiveGateway
   * - bpmn:ParallelGateway
   * - bpmn:InclusiveGateway
   * - bpmn:EventBasedGateway
   * - bpmn:SubProcess
   * - bpmn:CallActivity
   * - bpmn:TextAnnotation
   * - bpmn:SequenceFlow
   * - bpmn:DataObjectReference
   * - bpmn:DataStoreReference
   * - bpmn:Participant
   * - bpmn:Lane
   *
   * @param {string} title - 工具提示文本（鼠标悬停显示）
   * @param {object} options - 创建元素时的额外配置项（可选）
   */
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

  return function (entries) {
    forEach(entries, function (entry) {
      // 'custom-elements' 是后端自定义元素分组（由 CustomElementsProvider 管理），保持不动
      if (entry && entry.group !== 'custom' && entry.group !== 'custom-elements' && entry.group !== 'default') {
        entry.group = 'default'
      }
    })

    return assign(entries, {
      /**
       * 【创建元素类工具】
       * 常用任务类型快捷入口。形式：'create.{elementType}'
       * 当用户点击或拖拽时，会在画布上创建对应的元素
       *
       * 自定义图标示例：
       * 'create.custom-task': createAction(
       *   'bpmn:UserTask',      // 实际创建的元素类型
       *   'custom',             // 分组
       *   'custom-icon-class',  // 改成你的自定义类名
       *   translate('创建自定义任务')
       * )
       */
      'create.user-task': createAction('bpmn:UserTask', 'custom', 'bpmn-icon-user-task', translate('创建用户任务')),
      'create.service-task': createAction('bpmn:ServiceTask', 'custom', 'bpmn-icon-service-task', translate('创建服务任务')),
      'create.script-task': createAction('bpmn:ScriptTask', 'custom', 'bpmn-icon-script-task', translate('创建脚本任务')),
      'create.send-task': createAction('bpmn:SendTask', 'custom', 'bpmn-icon-send-task', translate('创建发送任务')),
      'create.receive-task': createAction('bpmn:ReceiveTask', 'custom', 'bpmn-icon-receive-task', translate('创建接收任务')),
      // 注意：画布中任务的图标由 BPMN 类型决定，
      // bpmn:Task 是通用任务类型，默认不显示内置图标。
      // 若希望图标与工具栏保持一致，可使用标准任务类型：
      // bpmn:UserTask / bpmn:ServiceTask / bpmn:ScriptTask /
      // bpmn:SendTask / bpmn:ReceiveTask / bpmn:ManualTask / bpmn:BusinessRuleTask
      'create.test-task': createAction('bpmn:UserTask', 'custom', 'custom-icon-test', translate('创建测试任务')),
      // 文本标注（默认 palette 没有）
      'create.text-annotation': createAction('bpmn:TextAnnotation', 'custom', 'bpmn-icon-text-annotation', translate('创建文本标注')),

      /**
       * 【自定义动作类工具】
       * 非创建元素的自定义工具，可以执行任意操作（删除、复制、导出等）
       * 形式：任意 key，但通常约定为 '{category}.{actionName}'
       * 结构：
       * {
       *   group: string,        // 分组
       *   className: string,    // 图标 CSS 类名
       *   title: string,        // 工具提示
       *   action: {
       *     click?: function,   // 点击时执行
       *     dragstart?: function // 拖拽时执行（可选）
       *   }
       * }
       *
       * 添加自定义动作示例：
       * 'custom.copy-element': {
       *   group: 'custom',
       *   className: 'bpmn-icon-copy',  // 或自定义图标类
       *   title: translate('复制选中元素'),
       *   action: {
       *     click: function () {
       *       // 你的复制逻辑
       *       const elements = selection.get()
       *       if (elements.length) {
       *         console.log('Copying:', elements)
       *       }
       *     }
       *   }
       * }
       */
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
    })
  }
}
