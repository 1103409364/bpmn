<script setup>
import { ref } from 'vue'
import Timeline from '@/components/timeline/index.vue'

const timelineData = ref([
  {
    id: 1,
    time: '2024-01-15 14:30:00',
    processType: '提交',
    remark: '提交审批申请，请尽快审批',
    operator: '张三'
  },
  {
    id: 2,
    time: '2024-01-15 15:00:00',
    processType: '审批',
    remark: '同意通过，流程继续',
    operator: '李四'
  },
  {
    id: 3,
    time: '2024-01-15 16:30:00',
    processType: '驳回',
    remark: '资料不完整，请补充后重新提交',
    operator: '王五'
  },
  {
    id: 4,
    time: '2024-01-16 09:00:00',
    processType: '重新提交',
    remark: '已补充相关资料',
    operator: '张三'
  },
  {
    id: 5,
    time: '2024-01-16 10:30:00',
    processType: '完成',
    remark: '审批通过，流程结束',
    operator: '系统'
  }
])

const handleViewDetail = (item) => {
  alert(`查看详情:\n\n时间: ${item.time}\n类型: ${item.processType}\n备注: ${item.remark}\n操作员: ${item.operator}`)
}
</script>

<template>
  <div class="timeline-demo">
    <h1 class="demo-title">时间线组件演示</h1>
    <div class="demo-container">
      <Timeline :items="timelineData" @view-detail="handleViewDetail" />
    </div>
  </div>
</template>

<style scoped>
.timeline-demo {
  padding: 24px;
  max-width: 600px;
  margin: 0 auto;
}

.demo-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 24px;
}

.demo-container {
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 24px;
}
</style>
