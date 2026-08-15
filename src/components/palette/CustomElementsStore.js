/**
 * 自定义元素分页状态管理。
 *
 * 职责：向后端分页拉取自定义元素数据，并暴露当前页数据与翻页能力。
 * 与渲染解耦：只负责数据，不碰 palette / DOM。
 *
 * 约定的后端接口返回结构：
 *   fetchPage({ page, pageSize }) => Promise<{ list: Array, total: number }>
 *   - list：当前页元素数组，元素结构约定为 { id, name, type, iconClass }
 *   - total：总条数（用于计算总页数）
 * 若后端字段不同，在调用方做一次适配映射即可。
 */
export default class CustomElementsStore {
  constructor(config) {
    const { fetchPage, pageSize = 12 } = config || {}
    if (typeof fetchPage !== 'function') {
      throw new Error('[CustomElementsStore] 必须提供 fetchPage 分页拉取函数（见 modeler 的 customElements 配置）')
    }
    this._fetchPage = fetchPage
    this._pageSize = pageSize

    this._page = 1
    this._total = 0
    this._items = []
    this._loading = false
    this._error = null
    this._initialized = false
  }

  get page() {
    return this._page
  }

  get pageSize() {
    return this._pageSize
  }

  get total() {
    return this._total
  }

  get items() {
    return this._items
  }

  get loading() {
    return this._loading
  }

  get error() {
    return this._error
  }

  get initialized() {
    return this._initialized
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this._total / this._pageSize))
  }

  get hasPrev() {
    return this._page > 1
  }

  get hasNext() {
    return this._page < this.totalPages
  }

  /**
   * 拉取指定页码的数据（默认第 1 页）。
   * 请求失败时保留旧数据，错误信息可通过 error 读取。
   */
  async load(page = 1) {
    if (this._loading) return
    this._loading = true
    this._error = null
    try {
      const res = await this._fetchPage({ page, pageSize: this._pageSize })
      this._page = page
      this._total = Number(res && res.total) || 0
      this._items = (res && res.list) || []
      this._initialized = true
    } catch (err) {
      this._error = err
    } finally {
      this._loading = false
    }
  }

  async prev() {
    if (this.hasPrev) await this.load(this._page - 1)
  }

  async next() {
    if (this.hasNext) await this.load(this._page + 1)
  }
}
