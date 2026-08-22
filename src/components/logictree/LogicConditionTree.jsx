import { defineComponent } from 'vue'
import './logic-condition-tree.css'

const GROUP_OPERATORS = ['AND', 'OR']
const CONDITION_OPERATORS = ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'LIKE']

export function createGroup(operator = 'AND') {
  return { type: 'GROUP', operator, children: [] }
}

export function createCondition() {
  return { type: 'CONDITION', field: '', operator: 'EQ', value: '' }
}

/**
 * 逻辑条件树（Logic Condition Tree）
 * 节点分两类：GROUP（含 operator + children，可嵌套）与 CONDITION（叶子）。
 * 通过 v-model 绑定整棵树；子节点变更以不可变方式向上冒泡，
 * 子节点回传 null 表示删除自身。根节点 isRoot 时隐藏删除入口。
 */
const LogicConditionTree = defineComponent({
  name: 'LogicConditionTree',
  props: {
    modelValue: { type: Object, required: true },
    isRoot: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    function update(node) {
      emit('update:modelValue', node)
    }

    function patch(patchObj) {
      update({ ...props.modelValue, ...patchObj })
    }

    function onChildChange(index, child) {
      const children = [...props.modelValue.children]
      if (child === null) children.splice(index, 1)
      else children[index] = child
      patch({ children })
    }

    function removeSelf() {
      if (!props.isRoot) update(null)
    }

    function renderGroup(node) {
      return (
        <div class="lct-group">
          <div class="lct-group-header">
            <select
              class="lct-operator"
              value={node.operator}
              onChange={(e) => patch({ operator: e.target.value })}
            >
              {GROUP_OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            <span class="lct-count">{node.children.length} 个节点</span>
            <div class="lct-actions">
              <button
                type="button"
                class="lct-btn"
                onClick={() => onChildChange(node.children.length, createCondition())}
              >
                + 条件
              </button>
              <button
                type="button"
                class="lct-btn"
                onClick={() => onChildChange(node.children.length, createGroup())}
              >
                + 分组
              </button>
              {!props.isRoot && (
                <button type="button" class="lct-btn lct-btn-danger" onClick={removeSelf}>
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
              <LogicConditionTree
                key={index}
                modelValue={child}
                onUpdate:modelValue={(val) => onChildChange(index, val)}
              />
            ))}
          </div>
        </div>
      )
    }

    function renderCondition(node) {
      return (
        <div class="lct-condition">
          <input
            class="lct-input lct-field"
            placeholder="字段名"
            value={node.field}
            onInput={(e) => patch({ field: e.target.value })}
          />
          <select
            class="lct-input"
            value={node.operator}
            onChange={(e) => patch({ operator: e.target.value })}
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
            onInput={(e) => patch({ value: e.target.value })}
          />
          {!props.isRoot && (
            <button type="button" class="lct-btn lct-btn-danger" onClick={removeSelf}>
              删除
            </button>
          )}
        </div>
      )
    }

    return () => {
      const node = props.modelValue
      return node?.type === 'CONDITION' ? renderCondition(node) : renderGroup(node)
    }
  }
})

export default LogicConditionTree
