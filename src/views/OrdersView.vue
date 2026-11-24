<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index'
import { Download, Search } from '@element-plus/icons-vue'
import { downloadCsv } from '@/api/client'
import TablePagination from '@/components/TablePagination.vue'
import { useOrdersStore } from '@/stores/orders'
import { useAuthStore } from '@/stores/auth'
import { stores } from '@/mocks/data'
import {
  formatCurrency,
  formatNumber,
  statusLabel,
  statusTone,
} from '@/utils/format'

const orders = useOrdersStore()
const auth = useAuthStore()

const search = ref('')
const statusFilter = ref('all')
const storeFilter = ref(
  auth.roleKey === 'store_manager' ? auth.user?.storeId || 'all' : 'all',
)
const detailVisible = ref(false)
const exporting = ref(false)

const storeOptions = computed(() => {
  if (auth.roleKey === 'owner') return stores
  if (auth.roleKey === 'store_manager') {
    return stores.filter((store) => store.id === auth.user?.storeId)
  }
  return stores.filter((store) => store.region === auth.user?.region)
})

const filteredOrders = computed(() => {
  if (orders.remote) return orders.orders
  const keyword = search.value.trim().toLowerCase()
  return orders.orders.filter((item) => {
    if (statusFilter.value !== 'all' && item.status !== statusFilter.value) {
      return false
    }
    if (storeFilter.value !== 'all' && item.storeId !== storeFilter.value) {
      return false
    }
    if (!keyword) return true
    return (
      item.id.toLowerCase().includes(keyword) ||
      item.memberName.toLowerCase().includes(keyword) ||
      item.storeName.toLowerCase().includes(keyword)
    )
  })
})

const page = ref(1)
const pageSize = ref(10)

// 远端模式由服务端分页，演示模式在前端切片
const visibleOrders = computed(() => {
  if (orders.remote) return orders.orders
  const start = (page.value - 1) * pageSize.value
  return filteredOrders.value.slice(start, start + pageSize.value)
})

const totalCount = computed(() =>
  orders.remote ? orders.total : filteredOrders.value.length,
)

let searchTimer = null

function loadOrders() {
  orders
    .refresh({
      page: page.value,
      pageSize: pageSize.value,
      status: statusFilter.value,
      storeId: storeFilter.value,
      search: search.value.trim(),
    })
    .catch((error) => {
      ElMessage.error(`订单数据加载失败：${error.message}`)
    })
}

function resetAndLoad() {
  if (page.value !== 1) {
    page.value = 1
    return
  }
  loadOrders()
}

watch([page, pageSize], loadOrders)
watch([statusFilter, storeFilter], resetAndLoad)
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(resetAndLoad, 300)
})

onMounted(loadOrders)
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

function exportOrders() {
  if (!orders.remote) {
    ElMessage.warning('演示模式暂不支持服务端导出')
    return
  }
  const params = new URLSearchParams()
  if (storeFilter.value !== 'all') params.set('storeId', storeFilter.value)
  if (statusFilter.value !== 'all') params.set('status', statusFilter.value)
  if (search.value.trim()) params.set('search', search.value.trim())
  const suffix = params.toString() ? `?${params.toString()}` : ''
  exporting.value = true
  downloadCsv(`/api/exports/orders${suffix}`, 'retailos-orders.csv')
    .then((filename) => ElMessage.success(`已导出 ${filename}`))
    .catch((error) => ElMessage.error(`导出失败：${error.message}`))
    .finally(() => {
      exporting.value = false
    })
}

async function openDetail(row) {
  try {
    await orders.loadDetail(row.id)
    detailVisible.value = true
  } catch (error) {
    ElMessage.error(`订单详情加载失败：${error.message}`)
  }
}

const refundDialog = ref(false)
const refundSaving = ref(false)
const refundTarget = ref(null)
const refundForm = reactive({
  amount: 0,
  reason: '',
})

const refundableOf = computed(() => {
  if (!refundTarget.value) return 0
  return Number(
    refundTarget.value.refundableAmount ??
      Number(refundTarget.value.amount) -
        Number(refundTarget.value.refundedAmount || 0),
  )
})

function openRefund(row) {
  refundTarget.value = row
  refundForm.amount = refundableOf.value
  refundForm.reason = ''
  refundDialog.value = true
}

