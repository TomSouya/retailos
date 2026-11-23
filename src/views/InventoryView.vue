<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index'
import { Download, EditPen, Search } from '@element-plus/icons-vue'
import { downloadCsv } from '@/api/client'
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
import { useApprovalStore } from '@/stores/approval'
import { useAuthStore } from '@/stores/auth'
import { useInventoryStore } from '@/stores/inventory'
import {
  inventoryStatus,
  stores,
} from '@/mocks/data'
import {
  formatCurrency,
  formatNumber,
  statusLabel,
  statusTone,
} from '@/utils/format'

const auth = useAuthStore()
const approvalStore = useApprovalStore()
const inventoryStore = useInventoryStore()

const activeTab = ref('stock')
const search = ref('')
const selectedStore = ref(auth.user?.storeId || 'all')
const exporting = ref(false)

const isStoreManager = computed(() => auth.roleKey === 'store_manager')
const canApprove = computed(() => ['owner', 'regional_manager'].includes(auth.roleKey))
const canReplenish = computed(() => ['owner', 'store_manager'].includes(auth.roleKey))
const canAdjust = computed(() =>
  ['owner', 'regional_manager', 'warehouse'].includes(auth.roleKey),
)

const storeOptions = computed(() => {
  if (isStoreManager.value) {
    return stores.filter((store) => store.id === auth.user?.storeId)
  }
  return stores
})

const selectedStoreName = computed(() => {
  if (selectedStore.value === 'all') return '全部门店'
  return stores.find((store) => store.id === selectedStore.value)?.name || '全部门店'
})

function statusOf(item) {
  return item.status || inventoryStatus(item)
}

const filteredInventory = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return inventoryStore.items
    .filter((item) =>
      selectedStore.value === 'all' ? true : item.storeId === selectedStore.value,
    )
    .filter((item) => {
      if (!keyword) return true
      return (
        item.name.toLowerCase().includes(keyword) ||
        item.id.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword)
      )
    })
})

const summary = computed(() => {
  const total = filteredInventory.value.length
  const low = filteredInventory.value.filter((item) => statusOf(item) === 'low').length
  const out = filteredInventory.value.filter((item) => statusOf(item) === 'out').length
  return { total, low, out, accuracy: '98.2%' }
})

const filteredMovements = computed(() => {
  if (selectedStore.value === 'all') return inventoryStore.movements
  return inventoryStore.movements.filter(
    (item) => item.storeId === selectedStore.value,
  )
})

const approvalRows = computed(() => {
  if (canApprove.value) return approvalStore.pending
  if (approvalStore.remote) return approvalStore.approvals
  return approvalStore.approvals.filter(
    (item) => item.requester === auth.user?.name,
  )
})

const {
  page: stockPage,
  pageSize: stockPageSize,
  paged: pagedInventory,
} = usePagination(filteredInventory, {
  resetOn: [search, selectedStore],
})

const {
  page: approvalPage,
  pageSize: approvalPageSize,
  paged: pagedApprovals,
} = usePagination(approvalRows)

const {
  page: movementPage,
  pageSize: movementPageSize,
  paged: pagedMovements,
} = usePagination(filteredMovements, {
  resetOn: [selectedStore],
})

onMounted(async () => {
  if (inventoryStore.remote) {
    try {
      await inventoryStore.refresh()
    } catch (error) {
      ElMessage.error(`库存数据加载失败：${error.message}`)
    }
  }

  if (!approvalStore.remote) return
  try {
    await approvalStore.refresh()
  } catch (error) {
    ElMessage.error(`审批列表加载失败：${error.message}`)
  }
})

const replenishDialog = ref(false)
const selectedItem = ref(null)
const quantity = ref(12)
const note = ref('')

const adjustDialog = ref(false)
const adjustItem = ref(null)
const adjustDelta = ref(0)
const adjustReason = ref('')
const adjustSaving = ref(false)
const adjustAfter = computed(
  () =>
    Number(adjustItem.value?.stock || 0) + Number(adjustDelta.value || 0),
)

function openAdjust(row) {
  adjustItem.value = row
  adjustDelta.value = 0
  adjustReason.value = ''
  adjustDialog.value = true
}

