<script setup>
import { computed } from 'vue'
import {
  CircleCheck,
  CircleClose,
  InfoFilled,
  WarningFilled,
} from '@element-plus/icons-vue'
import { formatCurrency } from '@/utils/format'

const props = defineProps({
  confirmation: { type: Object, required: true },
})

defineEmits(['confirm', 'cancel'])

const riskLabel = computed(() => {
  const map = { low: '低', medium: '中', high: '高' }
  return map[props.confirmation.risk] || '中'
})

const isPending = computed(() => props.confirmation.status === 'pending')

const primaryLabel = computed(() => {
  if (props.confirmation.kind === 'purchase_order') return '创建草稿'
  if (props.confirmation.kind === 'purchase_order_action') {
    return props.confirmation.payload?.action === 'approve'
      ? '确认通过'
      : '确认提交'
  }
  if (props.confirmation.kind === 'refund_request') return '提交申请'
  if (props.confirmation.kind === 'store_create') return '创建门店'
  if (props.confirmation.kind === 'member_create') return '创建会员'
  if (props.confirmation.kind === 'product_create') return '创建商品'
  return props.confirmation.payload?.decision === 'rejected'
    ? '确认驳回'
    : '确认通过'
})

const primaryType = computed(() =>
  props.confirmation.payload?.decision === 'rejected' ? 'danger' : 'primary',
)

const note = computed(() => {
  if (props.confirmation.kind === 'purchase_order') {
    return '创建后仍可在「采购管理」修改并提交'
  }
  if (props.confirmation.kind === 'refund_request') {
    return '提交后进入审批，不会立即退款'
  }
  if (props.confirmation.kind === 'purchase_order_action') {
    return props.confirmation.payload?.action === 'approve'
      ? '通过后等待仓库验收'
      : '提交后进入审批'
  }
  if (props.confirmation.kind === 'store_create') {
    return '确认后立即创建门店档案'
  }
  if (props.confirmation.kind === 'member_create') {
    return '确认后立即写入会员档案'
  }
  if (props.confirmation.kind === 'product_create') {
    return '确认后立即创建商品档案'
  }
  return '确认后立即生效，并写入审计日志'
})

const stateText = computed(() => {
  const { status, doneText } = props.confirmation
  if (doneText) return doneText
  const map = {
    done: '已执行',
    cancelled: '已取消，未产生变更',
    failed: '执行失败',
  }
  return map[status] || status
})

const stateIcon = computed(() =>
  ['cancelled', 'failed'].includes(props.confirmation.status)
    ? CircleClose
    : CircleCheck,
)
</script>

<template>
  <section class="confirm" :class="`is-${confirmation.status}`">
    <div class="confirm-head">
      <div class="confirm-copy">
        <div class="confirm-kicker">
          <el-icon><InfoFilled /></el-icon>
          写操作确认
        </div>
        <h4>{{ confirmation.title }}</h4>
        <p class="confirm-summary">{{ confirmation.summary }}</p>
      </div>
      <span class="risk">风险 {{ riskLabel }}</span>
    </div>

    <div class="confirm-meta">
      <div v-for="item in confirmation.meta" :key="item.label">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <ul v-if="confirmation.items?.length" class="confirm-items">
      <li v-for="item in confirmation.items" :key="item.sku">
        <span class="item-name">{{ item.name }}</span>
        <span class="item-qty mono">
          ×{{ item.quantity }}
          <em v-if="item.unitPrice !== undefined">
            {{ formatCurrency(item.unitPrice, 2) }}
          </em>
        </span>
      </li>
    </ul>

    <div v-if="isPending" class="confirm-actions">
      <el-button
        :type="primaryType"
        size="small"
        @click="$emit('confirm', confirmation)"
      >
        {{ primaryLabel }}
      </el-button>
      <el-button text size="small" @click="$emit('cancel', confirmation)">
        取消
      </el-button>
      <span class="confirm-note">
        <el-icon v-if="confirmation.risk === 'high'"><WarningFilled /></el-icon>
        {{ note }}
      </span>
    </div>

    <div v-else class="confirm-state">
      <el-icon><component :is="stateIcon" /></el-icon>
      <span>{{ stateText }}</span>
    </div>
  </section>
</template>

<style scoped>
.confirm {
  padding: 13px;
  border: 1px solid #c0cbf6;
  border-radius: 12px;
  background: var(--accent-soft);
}

.confirm.is-done {
  border-color: #bfe2d4;
  background: var(--success-soft);
}

.confirm.is-cancelled,
.confirm.is-failed {
  border-color: var(--line);
  background: var(--surface-2);
}

.confirm-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.confirm-kicker {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--accent-deep);
  font-family: var(--sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.confirm-copy h4 {
  margin: 4px 0 0;
  color: var(--ink);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.45;
}

.confirm-summary {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.55;
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

.confirm-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
  padding: 9px 0;
  border-top: 1px dashed #c0cbf6;
  border-bottom: 1px dashed #c0cbf6;
}

.confirm-meta div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.confirm-meta span {
  color: var(--faint);
  font-size: 9.5px;
}

.confirm-meta strong {
  overflow: hidden;
  color: var(--text);
  font-size: 11.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.confirm-items {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 9px;
  max-height: 168px;
  overflow-y: auto;
}

.confirm-items li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-soft);
  font-size: 11.5px;
}

.item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-qty {
  flex: none;
  color: var(--accent-deep);
  font-weight: 650;
}

.item-qty em {
  margin-left: 6px;
  color: var(--muted);
  font-style: normal;
  font-weight: 500;
}

.confirm-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
}

.confirm-note {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  color: var(--faint);
  font-size: 9.5px;
}

.confirm-state {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 11px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}

.confirm.is-done .confirm-state {
  color: var(--success);
}
</style>
