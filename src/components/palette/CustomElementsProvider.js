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
 *   只返回【当前页】的元素条目；元素按 item.group 归类到不同 palette 分组。
 * - 搜索框、状态提示（加载中/首载失败重试/空结果）、分页条都是【独立于分组】的
 *   浮动元素（不放进任何 <details> 分组，因此不会随分组一起被收起）：搜索框固定在
 *   分组区顶部、加载中/失败提示在搜索框与分组之间、空结果提示在面板最底部且位于
 *   分页条上方、分页条固定在面板最底部，由 _injectFloating() 在每次 _update()
 *   重建后重新注入。
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

  // 库的 _update() 每次都会清空并重建 .djs-palette-entries 内容，
  // 搜索框/分页条是独立于分组的浮动元素，需要在每次重建后重新注入。
  // 这里包一层 _update()，保证 i18n.changed / toggleState 等触发重建时也能保持。
  const originalUpdate = palette._update.bind(palette)
  const self = this
  palette._update = function () {
    const result = originalUpdate()
    self._injectFloating()
    return result
  }

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

  // 加载中 / 首载失败 / 空结果等状态提示由 _injectFloating() 渲染为浮动消息条
  // （更清晰可见，且不产生空分组）；这里只输出真实数据条目。
  if (!store.initialized || !store.items.length) {
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

  return entries
}

/**
 * 在分组区顶部/底部注入独立于分组的浮动元素：
 * - 搜索框：entriesContainer 的第一个子元素（所有分组之前）
 * - 分页条：entriesContainer 的最后一个子元素（所有分组之后，仅多页且有数据时）
 * 这些元素不带 .entry 类，不参与库的分组渲染，也不会被分组折叠/展开影响。
 * _update() 每次都会清空 entriesContainer，所以每次重建后都要重新注入。
 */
CustomElementsProvider.prototype._injectFloating = function () {
  const palette = this._palette
  const container = palette && palette._container
  if (!container) return

  this._bindContainerEvents()

  const entriesContainer = container.querySelector('.djs-palette-entries')
  if (!entriesContainer) return

  // 移除上一次注入的浮动元素
  Array.prototype.slice.call(entriesContainer.querySelectorAll('.djs-custom-elements-float')).forEach((el) => {
    entriesContainer.removeChild(el)
  })

  const store = this._store

  // 1. 搜索框：固定在所有分组之前（首次数据就绪后常驻）
  if (store.initialized) {
    entriesContainer.insertBefore(this._buildSearchEl(), entriesContainer.firstChild)
  }

  // 2. 加载中 / 首载失败重试：位于搜索框之后、分组之前
  const status = this._buildStatusEl()
  if (status && status.getAttribute('data-mode') !== 'empty') {
    const ref = entriesContainer.querySelector('.djs-accordion-group') || null
    entriesContainer.insertBefore(status, ref)
  }

  // 3. 分页条：固定在面板最底部（空结果时也保留，作为底部锚点，
  //    让空提示能放在它上方）
  if (store.initialized && !store.error && (store.totalPages > 1 || !store.items.length)) {
    entriesContainer.appendChild(this._buildPagerEl())
  }

  // 4. 空结果提示：面板最底部、分页条上方
  if (status && status.getAttribute('data-mode') === 'empty') {
    const pager = entriesContainer.querySelector('.djs-custom-elements-pager')
    entriesContainer.insertBefore(status, pager)
  }
}

/**
 * 状态提示浮动消息：
 * - 首载加载中 -> 「加载中...」（渲染在搜索框之后、分组之前）
 * - 首载失败   -> 「加载失败，点击重试」（同上，可点击重试）
 * - 空结果     -> 「无匹配自定义元素」（搜索中）/「暂无自定义元素」（无数据）
 *                 （渲染在面板最底部、分页条上方）
 * 无对应状态时返回 null。
 */
CustomElementsProvider.prototype._buildStatusEl = function () {
  const store = this._store
  let text = null
  let mode = null

  if (!store.initialized && !store.error) {
    text = '加载中...'
    mode = 'loading'
  } else if (!store.initialized && store.error) {
    text = '加载失败，点击重试'
    mode = 'retry'
  } else if (!store.items.length) {
    text = store.searching ? '无匹配自定义元素' : '暂无自定义元素'
    mode = 'empty'
  }

  if (!text) return null

  const el = document.createElement('div')
  el.className = 'djs-custom-elements-float djs-custom-elements-status djs-custom-elements-status-' + mode
  el.setAttribute('data-mode', mode)
  if (mode === 'retry') {
    el.setAttribute('data-action', 'retry')
  }
  el.textContent = this._translate(text)
  return el
}

/**
 * 分页条浮动元素：整条宽的 div，内含 上一页/页码/下一页。
 */
CustomElementsProvider.prototype._buildPagerEl = function () {
  const store = this._store
  const loading = store.loading

  const el = document.createElement('div')
  el.className = 'djs-custom-elements-float djs-custom-elements-pager'
  el.innerHTML =
    '<button type="button" class="djs-pager-btn djs-pager-prev" data-dir="prev" ' +
    (store.hasPrev && !loading ? '' : 'disabled') + ' aria-label="上一页">&lsaquo;</button>' +
    '<span class="djs-pager-info">' + store.page + ' / ' + store.totalPages + '</span>' +
    '<button type="button" class="djs-pager-btn djs-pager-next" data-dir="next" ' +
    (store.hasNext && !loading ? '' : 'disabled') + ' aria-label="下一页">&rsaquo;</button>'
  return el
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

  // 浮动元素可能被其它原因触发的 _update() 重建影响，这里兜底再注入一次
  this._injectFloating()
}

/**
 * 搜索框浮动元素：整条宽的 div，内含一个 text input。
 * 输入事件经由 palette 容器上的委托监听处理（见 _bindContainerEvents）。
 */
CustomElementsProvider.prototype._buildSearchEl = function () {
  const store = this._store

  const el = document.createElement('div')
  el.className = 'djs-custom-elements-float djs-custom-elements-search'
  el.innerHTML =
    '<input type="text" class="djs-custom-elements-search-input" ' +
    'placeholder="搜索自定义元素" value="' + escapeHtml(store.keyword) + '" ' +
    'autocomplete="off" aria-label="搜索自定义元素">'
  return el
}

/**
 * 在 palette 容器上绑定委托事件（只绑定一次）：
 * - 搜索框输入：300ms 防抖触发搜索；回车立即搜索
 * - 分页条按钮点击：进入 _onPagerClick
 * 浮动元素每次 _update() 都被重建，因此监听挂在持久存在的 palette._container 上，
 * 用 _searchBound 保证只绑定一次。
 */
CustomElementsProvider.prototype._bindContainerEvents = function () {
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

  container.addEventListener('click', (event) => {
    const target = event.target
    if (!(target && target.closest)) return

    const btn = target.closest('.djs-pager-btn')
    if (btn && !btn.disabled) {
      this._onPagerClick(event)
      return
    }

    if (target.closest('.djs-custom-elements-status[data-action="retry"]')) {
      this._loadAndRefresh(1)
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