async function submitAdjust() {
  if (!adjustItem.value) return
  const delta = Number(adjustDelta.value)
  if (!Number.isInteger(delta) || delta === 0) {
    ElMessage.warning('调整数量必须为非零整数')
    return
  }
  if (!adjustReason.value.trim()) {
    ElMessage.warning('请填写调整原因')
    return
  }
  if (adjustAfter.value < 0) {
    ElMessage.warning('调整后库存不能为负')
    return
  }

  adjustSaving.value = true
  try {
    const result = await inventoryStore.adjust(adjustItem.value.sku, {
      storeId: adjustItem.value.storeId,
      delta,
      reason: adjustReason.value.trim(),
    })
    ElMessage.success(
      `库存已从 ${result.movement.beforeStock} 调整为 ${result.movement.afterStock}`,
    )
    adjustDialog.value = false
  } catch (error) {
    ElMessage.error(`库存调整失败：${error.message}`)
  } finally {
    adjustSaving.value = false
  }
}

function storeName(storeId) {
  return stores.find((store) => store.id === storeId)?.name || '—'
}

function rowClassName({ row }) {
  const status = statusOf(row)
  if (status === 'out') return 'row-out'
  if (status === 'low') return 'row-low'
  return ''
}

function openReplenish(row) {
  selectedItem.value = row
  quantity.value = Math.max(row.safetyStock - row.stock, 12)
  note.value = ''
  replenishDialog.value = true
}

async function submitReplenish() {
  if (!selectedItem.value) return
  const item = selectedItem.value
  const store = stores.find((entry) => entry.id === item.storeId)

  try {
    await approvalStore.submit({
      type: 'replenishment',
      storeId: item.storeId,
      storeName: store?.name || '门店',
      risk: statusOf(item) === 'out' ? 'high' : 'medium',
      summary: `为${store?.name || '门店'}创建 ${item.name} 的补货申请`,
      items: [
        {
          sku: item.id,
          name: item.name,
          quantity: Number(quantity.value),
        },
      ],
      note: note.value,
    })

    if (approvalStore.remote) {
      await approvalStore.refresh()
    }

    replenishDialog.value = false
    activeTab.value = 'approvals'
    ElMessage.success('补货申请已提交，等待区域经理审批')
  } catch (error) {
    ElMessage.error(`补货申请提交失败：${error.message}`)
  }
}

async function refreshAfterDecision() {
  const tasks = []
  if (approvalStore.remote) tasks.push(approvalStore.refresh())
  if (inventoryStore.remote) tasks.push(inventoryStore.refresh())
  await Promise.allSettled(tasks)
}

async function approve(row) {
  try {
    const result = await approvalStore.decide(row.id, 'approved')
    if (result) {
      const purchaseOrderId = result.params?.purchaseOrderId
      ElMessage.success(
        row.type === 'refund'
          ? '退款审批已通过，退款已入账'
          : purchaseOrderId
            ? `已通过，并生成采购单草稿 ${purchaseOrderId}，请到「采购管理」补充价格后提交`
            : '已通过。请前往「采购管理」创建采购单并完成到货验收，库存才会更新',
      )
      await refreshAfterDecision()
    }
  } catch (error) {
    ElMessage.error(`审批失败：${error.message}`)
  }
}

async function reject(id) {
  try {
    const result = await approvalStore.decide(id, 'rejected')
    if (result) {
      ElMessage.info('已驳回，申请人会收到通知')
      await refreshAfterDecision()
    }
  } catch (error) {
    ElMessage.error(`驳回失败：${error.message}`)
  }
}

function exportData() {
  if (!inventoryStore.remote) {
    ElMessage.warning('演示模式暂不支持服务端导出')
    return
  }
  const params = new URLSearchParams()
  if (selectedStore.value !== 'all') {
    params.set('storeId', selectedStore.value)
  }
  if (search.value.trim()) {
    params.set('search', search.value.trim())
  }
  const suffix = params.toString() ? `?${params.toString()}` : ''
  exporting.value = true
  downloadCsv(`/api/exports/inventory${suffix}`, 'retailos-inventory.csv')
    .then((filename) => ElMessage.success(`已导出 ${filename}`))
    .catch((error) => ElMessage.error(`导出失败：${error.message}`))
    .finally(() => {
      exporting.value = false
    })
}
</script>

