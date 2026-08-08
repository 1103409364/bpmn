# Toast 实现原理

## 架构

- `src/composables/useToast.js` — 模块级单例状态 + `showToast` 触发函数 + 命令式挂载逻辑
- `src/components/Toast.vue` — 渲染 HTML/CSS，内部消费模块级 `toast` ref
- `src/App.vue` — 业务侧只需调用 `showToast`，无需显式引入或渲染 `<Toast />`

## 核心原理：模块级单例状态

`toast` 与 `timer` 是 **模块顶层变量**（ES Module 加载时执行一次，存于模块作用域），
不是函数内部变量，所以每次调用 `useToast()` 返回的都是**同一个 ref**：

```js
// useToast.js
const toast = ref('')
let timer = null
let mounted = false

export function useToast(duration = 2500) {
  function showToast(msg) {
    mountToastComponent()
    toast.value = msg
    clearTimeout(timer)
    timer = setTimeout(() => (toast.value = ''), duration)
  }
  return { showToast }
}
```

- `mountToastComponent()` 会在首次调用 `showToast` 时，自动创建一个 DOM 容器并把 `Toast.vue` 程序化挂载到 `document.body`。
- 这让业务代码只需要调用 `showToast(...)`，无需在页面模板里写 `<Toast />`。

## 多个调用者共享同一 ref

| 位置        | 拿到什么                           | 职责                                       |
| ----------- | ---------------------------------- | ------------------------------------------ |
| `Toast.vue` | `const { toast } = useToast()`     | 只读渲染（`v-if="toast"` / `{{ toast }}`） |
| 任何业务文件 | `const { showToast } = useToast()` | 触发提示内容显示                             |

> 注：由于 `Toast.vue` 已由 `useToast` 命令式挂载，业务文件无需显式引入组件。

## 触发链路

```txt
业务代码:
   showToast('流程保存成功')
   └─ mountToastComponent() 在首次调用时挂载 Toast.vue
   └─ toast.value = '流程保存成功'       ← 改模块级 ref
        └─ Vue 响应式系统侦测到变化
             └─ 依赖该 ref 的 Toast.vue 重新渲染
                  → v-if="toast" 为真 → 提示显示
2.5s 后 timer 触发 → toast.value = '' → Toast.vue 再次更新 → 隐藏
```

## 结论

- **业务侧只需命令式调用 `showToast`，无需显式引入或渲染 `<Toast />`。**
- `useToast` 负责挂载组件和管理定时器，业务逻辑更简洁。
- Toast 仍然使用 Vue 响应式系统连接状态与视图，但组件渲染由 `useToast` 自动托管。
