# Toast 实现原理

## 架构

- `src/composables/useToast.js` — 模块级单例状态 + `showToast` 触发函数
- `src/components/Toast.vue` — 渲染 HTML/CSS，内部消费单例 ref
- `src/App.vue`、`src/components/BpmnModeler.vue` — 业务侧，仅调用 `showToast`

## 核心原理：模块级单例状态

`toast` 与 `timer` 是 **模块顶层变量**（ES Module 加载时执行一次，存于模块作用域），
不是函数内部变量，所以每次调用 `useToast()` 返回的都是**同一个 ref**：

```js
// useToast.js
const toast = ref('')   // 模块级，只创建一次
let timer = null

export function useToast(duration = 2500) {
  function showToast(msg) {
    toast.value = msg                    // 改的是模块级 ref
    clearTimeout(timer)
    timer = setTimeout(() => (toast.value = ''), duration)
  }
  return { toast, showToast }            // 每次返回同一个 ref
}
```

ES Module 是单例缓存的：同一模块被多次 `import` 只会执行一次，
因此任何地方 `useToast()` 拿到的 `toast` 都是同一个引用。

## 多个"消费者"共享同一 ref

| 位置 | 拿到什么 | 职责 |
|------|---------|------|
| `Toast.vue` | `const { toast } = useToast()` | 只读渲染（`v-if="toast"` / `{{ toast }}`） |
| `App.vue` | `const { showToast } = useToast()` | 只写状态（保存成功提示） |
| `BpmnModeler.vue` | `const { showToast } = useToast()` | 只写状态（画布变更提示，`commandStack.changed` 内直接触发） |

组件内部反馈（如"已变更，请记得保存"）不再冒泡到父组件，
靠单例 composable 在组件内直接 `showToast`，父组件无需感知。

## 触发链路

```
BpmnModeler.vue (commandStack.changed):
   showToast('已变更，请记得保存')
   └─ toast.value = '已变更，请记得保存'   ← 改模块级 ref
        └─ Vue 响应式系统侦测到变化
             └─ 依赖该 ref 的 Toast.vue 重新渲染
                  → v-if="toast" 为真 → 提示显示
2.5s 后 timer 触发 → toast.value = '' → Toast.vue 再次更新 → 隐藏
```

## 结论

- **业务组件写状态，Toast 只读渲染**，靠模块单例的共享 ref + Vue 响应式依赖追踪连接。
- 调用方无需感知 Toast 组件的存在，也无须 props/事件传值。
- `<Toast />` 在页面中出现一次即可，位置不影响功能。
