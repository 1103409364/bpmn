<script setup>
const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  isLast: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['view-detail'])

const handleViewDetail = () => {
  emit('view-detail', props.item)
}
</script>

<template>
  <div class="timeline-item" :class="{ 'is-last': isLast }">
    <div class="timeline-left">
      <div class="timeline-dot"></div>
      <div class="timeline-line" v-if="!isLast"></div>
    </div>
    <div class="timeline-right">
      <div class="timeline-time">{{ item.time }}</div>
      <div class="timeline-card">
        <div class="timeline-card-header">
          <span class="timeline-process-type">操作类型：{{ item.processType }}</span>
        </div>
        <div class="timeline-card-body">
          <div class="timeline-info">
            <div class="info-row">
              <span class="info-label">备注：</span>
              <span class="info-value">{{ item.remark }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">操作员：</span>
              <span class="info-value">{{ item.operator }}</span>
            </div>
          </div>
          <button class="view-detail-btn" @click="handleViewDetail">查看详情</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-item {
  display: flex;
  position: relative;
  padding-bottom: 24px;
}

.timeline-item.is-last {
  padding-bottom: 0;
}

.timeline-left {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 12px;
  flex-shrink: 0;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #10b981;
  flex-shrink: 0;
  z-index: 1;
}

.timeline-line {
  position: absolute;
  left: 5px;
  top: 12px;
  bottom: -25px;
  width: 2px;
  background-color: #e5e7eb;
}

.timeline-right {
  flex: 1;
  margin-left: 16px;
}

.timeline-time {
  font-size: 13px;
  color: #6b7280;
  line-height: 12px;
  margin-bottom: 8px;
}

.timeline-card {
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px 16px;
}

.timeline-card-header {
  margin-bottom: 8px;
}

.timeline-process-type {
  font-size: 13px;
  color: #10b981;
  font-weight: 500;
}

.timeline-card-body {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.timeline-info {
  flex: 1;
}

.info-row {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 14px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  color: #6b7280;
  flex-shrink: 0;
}

.info-value {
  color: #374151;
}

.view-detail-btn {
  padding: 6px 12px;
  font-size: 13px;
  color: #10b981;
  background-color: transparent;
  border: 1px solid #10b981;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.view-detail-btn:hover {
  background-color: #10b981;
  color: white;
}
</style>
