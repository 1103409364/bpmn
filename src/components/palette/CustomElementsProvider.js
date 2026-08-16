import { reactive, createApp } from 'vue'

import CustomElementsStore from './CustomElementsStore'
import CustomElementsPanel from './CustomElementsPanel.vue'
import PaletteToolbar from './PaletteToolbar.vue'

/**
 * 自定义元素 palette 引导模块（声明式版）。
 *
 * 职责：
 * - 用 reactive() 包裹 CustomElementsStore，把分页/搜索状态变成响应式数据
 * - 把 CustomElementsPanel（搜索/分组/分页）与 PaletteToolbar（收起/展开）
 *   两个 Vue 应用挂载到 .djs-palette 容器内【持久存在的宿主节点】上
 *
 * 关键点：宿主节点是 .djs-palette-entries 的兄弟节点，diagram-js 的
 * _update() 只清空重建 entries 自身，宿主与 Vue 应用可以跨重建存活，
 * 因此不再需要 _injectFloating/_rebuild 等命令式注入逻辑。
 *
 * 元素创建：条目点击/拖拽走 create.start(event, shape)（与默认 PaletteProvider
 * 的 createAction 行为一致），见 CustomElementsPanel.vue 的 handleCreate。
 */
export default class CustomElementsProvider {
  static $inject = ['palette', 'create', 'elementFactory', 'translate', 'config.customElements', 'eventBus']

  constructor(palette, create, elementFactory, translate, config, eventBus) {
    this._palette = palette

    // 响应式 store：getters（totalPages/hasPrev/hasNext...）随内部状态自动派生
    this._store = reactive(new CustomElementsStore(config || {}))
    this._panelProps = {
      store: this._store,
      create,
      elementFactory,
      translate,
      groupName: (config && config.groupName) || '自定义元素'
    }

    // palette 容器在 diagram.init 后才会创建（AccordionPalette 在 diagram.init
    // 里 _rebuild → _init 生成 .djs-palette 与 .djs-palette-entries），
    // 用 once 监听保证挂载时机；若容器已存在（模块被晚初始化）则立即挂载。
    if (palette._container) {
      this._mount()
    } else {
      eventBus.once('diagram.init', () => this._mount())
    }

    // modeler 销毁时卸载 Vue 应用，避免事件监听与内存泄漏
    eventBus.on('diagram.destroy', () => this._unmount())
  }

  /**
   * 创建两个宿主节点并挂载 Vue 应用。
   * 宿主 display: contents，不参与布局，子元素直接参与 .djs-palette 的布局。
   * DOM 顺序：工具栏 → 默认条目（diagram-js entries）→ 自定义元素面板（下方区块）。
   */
  _mount() {
    if (this._mounted) return
    const container = this._palette && this._palette._container
    if (!container) return

    const toolbarHost = document.createElement('div')
    toolbarHost.className = 'djs-custom-elements-host'
    const panelHost = document.createElement('div')
    panelHost.className = 'djs-custom-elements-host'

    const entries = container.querySelector('.djs-palette-entries')
    if (entries) {
      container.insertBefore(toolbarHost, entries)
      container.insertBefore(panelHost, entries.nextSibling)
    } else {
      container.appendChild(toolbarHost)
      container.appendChild(panelHost)
    }

    this._toolbarApp = createApp(PaletteToolbar, { palette: this._palette })
    this._panelApp = createApp(CustomElementsPanel, this._panelProps)
    this._toolbarApp.mount(toolbarHost)
    this._panelApp.mount(panelHost)
    this._mounted = true
  }

  _unmount() {
    this._mounted = false
    if (this._toolbarApp) {
      this._toolbarApp.unmount()
      this._toolbarApp = null
    }
    if (this._panelApp) {
      this._panelApp.unmount()
      this._panelApp = null
    }
  }
}
