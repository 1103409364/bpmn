/**
 * 自定义元素分页状态管理。
 *
 * 职责：向后端分页拉取自定义元素数据，并暴露当前页数据与翻页能力。
 * 与渲染解耦：只负责数据，不碰 palette / DOM。
 *
 * 约定的后端接口返回结构：
 *   fetchPage({ page, pageSize, keyword }) => Promise<{ list: Array, total: number }>
 *   - list：当前页元素数组，元素结构约定为 { id, name, type, group?, iconClass?, options? }
 *   - total：总条数（用于计算总页数）
 *   - keyword：搜索关键字（名称模糊搜索），可为空字符串
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

    // 搜索关键字；非空时表示处于搜索态
    this._keyword = ''

    // 请求序号：后发请求未返回时，先发的旧请求结果会被丢弃
    this._seq = 0
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

  get keyword() {
    return this._keyword
  }

  get searching() {
    return !!this._keyword
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
   * 按关键字搜索：更新关键字并回到第 1 页拉取。
   * 传入空字符串表示清除搜索。
   */
  async search(keyword) {
    this._keyword = keyword || ''
    await this.load(1)
  }

  /**
   * 拉取指定页码的数据（默认第 1 页），带上当前关键字。
   * 请求失败时保留旧数据，错误信息可通过 error 读取。
   * 若拉取期间又发起了新请求，本请求结果会被丢弃（序号校验）。
   */
  async load(page = 1) {
    const seq = ++this._seq
    this._loading = true
    this._error = null
    try {
      const res = await this._fetchPage({ page, pageSize: this._pageSize, keyword: this._keyword })
      if (seq !== this._seq) return
      this._page = page
      this._total = Number(res && res.total) || 0
      this._items = (res && res.list) || []
      this._initialized = true
    } catch (err) {
      if (seq !== this._seq) return
      this._error = err
    } finally {
      if (seq === this._seq) this._loading = false
    }
  }

  async prev() {
    if (this.hasPrev) await this.load(this._page - 1)
  }

  async next() {
    if (this.hasNext) await this.load(this._page + 1)
  }
}
