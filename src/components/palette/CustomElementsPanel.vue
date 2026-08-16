<script setup>
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import { assign } from 'min-dash'

import { fetchCustomElements } from '../../api/customElements'

// BPMN 元素类型 -> 内置图标类名 的兜底映射（item.iconClass 未提供时使用）
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
 * 自定义元素面板（声明式版，接口请求在组件内完成）。
 *
 * 分页 / 搜索状态与接口请求全部收在本组件：onMounted 首载，watch 防抖搜索，
 * 请求用序号（seq）做竞态保护——后发请求未返回时丢弃先发的旧结果。
 * 状态变化由 Vue 自动驱动重渲染，无需任何手动 DOM 注入 / 重建。
 * - 搜索框：v-model + watch 防抖，回车立即搜索
 * - 状态提示：v-if 按状态渲染（加载中/失败重试/空结果）
 * - 分组列表：v-for 生成 <details>，折叠状态用响应式 Map 保存
 * - 分页条：:disabled 由 totalPages/hasPrev/hasNext/loading 派生
 * 挂载在 .djs-palette 容器内持久存在的宿主节点上（不被 diagram-js 的
 * _update() 重建），因此输入框焦点、光标位置天然保留。
 *
 * 约定的接口返回结构（fetchPage prop）：
 *   fetchPage({ page, pageSize, keyword }) => Promise<{ list, total }>
 *   - list：当前页元素数组，元素结构约定为 { id, name, type, group?, iconClass?, options?, businessData? }
 *   - total：总条数（用于计算总页数）
 *   - keyword：搜索关键字（名称模糊搜索），可为空字符串
 *   - businessData：创建元素时写入 businessObject 的业务数据对象（可选，
 *     示例字段 busId），见 handleCreate
 * 若后端字段不同，在传入 fetchPage 的调用方做一次适配映射即可。
 *
 * 默认 fetchPage 指向 src/api/customElements.js 的 mock 实现；接入真实后端时，
 * 修改下方 fetchPage 默认值（或改用其它 props 传入）即可。
 */
const props = defineProps({
  fetchPage: { type: Function, default: fetchCustomElements },
  pageSize: { type: Number, default: 12 },
  create: { type: Object, required: true },
  elementFactory: { type: Object, required: true },
  translate: { type: Function, required: true },
  groupName: { type: String, default: '自定义元素' }
})

function t(text) {
  return props.translate(text)
}

// ---------- 分页 / 搜索状态 ----------
const keyword = ref('') // 输入框当前值
const searchKw = ref('') // 已生效的搜索关键字（非空时处于搜索态）
const page = ref(1)
const total = ref(0)
const items = ref([])
const loading = ref(false)
const error = ref(null)
const initialized = ref(false)

// 请求序号：后发请求未返回时，先发的旧请求结果会被丢弃
let seq = 0

const searching = computed(() => !!searchKw.value)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / props.pageSize)))
const hasPrev = computed(() => page.value > 1)
const hasNext = computed(() => page.value < totalPages.value)

/**
 * 拉取指定页码的数据（默认第 1 页），带上当前搜索关键字。
 * 请求失败时保留旧数据，错误信息可通过 error 读取。
 */
async function fetch(pageNo = 1) {
  const current = ++seq
  loading.value = true
  error.value = null
  try {
    const res = await props.fetchPage({
      page: pageNo,
      pageSize: props.pageSize,
      keyword: searchKw.value
    })
    if (current !== seq) return
    page.value = pageNo
    total.value = Number(res && res.total) || 0
    items.value = (res && res.list) || []
    initialized.value = true
  } catch (err) {
    if (current !== seq) return
    error.value = err
  } finally {
    if (current === seq) loading.value = false
  }
}

// ---------- 搜索 ----------
let debounceTimer = null

watch(keyword, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(applySearch, 300)
})

function applySearch() {
  clearTimeout(debounceTimer)
  debounceTimer = null
  const kw = String(keyword.value || '').trim()
  if (kw === searchKw.value) return
  searchKw.value = kw
  fetch(1)
}

// ---------- 状态提示 ----------
const status = computed(() => {
  // 加载中由标题栏 spinner 承担（见模板 .djs-custom-elements-title-loading），此处只处理重试 / 空结果
  if (loading.value) return null
  if (!initialized.value && error.value) return { mode: 'retry', text: '加载失败，点击重试' }
  if (!items.value.length) return { mode: 'empty', text: searching.value ? '无匹配自定义元素' : '暂无自定义元素' }
  return null
})

// ---------- 分组 ----------
// 折叠状态 keyed by 分组名：翻页后已存在的分组保留用户的开合状态，新分组默认展开
const groupOpen = reactive(new Map())

