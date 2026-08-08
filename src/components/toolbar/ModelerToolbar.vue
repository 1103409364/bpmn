<script setup>
// 顶部工具栏组件：标题 + 撤销/重做 + 缩放 + 预览 + 下载 + 保存。
// 只负责按钮 UI 与交互事件，具体逻辑通过 emit 抛给父组件（BpmnModeler）处理。
const props = defineProps({
  // 设计器顶部标题
  title: {
    type: String,
    default: ''
  },
  // modeler 是否初始化完成（初始化前不渲染按钮）
  modelerReady: {
    type: Boolean,
    default: false
  },
  // 撤销/重做按钮是否可用
  canUndo: {
    type: Boolean,
    default: false
  },
  canRedo: {
    type: Boolean,
    default: false
  },
  // 保存中状态（禁用保存按钮并显示"保存中..."）
  isSaving: {
    type: Boolean,
    default: false
  },
  // 所有面板是否已收起（用于预览按钮的高亮与提示）
  allPanelsCollapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['undo', 'redo', 'zoom-out', 'zoom-in', 'reset-zoom', 'toggle-panels', 'download', 'save'])
</script>

<template>
  <div class="bpmn-header">
    <div class="bpmn-header-left">
      <svg class="bpmn-icon" aria-hidden="true">
        <use href="#bpmn-icon-process" fill="#1d1d1f"></use>
      </svg>
      <span class="bpmn-title">{{ title || '流程设计器' }}</span>
    </div>
    <div class="bpmn-header-right">
      <template v-if="modelerReady">
        <button class="bpmn-btn" :disabled="!canUndo" @click="emit('undo')" title="撤销">撤销</button>
        <button class="bpmn-btn" :disabled="!canRedo" @click="emit('redo')" title="重做">重做</button>
        <span class="bpmn-divider"></span>
        <button class="bpmn-btn" @click="emit('zoom-out')" title="缩小">-</button>
        <button class="bpmn-btn" @click="emit('reset-zoom')" title="适应窗口">适应</button>
        <button class="bpmn-btn" @click="emit('zoom-in')" title="放大">+</button>
        <span class="bpmn-divider"></span>
        <button
          class="bpmn-btn"
          :class="{ 'bpmn-btn-active': allPanelsCollapsed }"
          @click="emit('toggle-panels')"
          :title="allPanelsCollapsed ? '退出预览' : '收起面板，预览流程'"
        >
          预览
        </button>
        <span class="bpmn-divider"></span>
        <button class="bpmn-btn" @click="emit('download', 'svg')">下载SVG</button>
        <button class="bpmn-btn" @click="emit('download', 'xml')">下载XML</button>
        <button class="bpmn-btn bpmn-btn-primary" :disabled="isSaving" @click="emit('save')">
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
      </template>
    </div>
  </div>
  <!-- bpmn 图标 sprite：供 <use href="#bpmn-icon-..."> 引用 -->
  <svg style="display: none" aria-hidden="true">
    <symbol id="bpmn-icon-process" viewBox="0 0 32 32">
      <path
        fill-rule="evenodd"
        d="M16.177 0l.137.002c.452.009.9.037 1.342.082.346.036.62.303.68.646l.437 2.536c.055.319.296.57.608.655.986.269 1.923.653 2.796 1.14.28.155.624.145.885-.039l2.083-1.47a.775.775 0 01.937.022c.86.699 1.645 1.484 2.343 2.343.22.27.223.653.023.937l-1.439 2.038a.833.833 0 00-.031.896c.512.889.92 1.846 1.204 2.855a.833.833 0 00.653.601l2.435.42c.342.059.61.333.645.679a15.928 15.928 0 01.08 2.064l-.003.114c-.012.382-.038.76-.077 1.134a.775.775 0 01-.645.68l-2.396.412a.835.835 0 00-.656.61 12.511 12.511 0 01-1.2 2.917.832.832 0 00.034.892l1.396 1.978c.2.284.196.667-.023.936a16.104 16.104 0 01-2.343 2.343.775.775 0 01-.937.023l-1.99-1.404a.833.833 0 00-.88-.026c-.907.516-1.886.922-2.916 1.2a.833.833 0 00-.61.656l-.414 2.396a.775.775 0 01-.679.646 16.096 16.096 0 01-3.312 0 .775.775 0 01-.679-.646l-.423-2.452a.834.834 0 00-.598-.636 12.474 12.474 0 01-1.468-.514 12.49 12.49 0 01-1.417-.68.833.833 0 00-.878.03l-2.026 1.43a.775.775 0 01-.937-.023 16.069 16.069 0 01-2.342-2.342.774.774 0 01-.024-.936l1.402-1.986a.833.833 0 00.032-.896 12.507 12.507 0 01-1.214-2.911.833.833 0 00-.655-.606l-2.386-.412a.775.775 0 01-.646-.678 16.097 16.097 0 010-3.314.775.775 0 01.646-.678l2.386-.412a.833.833 0 00.655-.606 12.507 12.507 0 011.214-2.911.833.833 0 00-.032-.896L3.552 6.853a.774.774 0 01.023-.936 16.091 16.091 0 012.343-2.343.775.775 0 01.937-.023l2.03 1.433c.26.177.6.182.874.028.915-.512 1.88-.9 2.87-1.167a.833.833 0 00.612-.656l.424-2.46a.775.775 0 01.679-.645C14.845.032 15.348.004 15.85 0h.326zM16 6.4c-5.302 0-9.6 4.297-9.6 9.599 0 5.302 4.298 9.6 9.6 9.6s9.6-4.298 9.6-9.6-4.298-9.6-9.6-9.6zm-3 4.283c0-1.425 1.637-2.203 2.715-1.29l5.69 4.815c.794.672.794 1.91 0 2.583l-5.69 4.815c-1.078.913-2.715.134-2.715-1.29z"
      />
    </symbol>
  </svg>
</template>

<style scoped>
.bpmn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.bpmn-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bpmn-icon {
  display: block;
  width: 24px;
  height: 24px;
}

.bpmn-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.bpmn-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bpmn-btn {
  height: 30px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.bpmn-btn:hover:not(:disabled) {
  border-color: #10b981;
  color: #10b981;
}

.bpmn-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.bpmn-btn-primary {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

.bpmn-btn-primary:hover:not(:disabled) {
  background: #059669;
  color: #fff;
}

.bpmn-btn-active {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

.bpmn-btn-active:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
  color: #fff;
}

.bpmn-divider {
  width: 1px;
  height: 20px;
  background: #e5e7eb;
  margin: 0 4px;
}
</style>
