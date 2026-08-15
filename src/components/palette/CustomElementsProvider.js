import { assign } from 'min-dash'

import CustomElementsStore from './CustomElementsStore'

// BPMN 元素类型 -> 内置图标类名 的兜底映射（item.iconClass 未提供时使用）
// HTML 转义（搜索关键字要安全地回填到 input.value）
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const TYPE_ICON_MAP = {
  'bpmn:Task': 'bpmn-icon-task',
  'bpmn:UserTask': 'bpmn-icon-user-task',
  'bpmn:ServiceTask': 'bpmn-icon-service-task',
  'bpmn:ScriptTask': 'bpmn-icon-script-task',
  'bpmn:SendTask': 'bpmn-icon-send-task',
  'bpmn:ReceiveTask': 'bpmn-icon-receive-task',
  'bpmn:ManualTask': 'bpmn-icon-manual-task',
  'bpmn:BusinessRuleTask': 'bpmn-icon-business-rule-task',
  'bpmn:StartEvent': 'bpmn-icon-start-event-none',
  'bpmn:EndEvent': 'bpmn-icon-end-event-none',
  'bpmn:ExclusiveGateway': 'bpmn-icon-gateway-xor',
  'bpmn:ParallelGateway': 'bpmn-icon-gateway-parallel',
  'bpmn:InclusiveGateway': 'bpmn-icon-gateway-or',
  'bpmn:EventBasedGateway': 'bpmn-icon-gateway-eventbased',
  'bpmn:SubProcess': 'bpmn-icon-subprocess-collapsed',
  'bpmn:CallActivity': 'bpmn-icon-call-activity',
  'bpmn:TextAnnotation': 'bpmn-icon-text-annotation',
  'bpmn:DataObjectReference': 'bpmn-icon-data-object',
  'bpmn:DataStoreReference': 'bpmn-icon-data-store',
  'bpmn:Participant': 'bpmn-icon-participant',
  'bpmn:Lane': 'bpmn-icon-lane'
}

/**
 * 自定义元素 palette provider（分页版）。
 *
 * 方案说明：
 * - 保留 diagram-js-accordion-palette 不动，这里只是再注册一个 provider。
 * - 后端元素数据通过 CustomElementsStore 全局分页拉取，getPaletteEntries() 每次
 *   只返回【当前页】的条目 + 一条"分页条"（自定义 entry.html）。
 * - 当前页元素按 item.group 归类到不同 palette 分组；分页条放在最后一个含元素的分组末尾。
 * - 点分页条按钮 -> store.prev()/next() 拉取新页 -> 调 palette._rebuild() 重渲染。
 *   _rebuild() 是库内部统一的刷新入口（内部已做未初始化时的空安全保护）。
 *
 * 条目数据约定：{ id, name, type, group?, iconClass?, options? }
 * - type：要创建的 BPMN 类型，如 'bpmn:UserTask'
 * - group：所属分组名（作为 palette 分组标题），缺省时归入 groupName 配置项
 * - iconClass：图标 CSS 类（不传则按 type 兜底映射）
 * - options：创建元素时的额外属性（如 camunda 扩展属性），可选
 */
export default function CustomElementsProvider(palette, create, elementFactory, translate, config) {
  this._palette = palette
  this._create = create
  this._elementFactory = elementFactory
  this._translate = translate

  this._groupName = (config && config.groupName) || '自定义元素'
  this._store = new CustomElementsStore(config || {})

  palette.registerProvider(this)

  // 首屏异步拉取第一页；加载完成后通过 _rebuild() 触发重渲染。
  // 若此时 palette 尚未初始化，_rebuild() 会自动跳过，
  // palette 初始化完成时还会再走一次 _update()，两种情况都能正确出数据。
  this._loadAndRefresh(1)
}

CustomElementsProvider.$inject = [
  'palette',
  'create',
  'elementFactory',
  'translate',
  'config.customElements'
]