<template>
  <div class="page inventory-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">库存管理</h1>
        <p class="page-subtitle">
          {{ selectedStoreName }} · 实时库存、低库存预警与补货审批
        </p>
      </div>

      <div class="page-head-actions">
        <el-select
          v-model="selectedStore"
          size="default"
          class="store-select"
          :disabled="isStoreManager"
        >
          <el-option v-if="!isStoreManager" label="全部门店" value="all" />
          <el-option
            v-for="store in storeOptions"
            :key="store.id"
            :label="`${store.city} · ${store.name}`"
            :value="store.id"
          />
        </el-select>
        <el-input
          v-model="search"
          class="search-input"
          placeholder="搜索商品或 SKU"
          :prefix-icon="Search"
          clearable
        />
        <el-button
          :icon="Download"
          :loading="exporting"
          @click="exportData"
        >
          导出
        </el-button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat">
        <span>SKU 总数</span>
        <strong class="tabular">{{ formatNumber(summary.total) }}</strong>
        <small>当前筛选范围</small>
      </div>
      <div class="stat is-warning">
        <span>低库存</span>
        <strong class="tabular">{{ formatNumber(summary.low) }}</strong>
        <small>低于安全库存，审批通过后仍需入库</small>
      </div>
      <div class="stat is-danger">
        <span>已缺货</span>
        <strong class="tabular">{{ formatNumber(summary.out) }}</strong>
        <small>当前库存为 0，需优先补货</small>
      </div>
      <div class="stat is-success">
        <span>库存准确率</span>
        <strong class="tabular">{{ summary.accuracy }}</strong>
        <small>上次盘点结果</small>
      </div>
    </div>

    <section
      class="card inventory-card"
      v-loading="approvalStore.loading || inventoryStore.loading"
    >
      <el-tabs v-model="activeTab" class="inventory-tabs">
        <el-tab-pane label="库存明细" name="stock">
          <el-table
            :data="pagedInventory"
            :row-class-name="rowClassName"
            size="default"
          >
            <el-table-column prop="id" label="SKU" width="132" />
            <el-table-column label="门店" width="104">
              <template #default="{ row }">
                <span class="store-cell">
                  {{ row.storeName || storeName(row.storeId) || row.storeId }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="商品" min-width="180" />
            <el-table-column prop="category" label="分类" width="88" />
            <el-table-column label="单价" align="right" width="92">
              <template #default="{ row }">
                <span class="tabular">{{ formatCurrency(row.price, 1) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="当前库存" align="right" width="104">
              <template #default="{ row }">
                <span class="stock-value tabular" :class="`is-${statusOf(row)}`">
                  {{ formatNumber(row.stock) }} {{ row.unit }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="安全库存" align="right" width="100">
              <template #default="{ row }">
                <span class="tabular muted">{{ formatNumber(row.safetyStock) }} {{ row.unit }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="96">
              <template #default="{ row }">
                <el-tag size="small" effect="light" :type="statusTone(statusOf(row))">
                  {{ statusLabel(statusOf(row)) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" align="right">
              <template #default="{ row }">
                <el-button
                  v-if="canAdjust"
                  size="small"
                  text
                  type="warning"
                  :icon="EditPen"
                  @click="openAdjust(row)"
                >
                  调整
                </el-button>
                <el-button
                  v-if="canReplenish"
                  size="small"
                  text
                  type="primary"
                  @click="openReplenish(row)"
                >
                  发起补货
                </el-button>
                <span v-if="!canAdjust && !canReplenish" class="faint">—</span>
              </template>
            </el-table-column>
          </el-table>

          <TablePagination
            v-model:page="stockPage"
            v-model:page-size="stockPageSize"
            :total="filteredInventory.length"
          />
        </el-tab-pane>

        <el-tab-pane
          :label="canApprove ? `待审批 (${approvalRows.length})` : '我的申请'"
          name="approvals"
        >
          <el-table v-if="approvalRows.length" :data="pagedApprovals" size="default">
            <el-table-column prop="id" label="申请编号" width="176" />
            <el-table-column prop="storeName" label="门店" width="100" />
            <el-table-column prop="requester" label="申请人" width="88" />
            <el-table-column label="类型" width="82">
              <template #default="{ row }">
                <el-tag size="small" effect="light" :type="row.type === 'refund' ? 'warning' : 'info'">
                  {{ row.type === 'refund' ? '退款' : '补货' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="SKU" width="62" align="center">
              <template #default="{ row }">
                {{ row.type === 'refund' ? '—' : row.items?.length || 0 }}
              </template>
            </el-table-column>
            <el-table-column label="明细" min-width="220">
              <template #default="{ row }">
                <span class="approval-items-text">
                  {{
                    row.items?.length
                      ? row.items.map((item) => `${item.name} ×${item.quantity}`).join('、')
                      : row.summary || '—'
                  }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="风险" width="70">
              <template #default="{ row }">
                <span class="risk-text">{{ row.risk === 'high' ? '高' : row.risk === 'low' ? '低' : '中' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="92">
              <template #default="{ row }">
                <el-tag size="small" effect="light" :type="statusTone(row.status)">
                  {{ statusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="提交时间" width="146" />
            <el-table-column v-if="canApprove" label="操作" width="132" align="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" text @click="approve(row)">通过</el-button>
                <el-button size="small" type="danger" text @click="reject(row.id)">驳回</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty
            v-else
            :description="canApprove ? '当前没有待审批的申请' : '你还没有提交申请'"
            :image-size="72"
          />

          <TablePagination
            v-model:page="approvalPage"
            v-model:page-size="approvalPageSize"
            :total="approvalRows.length"
          />
        </el-tab-pane>

        <el-tab-pane label="库存流水" name="movements">
          <el-table
            v-if="filteredMovements.length"
            :data="pagedMovements"
            size="default"
          >
            <el-table-column prop="createdAt" label="时间" width="146" />
            <el-table-column prop="storeName" label="门店" width="90" />
            <el-table-column label="商品" min-width="180">
              <template #default="{ row }">
                <div>{{ row.name }}</div>
                <div class="movement-meta mono">{{ row.sku }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="typeLabel" label="类型" width="96" />
            <el-table-column label="数量" align="right" width="80">
              <template #default="{ row }">
                <span
                  class="tabular"
                  :class="row.quantity >= 0 ? 'movement-in' : 'movement-out'"
                >
                  {{ row.quantity > 0 ? '+' : '' }}{{ formatNumber(row.quantity) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="变动前" align="right" width="80">
              <template #default="{ row }">
                <span class="tabular muted">{{ formatNumber(row.beforeStock) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="变动后" align="right" width="80">
              <template #default="{ row }">
                <span class="tabular">{{ formatNumber(row.afterStock) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="operator" label="操作人" width="82" />
            <el-table-column prop="refId" label="关联单号" width="150" />
            <el-table-column prop="note" label="备注" min-width="160" />
          </el-table>
          <el-empty v-else description="暂无库存流水" :image-size="72" />

          <TablePagination
            v-model:page="movementPage"
            v-model:page-size="movementPageSize"
            :total="filteredMovements.length"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="replenishDialog"
      title="发起补货"
      width="420px"
      append-to-body
    >
      <div v-if="selectedItem" class="dialog-product">
        <div>
          <strong>{{ selectedItem.name }}</strong>
          <span class="mono">{{ selectedItem.id }} · {{ storeName(selectedItem.storeId) }}</span>
        </div>
        <div class="dialog-stock">
          <span>当前 {{ selectedItem.stock }} {{ selectedItem.unit }}</span>
          <span>安全 {{ selectedItem.safetyStock }} {{ selectedItem.unit }}</span>
        </div>
      </div>

      <el-form label-position="top" class="replenish-form">
        <el-form-item label="补货数量">
          <el-input-number v-model="quantity" :min="1" :max="999" />
        </el-form-item>
        <el-form-item label="备注（可选）">
          <el-input
            v-model="note"
            type="textarea"
            :rows="3"
            placeholder="例如：周末备货，优先安排冷链"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="replenishDialog = false">取消</el-button>
        <el-button type="primary" @click="submitReplenish">提交审批</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="adjustDialog"
      title="库存调整"
      width="440px"
      class="adjust-dialog"
      append-to-body
    >
      <div v-if="adjustItem" class="dialog-product">
        <div>
          <strong>{{ adjustItem.name }}</strong>
          <span class="mono">{{ adjustItem.sku }} · {{ storeName(adjustItem.storeId) }}</span>
        </div>
        <div class="dialog-stock">
          <span>当前 {{ adjustItem.stock }} {{ adjustItem.unit }}</span>
          <span>安全 {{ adjustItem.safetyStock }} {{ adjustItem.unit }}</span>
        </div>
      </div>

      <el-form label-position="top" class="adjust-form">
        <el-form-item label="调整数量（正数盘盈，负数盘亏）">
          <el-input-number
            v-model="adjustDelta"
            :min="-99999"
            :max="99999"
            :step="1"
          />
        </el-form-item>
        <el-form-item label="调整后库存">
          <strong :class="adjustAfter < 0 ? 'adjust-negative' : 'adjust-result'">
            {{ adjustAfter }} {{ adjustItem?.unit }}
          </strong>
        </el-form-item>
        <el-form-item label="调整原因">
          <el-input
            v-model="adjustReason"
            type="textarea"
            :rows="3"
            placeholder="例如：月度盘点差异、破损报废"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="adjustDialog = false">取消</el-button>
        <el-button
          type="warning"
          :loading="adjustSaving"
          @click="submitAdjust"
        >
          确认调整
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.inventory-page {
  animation: rise-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.adjust-form {
  margin-top: 14px;
}

.adjust-result {
  color: var(--ink);
  font-size: 18px;
  font-weight: 650;
}

.adjust-negative {
  color: var(--danger);
  font-size: 18px;
  font-weight: 650;
}

.store-select {
  width: 184px;
}

.search-input {
  width: 210px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 15px 17px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.stat span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}

.stat strong {
  color: var(--ink);
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.04em;
  line-height: 1.2;
}

.stat small {
  color: var(--faint);
  font-size: 9.5px;
}

.stat.is-warning strong {
  color: var(--warning);
}

.stat.is-danger strong {
  color: var(--danger);
}

.stat.is-success strong {
  color: var(--success);
}

.inventory-card {
  overflow: hidden;
}

.inventory-tabs {
  padding: 4px 18px 8px;
}

.store-cell {
  display: block;
  overflow: hidden;
  color: var(--text-soft);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stock-value.is-low {
  color: var(--warning);
  font-weight: 650;
}

.stock-value.is-out {
  color: var(--danger);
  font-weight: 650;
}

.approval-items-text {
  display: block;
  overflow: hidden;
  color: var(--text-soft);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-text {
  color: var(--accent-deep);
  font-size: 11.5px;
  font-weight: 650;
}

.movement-meta {
  margin-top: 2px;
  color: var(--faint);
  font-size: 10.5px;
}

.movement-in {
  color: var(--success);
  font-weight: 650;
}

.movement-out {
  color: var(--danger);
  font-weight: 650;
}

:deep(.row-low) {
  background: var(--warning-soft);
}

:deep(.row-out) {
  background: var(--danger-soft);
}

:deep(.inventory-card .el-tabs__header) {
  margin-bottom: 6px;
}

:deep(.inventory-card .el-table th.el-table__cell) {
  padding: 11px 0;
}

:deep(.inventory-card .el-table td.el-table__cell) {
  padding: 13px 0;
}

.dialog-product {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
}

.dialog-product div:first-child {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dialog-product strong {
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dialog-product span {
  color: var(--faint);
  font-size: 10px;
}

.dialog-stock {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex: none;
}

.replenish-form {
  margin-top: 16px;
}

@media (max-width: 900px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .store-select,
  .search-input {
    width: 100%;
  }
}

@media (max-width: 560px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
