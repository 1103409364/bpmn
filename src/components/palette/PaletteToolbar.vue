<script setup>
/**
 * 手风琴 palette 的收起/展开工具栏（声明式版，替代原先的 createElement 拼接）。
 *
 * 完全无状态：显隐交给 CSS（.open 类控制 toolbar / handle 的 display），
 * 点击直接调用 palette 服务的 open()/close()。
 * 宿主节点为 display: contents，因此 toolbar / handle 直接参与
 * .djs-palette 容器的布局：展开时工具栏在顶部，收起时手柄在左上角。
 */
const props = defineProps({
  palette: { type: Object, required: true }
})
</script>

<template>
  <div class="djs-accordion-palette-toolbar">
    <span class="djs-accordion-palette-title">工具栏</span>
    <button
      type="button"
      class="djs-accordion-palette-collapse"
      title="收起工具栏"
      @click.stop="props.palette.close()"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>

  <div
    class="djs-accordion-palette-handle"
    title="展开工具栏"
    @click.stop="props.palette.open()"
  >
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M14 2v4M8 10v4M16 18v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  </div>
</template>
