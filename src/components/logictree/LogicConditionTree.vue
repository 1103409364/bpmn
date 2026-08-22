<script setup lang="jsx">
import { Fragment } from 'vue'

// 节点分两类：GROUP（operator + children，可嵌套）与 CONDITION（叶子）。
// 组件无自身状态，整棵树由外部 v-model 持有；每层通过回调以不可变方式向上提交，
// 回调收到 null 表示删除该子节点。根节点（isRoot）隐藏删除入口。
const GROUP_OPERATORS = ['AND', 'OR']
const CONDITION_OPERATORS = ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'LIKE']

function createGroup(operator = 'AND') {
  return { type: 'GROUP', operator, children: [] }
}

function createCondition() {
  return { type: 'CONDITION', field: '', operator: 'EQ', value: '' }
}

const props = defineProps({
  modelValue: { type: Object, required: true },
  isRoot: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

function renderGroup(node, isRoot, onChange) {
  const setChildren = (children) => onChange({ ...node, children })

  const changeChild = (index, child) => {
    const children = [...node.children]
    if (child === null) children.splice(index, 1)
    else children[index] = child
    setChildren(children)
  }

  return (
    <div class="lct-group">
      <div class="lct-group-header">
        <select
          class="lct-operator"
          value={node.operator}
          onChange={(e) => onChange({ ...node, operator: e.target.value })}
        >
          {GROUP_OPERATORS.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
        <span class="lct-count">{node.children.length} 个节点</span>
        <div class="lct-actions">
          <button type="button" class="lct-btn" onClick={() => setChildren([...node.children, createCondition()])}>
            + 条件
          </button>
          <button type="button" class="lct-btn" onClick={() => setChildren([...node.children, createGroup()])}>
            + 分组
          </button>
          {!isRoot && (
            <button type="button" class="lct-btn lct-btn-danger" onClick={() => onChange(null)}>
              删除
            </button>
          )}
        </div>
      </div>
      <div class="lct-children">
        {node.children.length === 0 && (
          <div class="lct-empty">空分组，点击右上角「+ 条件 / + 分组」</div>
        )}
        {node.children.map((child, index) => (
          <Fragment key={index}>
            {renderNode(child, false, (val) => changeChild(index, val))}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function renderCondition(node, isRoot, onChange) {
  return (
    <div class="lct-condition">
      <input
        class="lct-input lct-field"
        placeholder="字段名"
        value={node.field}
        onInput={(e) => onChange({ ...node, field: e.target.value })}
      />
      <select
        class="lct-input"
        value={node.operator}
        onChange={(e) => onChange({ ...node, operator: e.target.value })}
      >
        {CONDITION_OPERATORS.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
      <input
        class="lct-input lct-value"
        placeholder="值"
        value={node.value}
        onInput={(e) => onChange({ ...node, value: e.target.value })}
      />
      {!isRoot && (
        <button type="button" class="lct-btn lct-btn-danger" onClick={() => onChange(null)}>
          删除
        </button>
      )}
    </div>
  )
}

function renderNode(node, isRoot, onChange) {
  return node?.type === 'CONDITION'
    ? renderCondition(node, isRoot, onChange)
    : renderGroup(node, isRoot, onChange)
}

// 渲染入口：script setup 不能直接 return 渲染函数，
// 以绑定形式暴露为函数组件，再由模板挂载
const TreeRender = () =>
  renderNode(props.modelValue, props.isRoot, (node) => emit('update:modelValue', node))
</script>

<template>
  <TreeRender />
</template>

<style>
.lct-group {
  min-width: 320px;
  padding: 8px;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
}

.lct-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.lct-operator {
  padding: 2px 10px;
  font-weight: 600;
  color: #2563eb;
  cursor: pointer;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
}

.lct-count {
  font-size: 12px;
  color: #9ca3af;
}

.lct-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.lct-btn {
  padding: 3px 10px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  background: #f9fafb;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

.lct-btn:hover {
  background: #f3f4f6;
}

.lct-btn-danger {
  color: #dc2626;
  border-color: #fecaca;
}

.lct-btn-danger:hover {
  background: #fef2f2;
}

.lct-children {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 10px;
  padding-left: 14px;
  border-left: 2px dashed #d1d5db;
}

.lct-empty {
  padding: 4px 0 4px 16px;
  font-size: 12px;
  color: #9ca3af;
}

.lct-condition {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  min-width: 320px;
  padding: 4px 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.lct-input {
  height: 28px;
  padding: 0 8px;
  font-size: 13px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
}

.lct-input:focus {
  border-color: #2563eb;
}

.lct-field {
  width: 140px;
}

.lct-value {
  width: 120px;
}
</style>
