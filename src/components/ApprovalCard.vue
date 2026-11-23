<script setup>
import { computed } from 'vue'
import { CircleCheck, CircleClose, InfoFilled } from '@element-plus/icons-vue'
import { APPROVAL_STATUS } from '@/contracts/approval'

const props = defineProps({
  approval: { type: Object, required: true },
})

defineEmits(['submit', 'cancel'])

const riskLabel = computed(() => {
  const map = { low: '低', medium: '中', high: '高' }
  return map[props.approval.risk] || '中'
})

const stateText = computed(() => {
  const map = {
    [APPROVAL_STATUS.PENDING]: '等待你确认',
    [APPROVAL_STATUS.SUBMITTED]: '已提交，等待区域经理审批',
    [APPROVAL_STATUS.CANCELLED]: '已取消，未产生变更',
    [APPROVAL_STATUS.APPROVED]: '已通过',
    [APPROVAL_STATUS.REJECTED]: '已驳回',
  }
  return map[props.approval.status] || props.approval.status
})

const stateIcon = computed(() =>
  props.approval.status === APPROVAL_STATUS.REJECTED ||
  props.approval.status === APPROVAL_STATUS.CANCELLED
    ? CircleClose
    : CircleCheck,
)
</script>

<template>
  <section class="approval" :class="`is-${approval.status}`">
    <div class="approval-head">
      <div class="approval-copy">
        <div class="approval-kicker">
          <el-icon><InfoFilled /></el-icon>
          需要确认
        </div>
        <h4>{{ approval.summary }}</h4>
      </div>
      <span class="risk">风险 {{ riskLabel }}</span>
    </div>

    <div class="approval-meta">
      <div>
        <span>门店</span>
        <strong>{{ approval.storeName || '—' }}</strong>
      </div>
      <div>
        <span>SKU</span>
        <strong>{{ approval.items?.length || 0 }}</strong>
      </div>
      <div>
        <span>有效期</span>
        <strong>{{ approval.expiresAt || '—' }}</strong>
      </div>
    </div>

    <ul v-if="approval.items?.length" class="approval-items">
      <li v-for="item in approval.items" :key="item.sku">
        <span class="approval-item-name">{{ item.name }}</span>
        <span class="approval-item-qty mono">{{ item.quantity }}</span>
      </li>
    </ul>

    <div v-if="approval.status === APPROVAL_STATUS.PENDING" class="approval-actions">
      <el-button type="primary" size="small" @click="$emit('submit', approval)">
        提交审批
      </el-button>
      <el-button text size="small" @click="$emit('cancel', approval)">
        取消
      </el-button>
      <span class="approval-note">提交后进入区域经理审批</span>
    </div>

    <div v-else class="approval-state">
      <el-icon><component :is="stateIcon" /></el-icon>
      <span>{{ stateText }}</span>
    </div>
  </section>
</template>

<style scoped>
.approval {
  padding: 13px;
  border: 1px solid #c0cbf6;
  border-radius: 12px;
  background: var(--accent-soft);
}

.approval.is-submitted,
.approval.is-approved {
  border-color: #bfe2d4;
  background: var(--success-soft);
}

.approval.is-cancelled,
.approval.is-rejected {
  border-color: var(--line);
  background: var(--surface-2);
}

.approval-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.approval-kicker {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--accent-deep);
  font-family: var(--sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.approval-copy h4 {
  margin-top: 4px;
  color: var(--ink);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.45;
}

.risk {
  display: inline-flex;
  flex: none;
  align-items: center;
  min-height: 22px;
  padding: 1px 8px;
  border: 1px solid #c0cbf6;
  border-radius: 6px;
  background: var(--surface);
  color: var(--accent-deep);
  font-size: 10px;
  font-weight: 600;
}

.approval-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
  padding: 9px 0;
  border-top: 1px dashed #c0cbf6;
  border-bottom: 1px dashed #c0cbf6;
}

.approval-meta div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.approval-meta span {
  color: var(--faint);
  font-size: 9.5px;
}

.approval-meta strong {
  color: var(--text);
  font-size: 11.5px;
  font-weight: 600;
}

.approval-items {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 9px;
}

.approval-items li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-soft);
  font-size: 11.5px;
}

.approval-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.approval-item-qty {
  color: var(--accent-deep);
  font-weight: 650;
}

.approval-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
}

.approval-note {
  margin-left: auto;
  color: var(--faint);
  font-size: 9.5px;
}

.approval-state {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 11px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}

.approval.is-submitted .approval-state,
.approval.is-approved .approval-state {
  color: var(--success);
}
</style>
