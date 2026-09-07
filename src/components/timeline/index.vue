<script setup>
import TimelineItem from './TimelineItem.vue'

defineProps({
  items: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['view-detail'])

const handleViewDetail = (item) => {
  emit('view-detail', item)
}
</script>

<template>
  <div class="timeline">
    <TimelineItem
      v-for="(item, index) in items"
      :key="item.id"
      :item="item"
      :is-last="index === items.length - 1"
      @view-detail="handleViewDetail"
    />
  </div>
</template>

<style scoped>
.timeline {
  padding: 16px 0 8px;
  position: relative;
}
</style>
