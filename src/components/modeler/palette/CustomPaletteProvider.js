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
export default class CustomPaletteProvider {
  static $inject = ['palette', 'create', 'elementFactory', 'modeling', 'selection', 'translate']

  constructor(palette, create, elementFactory, modeling, selection, translate) {
    this._palette = palette
    this._create = create
    this._elementFactory = elementFactory
    this._modeling = modeling
    this._selection = selection
    this._translate = translate

    palette.registerProvider(this)
  }

  /**
   * 返回一个 entries 更新器：
   * 1. 把默认 provider 的条目统一归入 'default' 分组（'custom' 分组保持不动；
   *    自定义元素现由 Vue 面板 CustomElementsPanel.vue 渲染，不再走 provider）
   * 2. 追加自定义条目（create.* 创建元素工具、custom.* 自定义动作）
   */
  getPaletteEntries() {
    const translate = this._translate
    const createAction = this._createAction.bind(this)

    return (entries) => {
      forEach(entries, (entry) => {
        // 注意：'tools' 分组（hand/lasso/space 工具）必须保留原名，不能归并到 'default'。
        // 手风琴 palette（diagram-js-accordion-palette）点击工具后通过 tool-manager.update
        // 触发 updateToolHighlight()，它用 query('[data-group=tools]', ...) 定位工具条目；
        // 一旦改名，DOM 里不存在 [data-group=tools]，toolsContainer 为 null，
        // 遍历 toolsContainer.children 就会抛 "can't access property 'children', toolsContainer is null"。
        if (entry && entry.group !== 'custom' && entry.group !== 'custom-elements' && entry.group !== 'default' && entry.group !== 'tools') {
          entry.group = 'default'
        }
      })

      return assign(entries, {
        // ———————— 创建元素类工具 ————————
        // 常用任务类型快捷入口，形式为 'create.{elementType}'；
        // 点击或拖拽时在画布上创建对应元素。
        //
        // 自定义图标示例：
        // 'create.custom-task': createAction(
        //   'bpmn:UserTask',      // 实际创建的元素类型
        //   'custom',             // 分组
        //   'custom-icon-class',  // 改成你的自定义类名
        //   translate('创建自定义任务')
        // )
        // 'create.user-task': createAction('bpmn:UserTask', 'custom', 'bpmn-icon-user-task', translate('创建用户任务')),
        // 'create.service-task': createAction('bpmn:ServiceTask', 'custom', 'bpmn-icon-service-task', translate('创建服务任务')),
        // 'create.script-task': createAction('bpmn:ScriptTask', 'custom', 'bpmn-icon-script-task', translate('创建脚本任务')),
        // 'create.send-task': createAction('bpmn:SendTask', 'custom', 'bpmn-icon-send-task', translate('创建发送任务')),
        // 'create.receive-task': createAction('bpmn:ReceiveTask', 'custom', 'bpmn-icon-receive-task', translate('创建接收任务')),

        // 注意：画布中任务的图标由 BPMN 类型决定。
        // bpmn:Task 是通用任务类型，默认不显示内置图标；
        // 若希望图标与工具栏保持一致，请使用标准任务类型：
        // bpmn:UserTask / bpmn:ServiceTask / bpmn:ScriptTask /
        // bpmn:SendTask / bpmn:ReceiveTask / bpmn:ManualTask / bpmn:BusinessRuleTask
        // 'create.test-task': createAction('bpmn:UserTask', 'custom', 'custom-icon-test', translate('创建测试任务')),

        // 文本标注（默认 palette 没有）
        // 'create.text-annotation': createAction('bpmn:TextAnnotation', 'custom', 'bpmn-icon-text-annotation', translate('创建文本标注')),

        // ———————— 自定义动作类工具 ————————
        // 非创建元素的自定义工具，可执行任意操作（删除、复制、导出等）。
        // key 形式任意，通常约定为 '{category}.{actionName}'。
        //
        // 结构：
        // {
        //   group: string,        // 分组
        //   className: string,    // 图标 CSS 类名
        //   title: string,        // 工具提示
        //   action: {
        //     click?: function,   // 点击时执行
        //     dragstart?: function // 拖拽时执行（可选）
        //   }
        // }
        //
        // 自定义动作示例：
        // 'custom.copy-element': {
        //   group: 'custom',
        //   className: 'bpmn-icon-copy',  // 或自定义图标类
        //   title: translate('复制选中元素'),
        //   action: {
        //     click: function () {
        //       // 你的复制逻辑
        //       const elements = this._selection.get()
        //       if (elements.length) {
        //         console.log('Copying:', elements)
        //       }
        //     }
        //   }
        // }
        // 'custom.delete-selection': {
        //   group: 'custom',
        //   className: 'bpmn-icon-trash',
        //   title: translate('删除选中的元素'),
        //   action: {
        //     click: () => {
        //       this._modeling.removeElements(this._selection.get())
        //     }
        //   }
        // }
      })
    }
  }

