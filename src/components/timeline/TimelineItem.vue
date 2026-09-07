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
  padding-top: 5px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;

}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12);
  flex-shrink: 0;
  z-index: 1;
}

.timeline-line {
  position: absolute;
  left: 7px;
  top: 12px;
  bottom: -25px;
  width: 2px;
  background: linear-gradient(180deg, #d1fae5 0%, #e5e7eb 100%);
}

.timeline-right {
  flex: 1;
  margin-left: 16px;
  min-width: 0;
}

.timeline-time {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.4;
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}

.timeline-card {
  background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.timeline-card:hover {
  box-shadow: 0 6px 18px rgba(16, 185, 129, 0.08);
  transform: translateY(-1px);
}

.timeline-card-header {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eef2f7;
}

.timeline-process-type {
  font-size: 13px;
  color: #059669;
  font-weight: 600;
}

.timeline-card-body {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.timeline-info {
  flex: 1;
  min-width: 0;
}

.info-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 14px;
  line-height: 1.6;
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
  word-break: break-word;
}

.view-detail-btn {
  padding: 7px 12px;
  font-size: 13px;
  color: #10b981;
  background-color: transparent;
  border: 1px solid rgba(16, 185, 129, 0.5);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  font-weight: 500;
}

.view-detail-btn:hover {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  border-color: transparent;
  box-shadow: 0 6px 14px rgba(16, 185, 129, 0.2);
}

.view-detail-btn:active {
  transform: translateY(1px);
}

@media (max-width: 640px) {
  .timeline-card-body {
    flex-direction: column;
    align-items: stretch;
  }

  .view-detail-btn {
    width: 100%;
  }
}
</style>