const grouped = computed(() => {
  if (!initialized.value || !items.value.length) return []
  const groups = new Map()
  items.value.forEach((item) => {
    const name = item.group || props.groupName
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(item)
  })
  return Array.from(groups, ([name, list]) => ({ name, items: list }))
})

function isGroupOpen(name) {
  return groupOpen.has(name) ? groupOpen.get(name) : true
}

function onToggleGroup(name, event) {
  groupOpen.set(name, event.target.open)
}

// ---------- 分页 ----------
function prev() {
  if (hasPrev.value) fetch(page.value - 1)
}

function next() {
  if (hasNext.value) fetch(page.value + 1)
}

function reload() {
  fetch(1)
}

// ---------- 创建元素 ----------
function handleCreate(event, item) {
  const shape = props.elementFactory.createShape(
    assign({ type: item.type || 'bpmn:Task' }, item.options)
  )

  // 携带业务数据：把 item.businessData 写入 businessObject（示例字段 busId），
  // 创建后可在属性面板 / 保存时从元素上读取。
  //
  // 注意：用 businessObject.set() 写入的字段在保存时会序列化到 XML（作为属性）。
  // 若不想进 XML（仅内存生效），可改成直接赋值 businessObject.busId = ...，
  // 但直接赋值不会被 moddle 追踪，复制/粘贴重建 businessObject 时会丢失。
  const businessData = item.businessData
  if (businessData && typeof businessData === 'object') {
    const bo = shape.businessObject
    bo.name = item.name || bo.name // 默认节点名称：name 是 BPMN 声明属性（bpmn:BaseElement），直接赋值即可，会正常序列化到 XML，画布上的标签显示的就是 businessObject.name。注意：不能把 name 塞进 createShape 的 attrs，那只落在 shape 上、进不了 businessObject。
    Object.keys(businessData).forEach((key) => {
      if (businessData[key] != null) bo.set(key, businessData[key])
    })
  }

  props.create.start(event, shape)
}

onMounted(() => {
  fetch(1)
})

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="djs-custom-elements-float djs-custom-elements-panel">
    <!-- 区块标题：图标 + 标题，与下方默认分组区隔开；请求进行中在标题右侧显示加载提示 -->
    <div class="djs-custom-elements-title">
      <i class="bpmn-icon-service-task"></i>
      <span>{{ t(groupName) }}</span>
      <span v-if="loading" class="djs-custom-elements-title-loading">
        <span class="djs-custom-elements-spinner"></span>
      </span>
    </div>

    <!-- 搜索框：固定在分组区顶部 -->
    <div class="djs-custom-elements-search">
      <input
        class="djs-custom-elements-search-input"
        type="text"
        v-model="keyword"
        :placeholder="t('搜索自定义元素')"
        :aria-label="t('搜索自定义元素')"
        autocomplete="off"
        @keydown.enter.prevent="applySearch"
      />
    </div>

    <!-- 首载失败重试：位于搜索框与分组之间 -->
    <div
      v-if="status && status.mode === 'retry'"
      class="djs-custom-elements-float djs-custom-elements-status djs-custom-elements-status-retry"
      @click="reload"
    >
      {{ t(status.text) }}
    </div>

    <!-- 当前页自定义元素分组 -->
    <details
      v-for="group in grouped"
      :key="group.name"
      class="djs-accordion-group"
      :open="isGroupOpen(group.name)"
      @toggle="onToggleGroup(group.name, $event)"
    >
      <summary>{{ t(group.name) }}</summary>
      <div class="djs-palette-group">
        <div
          v-for="(item, index) in group.items"
          :key="item.id || index"
          class="entry"
          draggable="true"
          :class="item.iconClass || TYPE_ICON_MAP[item.type] || 'bpmn-icon-task'"
          :title="t(item.name || item.id || item.type)"
          @click="(event) => handleCreate(event, item)"
          @dragstart="(event) => handleCreate(event, item)"
        ></div>
      </div>
    </details>

    <!-- 空结果提示：面板底部、分页条上方 -->
    <div
      v-if="status && status.mode === 'empty'"
      class="djs-custom-elements-float djs-custom-elements-status djs-custom-elements-status-empty"
    >
      {{ t(status.text) }}
    </div>

    <!-- 分页条：面板最底部 -->
    <div
      v-if="initialized && !error && (totalPages > 1 || !items.length)"
      class="djs-custom-elements-float djs-custom-elements-pager"
    >
      <button
        type="button"
        class="djs-pager-btn djs-pager-prev"
        :disabled="!hasPrev || loading"
        aria-label="上一页"
        @click="prev"
      >&lsaquo;</button>
      <span class="djs-pager-info">{{ page }} / {{ totalPages }}</span>
      <button
        type="button"
        class="djs-pager-btn djs-pager-next"
        :disabled="!hasNext || loading"
        aria-label="下一页"
        @click="next"
      >&rsaquo;</button>
    </div>
  </div>
</template>