  /**
   * 生成一个「创建元素」的 palette 条目（与默认 PaletteProvider 的 createAction 同款模式）：
   * 点击 / 拖拽时在画布上创建指定类型的元素。
   *
   * @param {string} type      要创建的 BPMN 元素类型，如 'bpmn:UserTask'
   * @param {string} group     条目分组名（手风琴 palette 按此归类）
   * @param {string} className 图标 CSS 类名（来源见下方说明）
   * @param {string} title     悬停提示文本
   * @param {object} [options] 创建元素时的额外属性（可选）
   *
   * 【图标来源】
   * 1. bpmn-js 内置图标类（推荐，用于标准 BPMN 元素）
   *    - bpmn-icon-user-task           用户任务
   *    - bpmn-icon-service-task        服务任务
   *    - bpmn-icon-script-task         脚本任务
   *    - bpmn-icon-send-task           发送任务
   *    - bpmn-icon-receive-task        接收任务
   *    - bpmn-icon-manual-task         手动任务
   *    - bpmn-icon-business-rule-task  业务规则任务
   *    - bpmn-icon-text-annotation     文本标注
   *    - bpmn-icon-trash               删除/垃圾桶
   *    - bpmn-icon-start-event-*       各类开始事件
   *    - bpmn-icon-end-event-*         各类结束事件
   *    - 更多内置图标见 bpmn-js/dist/assets/bpmn-font/ 目录
   *
   * 2. 自定义 CSS 类（需在全局 CSS 中定义）
   *    .custom-user-task-icon {
   *      background-image: url('/icons/user-task.svg') !important;
   *      background-size: contain;
   *      background-position: center;
   *      background-repeat: no-repeat;
   *    }
   *
   * 3. Emoji / Unicode（通过 CSS ::before 伪元素）
   *    .custom-emoji-user-task::before {
   *      content: '👤 ';
   *      font-size: 14px;
   *      margin-right: 4px;
   *    }
   *
   * 4. Font Icon（如 FontAwesome、iconfont 等）
   *    className: 'fa fa-user'                 // FontAwesome
   *    className: 'iconfont icon-user-task'    // iconfont
   *
   * 【常见标准 BPMN 元素类型】
   * - bpmn:Task / bpmn:UserTask / bpmn:ServiceTask / bpmn:ManualTask
   * - bpmn:BusinessRuleTask / bpmn:ScriptTask / bpmn:SendTask / bpmn:ReceiveTask
   * - bpmn:StartEvent / bpmn:EndEvent / bpmn:ExclusiveGateway
   * - bpmn:ParallelGateway / bpmn:InclusiveGateway / bpmn:EventBasedGateway
   * - bpmn:SubProcess / bpmn:CallActivity / bpmn:TextAnnotation / bpmn:SequenceFlow
   * - bpmn:DataObjectReference / bpmn:DataStoreReference / bpmn:Participant / bpmn:Lane
   */
  _createAction(type, group, className, title, options) {
    const create = this._create
    const elementFactory = this._elementFactory

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
}
