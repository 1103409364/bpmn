// 自定义右键点击节点（或连线）时弹出的上下文菜单（ContextPad）
// ========== 可自定义的部分 ==========
// 1. 剔除默认菜单项：在 getContextPadEntries 返回的函数里 delete 对应 key
//    - delete entries['append.end-event']    // 追加结束事件
//    - delete entries['append.gateway']      // 追加网关
//    - delete entries['append.append-task']  // 追加任务
//    - delete entries['append.text-annotation'] // 追加文本标注
//    - delete entries['delete']              // 删除按钮
//    - delete entries['replace']             // 替换类型按钮
// 2. 新增自定义菜单项：给 entries 添加一个 key，值为 entry 对象：
//    entries['my-action'] = {
//      group: 'my-group',                    // 分组名（同组靠前/靠后由 order 决定）
//      className: 'bpmn-icon-xxx',           // 图标类名（可用 bpmn-icon-* 系列）
//      title: '提示文字',                     // 鼠标悬停提示
//      action: { click: (event, element) => { /* 点击后的处理逻辑 */ } },
//      // 可选：separator: true 在项之间加分隔线
//    };
// 3. 只针对特定元素类型生效：在返回的 entries 函数中根据 element 判断
//    if (element.businessObject.$type !== 'bpmn:Task') { ... }
//    仅当元素类型匹配时才添加/保留菜单项
// 4. 调整菜单项顺序：通过修改 entry 的 order 属性控制排序
// 5. 默认返回 entries 时，若 return 一个自定义对象（非 entries），可完全重写菜单
export default class CustomContextPadProvider {
  constructor(contextPad) {
    // 新版本推荐：通过 registerProvider 传递自身，但不要在内部调用 getPad
    contextPad.registerProvider(this);
  }

  getPaletteEntries() {
    return {};
  }

  // 关键点：返回一个函数，该函数接收已有的 entries 集合
  getContextPadEntries(element) {
    return function (entries) {
      // 可以在这里打印 entries 查看当前有哪些 key
      // console.log('当前可用的 contextPad 项:', entries);

      // 示例：剔除不需要的菜单项（取消注释即可生效）
      // delete entries['append.end-event'];         // 追加结束事件
      // delete entries['append.gateway'];           // 追加网关
      // delete entries['append.append-task'];       // 追加任务
      // delete entries['append.text-annotation'];   // 追加文本标注
      // delete entries['delete'];                   // 删除按钮
      // delete entries['replace'];                  // 替换类型按钮

      // 示例：新增自定义菜单项（取消注释即可生效）
      // entries['my-action'] = {
      //   group: 'custom',
      //   className: 'bpmn-icon-custom',
      //   title: '自定义操作',
      //   action: {
      //     click: (event, element) => {
      //       console.log('点击了自定义菜单', element);
      //     },
      //   },
      //   // separator: true,
      // };

      // 示例：仅对特定类型元素保留/添加菜单项
      // if (element.businessObject.$type === 'bpmn:Task') {
      //   delete entries['replace'];
      // }

      return entries;
    };
  }
}

CustomContextPadProvider.$inject = ["contextPad"];