async function submitRefund() {
  if (!refundTarget.value) return
  const amount = Number(refundForm.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    ElMessage.warning('请输入有效的退款金额')
    return
  }
  if (amount > refundableOf.value + 0.001) {
    ElMessage.warning(`退款金额不能超过可退金额 ${formatCurrency(refundableOf.value)}`)
    return
  }
  if (!refundForm.reason.trim()) {
    ElMessage.warning('请填写退款原因')
    return
  }

  refundSaving.value = true
  try {
    await orders.refund(refundTarget.value.id, {
      amount,
      reason: refundForm.reason.trim(),
    })
    refundDialog.value = false
    ElMessage.success(
      orders.remote
        ? '退款申请已提交，等待区域经理或企业老板审批'
        : '退款已处理',
    )
    if (orders.remote && detailVisible.value) {
      await orders.loadDetail(refundTarget.value.id).catch(() => {})
    }
  } catch (error) {
    ElMessage.error(`退款失败：${error.message}`)
  } finally {
    refundSaving.value = false
  }
}
</script>

<template>
  <div class="page orders-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">订单管理</h1>
        <p class="page-subtitle">
          销售订单、订单详情与退款处理
        </p>
      </div>

      <div class="page-head-actions">
        <el-select
          v-model="storeFilter"
          class="filter-select"
          :disabled="auth.roleKey === 'store_manager'"
        >
          <el-option v-if="auth.roleKey !== 'store_manager'" label="全部门店" value="all" />
          <el-option
            v-for="store in storeOptions"
            :key="store.id"
            :label="`${store.city} · ${store.name}`"
            :value="store.id"
          />
        </el-select>
        <el-select v-model="statusFilter" class="filter-select">
          <el-option label="全部状态" value="all" />
          <el-option label="已支付" value="paid" />
          <el-option label="部分退款" value="partially_refunded" />
          <el-option label="已退款" value="refunded" />
        </el-select>
        <el-input
          v-model="search"
          class="search-input"
          placeholder="搜索订单号、会员或门店"
          :prefix-icon="Search"
          clearable
        />
        <el-button
          :icon="Download"
          :loading="exporting"
          @click="exportOrders"
        >
          导出
        </el-button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat">
        <span>订单总数</span>
        <strong class="tabular">{{ formatNumber(orders.summary.total) }}</strong>
        <small>当前筛选范围</small>
      </div>
      <div class="stat is-success">
        <span>已支付</span>
        <strong class="tabular">{{ formatNumber(orders.summary.paid) }}</strong>
        <small>正常交易订单</small>
      </div>
      <div class="stat is-warning">
        <span>已退款</span>
        <strong class="tabular">{{ formatNumber(orders.summary.refunded) }}</strong>
        <small>已完成退款</small>
      </div>
      <div class="stat">
        <span>销售金额</span>
        <strong class="tabular">{{ formatCurrency(orders.summary.amount) }}</strong>
        <small>含退款前金额</small>
      </div>
    </div>

    <section class="card" v-loading="orders.loading">
      <el-table :data="visibleOrders" size="default" empty-text="暂无订单">
        <el-table-column prop="id" label="订单号" min-width="196" />
        <el-table-column prop="storeName" label="门店" min-width="96" />
        <el-table-column prop="memberName" label="会员" min-width="96" />
        <el-table-column label="商品数" align="right" width="80">
          <template #default="{ row }">
            <span class="tabular">{{ formatNumber(row.itemCount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="金额" align="right" width="104">
          <template #default="{ row }">
            <span class="tabular">{{ formatCurrency(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="paymentMethod" label="支付方式" min-width="96" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" effect="light" :type="statusTone(row.status)">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="下单时间" min-width="140" />
        <el-table-column label="操作" width="132" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">
              详情
            </el-button>
            <el-button
              v-if="['paid', 'partially_refunded'].includes(row.status)"
              link
              type="warning"
              @click="openRefund(row)"
            >
              退款
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <TablePagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="totalCount"
      />
    </section>

    <el-drawer
      v-model="detailVisible"
      title="订单详情"
      size="480px"
      class="order-detail"
    >
      <div v-if="orders.detail" class="order-detail-body">
        <div class="order-detail-head">
          <div>
            <div class="order-detail-id">{{ orders.detail.id }}</div>
            <div class="muted">
              {{ orders.detail.storeName }} · {{ orders.detail.createdAt }}
            </div>
          </div>
          <el-tag effect="light" :type="statusTone(orders.detail.status)">
            {{ statusLabel(orders.detail.status) }}
          </el-tag>
        </div>

        <div class="order-meta">
          <div>
            <span>会员</span>
            <strong>{{ orders.detail.memberName }}</strong>
          </div>
          <div>
            <span>支付方式</span>
            <strong>{{ orders.detail.paymentMethod }}</strong>
          </div>
          <div>
            <span>商品数</span>
            <strong class="tabular">{{ formatNumber(orders.detail.itemCount) }}</strong>
          </div>
          <div>
            <span>金额</span>
            <strong class="tabular">{{ formatCurrency(orders.detail.amount) }}</strong>
          </div>
          <div v-if="Number(orders.detail.refundedAmount || 0) > 0">
            <span>已退款</span>
            <strong class="tabular">
              {{ formatCurrency(orders.detail.refundedAmount) }}
            </strong>
          </div>
          <div v-if="Number(orders.detail.refundedAmount || 0) > 0">
            <span>可退金额</span>
            <strong class="tabular">
              {{ formatCurrency(orders.detail.refundableAmount) }}
            </strong>
          </div>
        </div>

        <div
          v-if="orders.detail.refundReason"
          class="order-refund-reason"
        >
          <span>退款原因</span>
          <p>{{ orders.detail.refundReason }}</p>
        </div>

        <el-table :data="orders.detail.items" size="small">
          <el-table-column prop="name" label="商品" min-width="160" />
          <el-table-column label="数量" align="right" width="64">
            <template #default="{ row }">
              <span class="tabular">{{ row.quantity }}</span>
            </template>
          </el-table-column>
          <el-table-column label="小计" align="right" width="92">
            <template #default="{ row }">
              <span class="tabular">{{ formatCurrency(row.amount) }}</span>
            </template>
          </el-table-column>
        </el-table>

        <el-button
          v-if="['paid', 'partially_refunded'].includes(orders.detail.status)"
          type="warning"
          class="order-refund"
          @click="openRefund(orders.detail)"
        >
          退款
        </el-button>
      </div>
    </el-drawer>

    <el-dialog
      v-model="refundDialog"
      title="申请退款"
      width="440px"
      class="refund-dialog"
    >
      <div v-if="refundTarget" class="refund-summary">
        <div>
          <span>订单号</span>
          <strong class="mono">{{ refundTarget.id }}</strong>
        </div>
        <div>
          <span>订单金额</span>
          <strong class="tabular">{{ formatCurrency(refundTarget.amount) }}</strong>
        </div>
        <div>
          <span>可退金额</span>
          <strong class="tabular">{{ formatCurrency(refundableOf) }}</strong>
        </div>
      </div>

      <el-form label-position="top" class="refund-form">
        <el-form-item label="退款金额">
          <el-input-number
            v-model="refundForm.amount"
            :min="0.01"
            :max="refundableOf"
            :precision="2"
            :step="1"
            class="full-width"
          />
        </el-form-item>
        <el-form-item label="退款原因">
          <el-input
            v-model="refundForm.reason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="例如：商品破损，顾客申请部分退款"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="refundDialog = false">取消</el-button>
        <el-button
          type="warning"
          :loading="refundSaving"
          class="refund-submit"
          @click="submitRefund"
        >
          提交退款申请
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.orders-page .page-head-actions {
  flex-wrap: wrap;
}

.filter-select {
  width: 132px;
}

.order-detail-body {
  display: grid;
  gap: 18px;
}

.order-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.order-detail-id {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.order-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  background: var(--surface-muted, #f7f8f7);
}

.order-meta div {
  display: grid;
  gap: 2px;
}

.order-meta span {
  color: var(--text-muted, #6b7280);
  font-size: 12px;
}

.order-refund {
  justify-self: start;
}

.order-refund-reason {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid #f2d9b4;
  border-radius: 10px;
  background: var(--warning-soft);
}

.order-refund-reason span {
  color: var(--warning);
  font-size: 11px;
  font-weight: 600;
}

.order-refund-reason p {
  color: var(--text, #1f2937);
  font-size: 13px;
}

.refund-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--line, #e5e7eb);
  border-radius: 10px;
  background: var(--surface-2);
}

.refund-summary div {
  display: grid;
  gap: 2px;
}

.refund-summary span {
  color: var(--muted, #6b7280);
  font-size: 11px;
}

.refund-form {
  margin-top: 16px;
}

.full-width {
  width: 100%;
}

@media (max-width: 640px) {
  .filter-select {
    width: 100%;
  }
}
</style>