CustomElementsProvider.prototype.getPaletteEntries = function () {
  const store = this._store
  const entries = {}

  if (!store.initialized && !store.error) {
    // 首次加载中
    this._bindSearchInput()
    entries['custom-elements.loading'] = {
      group: this._groupName,
      className: 'bpmn-icon-service-task',
      title: this._translate('加载中...'),
      action: {}
    }
    return entries
  }

  if (!store.initialized && store.error) {
    // 首次加载失败：显示重试
    entries['custom-elements.retry'] = {
      group: this._groupName,
      className: 'bpmn-icon-service-task',
      title: this._translate('加载失败，点击重试'),
      action: {
        click: () => this._loadAndRefresh(1)
      }
    }
    return entries
  }

  // 已初始化：搜索框常驻（无论有无数据 / 是否加载中）
  this._bindSearchInput()
  entries['custom-elements.search'] = this._searchEntry()

  if (!store.items.length) {
    // 有数据但当前结果为空：区分「搜索无匹配」和「本来就没数据」
    entries['custom-elements.empty'] = {
      group: this._groupName,
      className: 'bpmn-icon-service-task',
      title: this._translate(store.searching ? '无匹配元素' : '暂无自定义元素'),
      action: {}
    }
    return entries
  }

  // 1. 当前页元素按 group 归类（item.group 缺省时归入默认分组）
  const grouped = {}
  store.items.forEach((item) => {
    const groupName = item.group || this._groupName
    ;(grouped[groupName] = grouped[groupName] || []).push(item)
  })

  // 2. 渲染各分组的创建条目
  Object.keys(grouped).forEach((groupName) => {
    grouped[groupName].forEach((item, index) => {
      const type = item.type || 'bpmn:Task'
      const className = item.iconClass || TYPE_ICON_MAP[type] || 'bpmn-icon-task'
      const title = item.name || item.id || type

      entries['create.custom-elements.' + (item.id || index)] = {
        group: groupName,
        className,
        title: this._translate(title),
        action: {
          dragstart: (event) => this._createElement(event, item),
          click: (event) => this._createElement(event, item)
        }
      }
    })
  })

  // 3. 全局分页条（多于一页才显示）：放在最后一个含元素的分组末尾
  if (store.totalPages > 1) {
    const groupNames = Object.keys(grouped)
    const lastGroup = groupNames[groupNames.length - 1]
    if (lastGroup) {
      entries['custom-elements.pager.' + lastGroup] = this._pagerEntry(lastGroup)
    }
  }

  return entries
}

/**
 * 分页条条目：整条宽的自定义 html，内含 上一页/页码/下一页。
 * 按钮点击经由库的 click 委托机制进入 action.click，
 * 通过 event.target 判断点的是哪个按钮。
 *
 * @param {string} groupName 分页条所在的分组（最后一个含元素的分组）
 */
CustomElementsProvider.prototype._pagerEntry = function (groupName) {
  const store = this._store
  const loading = store.loading

  const html =
    '<div class="entry djs-custom-elements-pager" draggable="false">' +
    '<button type="button" class="djs-pager-btn djs-pager-prev" data-dir="prev" ' +
    (store.hasPrev && !loading ? '' : 'disabled') + ' aria-label="上一页">&lsaquo;</button>' +
    '<span class="djs-pager-info">' + store.page + ' / ' + store.totalPages + '</span>' +
    '<button type="button" class="djs-pager-btn djs-pager-next" data-dir="next" ' +
    (store.hasNext && !loading ? '' : 'disabled') + ' aria-label="下一页">&rsaquo;</button>' +
    '</div>'

  return {
    group: groupName,
    html,
    title: store.page + ' / ' + store.totalPages,
    action: {
      click: (event) => this._onPagerClick(event)
    }
  }
}

CustomElementsProvider.prototype._onPagerClick = function (event) {
  const target = event && event.target
  const btn = target && target.closest('.djs-pager-btn')
  if (!btn || btn.disabled) return

  const dir = btn.getAttribute('data-dir')
  this._loadAndRefresh(dir === 'prev' ? 'prev' : 'next')
}

CustomElementsProvider.prototype._createElement = function (event, item) {
  const create = this._create
  const elementFactory = this._elementFactory
  const type = item.type || 'bpmn:Task'

  const shape = elementFactory.createShape(
    assign({ type }, item.options)
  )
  create.start(event, shape)
}

CustomElementsProvider.prototype._loadAndRefresh = function (pageOrDir) {
  const store = this._store

  const run = pageOrDir === 'prev' ? store.prev() : pageOrDir === 'next' ? store.next() : store.load(pageOrDir || 1)

  // store 内部有 loading 互斥，并发点击时 load() 可能直接返回 undefined，
  // 用 Promise.resolve 统一包装
  Promise.resolve(run).then(() => {
    this._refreshPalette()
  })
}

