<script setup>
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import { assign } from 'min-dash'

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
 * 自定义元素面板（声明式版）。
 *
 * 数据全部来自 props.store（reactive 包裹的 CustomElementsStore），
 * 状态变化由 Vue 自动驱动重渲染，无需任何手动 DOM 注入/重建。
 * - 搜索框：v-model + watch 防抖，回车立即搜索
 * - 状态提示：v-if 按 store 状态渲染（加载中/失败重试/空结果）
 * - 分组列表：v-for 生成 <details>，折叠状态用响应式 Map 保存
 * - 分页条：:disabled 由 store 的 hasPrev/hasNext/loading 派生
 * 挂载在 .djs-palette 容器内持久存在的宿主节点上（不被 diagram-js 的
 * _update() 重建），因此输入框焦点、光标位置天然保留。
 */
const props = defineProps({
  store: { type: Object, required: true },
  create: { type: Object, required: true },
  elementFactory: { type: Object, required: true },
  translate: { type: Function, required: true },
  groupName: { type: String, default: '自定义元素' }
})

function t(text) {
  return props.translate(text)
}

// ---------- 搜索 ----------
const keyword = ref('')
let debounceTimer = null

watch(keyword, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(applySearch, 300)
})

function applySearch() {
  clearTimeout(debounceTimer)
  debounceTimer = null
  const store = props.store
  const kw = String(keyword.value || '').trim()
  if (kw === store.keyword) return
  store.search(kw)
}

// ---------- 状态提示 ----------
const status = computed(() => {
  const store = props.store
  if (!store.initialized && !store.error) return { mode: 'loading', text: '加载中...' }
  if (!store.initialized && store.error) return { mode: 'retry', text: '加载失败，点击重试' }
  if (!store.items.length) return { mode: 'empty', text: store.searching ? '无匹配自定义元素' : '暂无自定义元素' }
  return null
})

// ---------- 分组 ----------
// 折叠状态 keyed by 分组名：翻页后已存在的分组保留用户的开合状态，新分组默认展开
const groupOpen = reactive(new Map())

const grouped = computed(() => {
  const store = props.store
  if (!store.initialized || !store.items.length) return []
  const groups = new Map()
  store.items.forEach((item) => {
    const name = item.group || props.groupName
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(item)
  })
  return Array.from(groups, ([name, items]) => ({ name, items }))
})

function isGroupOpen(name) {
  return groupOpen.has(name) ? groupOpen.get(name) : true
}

function onToggleGroup(name, event) {
  groupOpen.set(name, event.target.open)
}

// ---------- 分页 ----------
function prev() {
  props.store.prev()
}

function next() {
  props.store.next()
}

function reload() {
  props.store.load(1)
}

// ---------- 创建元素 ----------
function handleCreate(event, item) {
  const shape = props.elementFactory.createShape(
    assign({ type: item.type || 'bpmn:Task' }, item.options)
  )
  props.create.start(event, shape)
}

onMounted(() => {
  props.store.load(1)
})

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="djs-custom-elements-float djs-custom-elements-panel">
    <!-- 区块标题：图标 + 标题，与下方默认分组区隔开 -->
    <div class="djs-custom-elements-title">
      <i class="bpmn-icon-service-task"></i>
      <span>{{ t(groupName) }}</span>
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

    <!-- 加载中 / 首载失败重试：位于搜索框与分组之间 -->
    <div
      v-if="status && status.mode === 'loading'"
      class="djs-custom-elements-float djs-custom-elements-status djs-custom-elements-status-loading"
    >
      {{ t(status.text) }}
    </div>
    <div
      v-else-if="status && status.mode === 'retry'"
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
      v-if="store.initialized && !store.error && (store.totalPages > 1 || !store.items.length)"
      class="djs-custom-elements-float djs-custom-elements-pager"
    >
      <button
        type="button"
        class="djs-pager-btn djs-pager-prev"
        :disabled="!store.hasPrev || store.loading"
        aria-label="上一页"
        @click="prev"
      >&lsaquo;</button>
      <span class="djs-pager-info">{{ store.page }} / {{ store.totalPages }}</span>
      <button
        type="button"
        class="djs-pager-btn djs-pager-next"
        :disabled="!store.hasNext || store.loading"
        aria-label="下一页"
        @click="next"
      >&rsaquo;</button>
    </div>
  </div>
</template>