/**
 * 刷新 palette，并在刷新前后恢复被 `_update()` 重置的状态：
 * 1. 整个 palette 的展开/收起（_update() 末尾会强制 open()）
 * 2. 各分组的折叠/展开（_update() 会按 defaultOpenGroups 重建 <details>，
 *    导致用户手动折叠/展开的分组被重置）
 *
 * 分组按 data-group-details（CSS 转义后的分组名）匹配恢复：
 * 全局分页切换后当前页的分组集合会变化，索引方式不可靠。
 * 本次刷新才出现的新分组默认展开。
 */
CustomElementsProvider.prototype._refreshPalette = function () {
  const palette = this._palette
  if (!palette || typeof palette._rebuild !== 'function') return

  const container = palette._container
  const wasPaletteOpen = !!(container && palette.isOpen && palette.isOpen())

  // 快照刷新前的分组展开状态（key 为 data-group-details）
  const groupStates = new Map()
  if (container) {
    Array.prototype.slice.call(container.querySelectorAll('.djs-accordion-group')).forEach((group) => {
      groupStates.set(group.getAttribute('data-group-details'), group.open)
    })
  }

  try {
    palette._rebuild()

    // 1. 恢复整个 palette 的展开/收起状态
    if (!wasPaletteOpen && container && palette.close) palette.close()

    // 2. 恢复各分组的折叠/展开状态；新出现的分组默认展开
    if (container) {
      Array.prototype.slice.call(container.querySelectorAll('.djs-accordion-group')).forEach((group) => {
        const name = group.getAttribute('data-group-details')
        group.open = groupStates.has(name) ? groupStates.get(name) : true
      })
    }
  } catch (err) {
    console.error('[CustomElementsProvider] 刷新 palette 失败:', err)
  }
}

/**
 * 搜索框条目：整条宽的自定义 html，内含一个 text input。
 * 输入事件经由 palette 容器上的委托监听处理（见 _bindSearchInput）。
 * 条目点击本身是无效操作，action 给空对象避免库的 triggerEntry 抛错。
 */
CustomElementsProvider.prototype._searchEntry = function () {
  const store = this._store

  const html =
    '<div class="entry djs-custom-elements-search" draggable="false">' +
    '<input type="text" class="djs-custom-elements-search-input" ' +
    'placeholder="搜索名称" value="' + escapeHtml(store.keyword) + '" ' +
    'autocomplete="off" aria-label="搜索自定义元素">' +
    '</div>'

  return {
    group: this._groupName,
    html,
    title: this._translate('搜索自定义元素'),
    action: {}
  }
}

/**
 * 在 palette 容器上绑定搜索框的委托事件（输入防抖 / 回车立即搜索）。
 * _rebuild() 会重建内部 DOM，因此监听挂在持久存在的 palette._container 上，
 * 用 _searchBound 保证只绑定一次。
 */
CustomElementsProvider.prototype._bindSearchInput = function () {
  if (this._searchBound) return
  const container = this._palette && this._palette._container
  if (!container) return

  this._searchBound = true
  this._searchTimer = null

  const fire = (value) => {
    clearTimeout(this._searchTimer)
    this._searchTimer = null
    this._search(value)
  }

  container.addEventListener('input', (event) => {
    const input = event.target
    if (!(input && input.classList && input.classList.contains('djs-custom-elements-search-input'))) return
    clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => fire(input.value), 300)
  })

  container.addEventListener('keydown', (event) => {
    const input = event.target
    if (!(input && input.classList && input.classList.contains('djs-custom-elements-search-input'))) return
    if (event.key === 'Enter') {
      event.preventDefault()
      clearTimeout(this._searchTimer)
      this._searchTimer = null
      fire(input.value)
    }
  })
}

/**
 * 触发搜索：更新关键字并回第 1 页拉取，刷新后恢复搜索框焦点与光标位置
 * （_rebuild() 重建 DOM 会销毁旧输入框并夺走焦点）。
 */
CustomElementsProvider.prototype._search = function (keyword) {
  const store = this._store
  const normalized = String(keyword == null ? '' : keyword).trim()
  if (normalized === store.keyword) return

  const container = this._palette && this._palette._container
  const input = container && container.querySelector('.djs-custom-elements-search-input')
  const wasFocused = input === document.activeElement

  store.search(normalized).then(() => {
    this._refreshPalette()

    if (wasFocused && container) {
      const next = container.querySelector('.djs-custom-elements-search-input')
      if (next) {
        next.focus()
        try {
          next.setSelectionRange(next.value.length, next.value.length)
        } catch (err) {
          // 个别环境不支持 setSelectionRange，忽略
        }
      }
    }
  })
}
