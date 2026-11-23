<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index'
import { ElMessageBox } from 'element-plus/es/components/message-box/index'
import { OfficeBuilding, Plus, Search } from '@element-plus/icons-vue'
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
import { useProcurementStore } from '@/stores/procurement'
import { useCatalogStore } from '@/stores/catalog'
import { useAuthStore } from '@/stores/auth'
import { stores } from '@/mocks/data'
import {
  formatCurrency,
  formatNumber,
  statusLabel,
  statusTone,
} from '@/utils/format'

const procurement = useProcurementStore()
const catalog = useCatalogStore()
const auth = useAuthStore()

const search = ref('')
const statusFilter = ref('all')
const dialogVisible = ref(false)
const editingId = ref('')
const editingSource = ref('')
const saving = ref(false)

const isEditing = computed(() => Boolean(editingId.value))
const dialogTitle = computed(() =>
  isEditing.value ? '编辑采购单草稿' : '新建采购单',
)

const form = reactive({
  supplierId: '',
  storeId: '',
  note: '',
  items: [],
})

const itemDraft = reactive({
  sku: '',
  quantity: 12,
  unitPrice: 0,
})

const canCreate = computed(() =>
  ['owner', 'regional_manager', 'warehouse'].includes(auth.roleKey),
)
const canApprove = computed(() =>
  ['owner', 'regional_manager'].includes(auth.roleKey),
)
const canReceive = computed(() =>
  ['owner', 'warehouse'].includes(auth.roleKey),
)
const canManageSuppliers = computed(() =>
  ['owner', 'regional_manager'].includes(auth.roleKey),
)

const storeOptions = computed(() => {
  if (auth.roleKey === 'owner') return stores
  return stores.filter((store) => store.region === auth.user?.region)
})

const filteredOrders = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return procurement.orders.filter((item) => {
    if (statusFilter.value !== 'all' && item.status !== statusFilter.value) {
      return false
    }
    if (!keyword) return true
    return (
      item.id.toLowerCase().includes(keyword) ||
      item.supplierName.toLowerCase().includes(keyword) ||
      item.storeName.toLowerCase().includes(keyword)
    )
  })
})

const {
  page,
  pageSize,
  paged: pagedOrders,
} = usePagination(filteredOrders, {
  resetOn: [search, statusFilter],
})

const draftTotal = computed(() =>
  form.items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0,
  ),
)

onMounted(async () => {
  try {
    await Promise.all([procurement.refresh(), catalog.refresh()])
  } catch (error) {
    ElMessage.error(`采购数据加载失败：${error.message}`)
  }
})

function openCreate() {
  editingId.value = ''
  editingSource.value = ''
  form.supplierId = catalog.suppliers[0]?.id || ''
  form.storeId = storeOptions.value[0]?.id || ''
  form.note = ''
  form.items = []
  itemDraft.sku = ''
  itemDraft.quantity = 12
  itemDraft.unitPrice = 0
  dialogVisible.value = true
}

function openEdit(row) {
  if (!row || row.status !== 'draft') return
  editingId.value = row.id
  editingSource.value = row.sourceApprovalId || ''
  form.supplierId = row.supplierId || ''
  form.storeId = row.storeId || ''
  form.note = row.note || ''
  form.items = (row.items || []).map((item) => ({
    sku: item.sku,
    name: item.name,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
  }))
  dialogVisible.value = true
}

function onProductChange(sku) {
  const product = catalog.products.find((item) => item.id === sku)
  if (product) itemDraft.unitPrice = Number(product.price)
}

function addItem() {
  const product = catalog.products.find(
    (item) => item.id === itemDraft.sku,
  )
  if (!product) {
    ElMessage.warning('请选择商品')
    return
  }
  const quantity = Number(itemDraft.quantity)
  if (!quantity || quantity <= 0) {
    ElMessage.warning('请输入有效的采购数量')
    return
  }
  const exists = form.items.find((item) => item.sku === product.id)
  if (exists) {
    exists.quantity += quantity
    return
  }
  form.items.push({
    sku: product.id,
    name: product.name,
    quantity,
    unitPrice: Number(itemDraft.unitPrice || product.price),
  })
  itemDraft.sku = ''
  itemDraft.quantity = 12
  itemDraft.unitPrice = 0
}

function removeItem(index) {
  form.items.splice(index, 1)
}

async function save() {
  if (!form.supplierId || !form.storeId) {
    ElMessage.warning('请选择供应商与门店')
    return
  }
  if (!form.items.length) {
    ElMessage.warning('请至少添加一条采购明细')
    return
  }
  if (
    form.items.some(
      (item) =>
        !Number.isFinite(Number(item.unitPrice)) ||
        Number(item.unitPrice) < 0,
    )
  ) {
    ElMessage.warning('采购单价不合法')
    return
  }
  saving.value = true
  try {
    const supplier = catalog.suppliers.find(
      (item) => item.id === form.supplierId,
    )

    if (isEditing.value) {
      await procurement.updateDraft(editingId.value, {
        supplierId: form.supplierId,
        supplierName: supplier?.name || '',
        note: form.note,
        items: form.items.map((item) => ({
          sku: item.sku,
          unitPrice: Number(item.unitPrice),
        })),
      })
      dialogVisible.value = false
      editingId.value = ''
      ElMessage.success('采购单草稿已更新')
      return
    }

    const store = stores.find((item) => item.id === form.storeId)
    await procurement.create({
      supplierId: form.supplierId,
      supplierName: supplier?.name || '供应商',
      storeId: form.storeId,
      storeName: store?.name || '门店',
      createdBy: auth.user?.name,
      note: form.note,
      items: form.items,
    })
    dialogVisible.value = false
    ElMessage.success('采购单已创建，状态为草稿')
  } catch (error) {
    ElMessage.error(`保存失败：${error.message}`)
  } finally {
    saving.value = false
  }
}

async function action(row, nextAction) {
  const labels = {
    submit: '提交采购单',
    approve: '审批通过采购单',
    receive: '确认到货验收',
  }
  try {
    await ElMessageBox.confirm(
      `确认${labels[nextAction]} ${row.id}？`,
      '操作确认',
      { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  try {
    await procurement.transition(row.id, nextAction)
    ElMessage.success(`${labels[nextAction]}成功`)
  } catch (error) {
    ElMessage.error(`操作失败：${error.message}`)
  }
}

const supplierDialog = ref(false)
const supplierFormDialog = ref(false)
const supplierSaving = ref(false)
const supplierEditingId = ref('')

const supplierForm = reactive({
  id: '',
  name: '',
  contact: '',
  phone: '',
  status: 'active',
})

function openSupplierForm(row = null) {
  supplierEditingId.value = row?.id || ''
  supplierForm.id = row?.id || ''
  supplierForm.name = row?.name || ''
  supplierForm.contact = row?.contact || ''
  supplierForm.phone = row?.phone || ''
  supplierForm.status = row?.status || 'active'
  supplierFormDialog.value = true
}

async function saveSupplier() {
  if (
    !supplierForm.name.trim() ||
    !supplierForm.contact.trim() ||
    !supplierForm.phone.trim()
  ) {
    ElMessage.warning('请填写供应商名称、联系人和电话')
    return
  }

  supplierSaving.value = true
  try {
    const payload = {
      name: supplierForm.name.trim(),
      contact: supplierForm.contact.trim(),
      phone: supplierForm.phone.trim(),
      status: supplierForm.status,
    }
    if (supplierEditingId.value) {
      await catalog.updateSupplier(supplierEditingId.value, payload)
      ElMessage.success('供应商已更新')
    } else {
      await catalog.createSupplier({
        ...payload,
        id: supplierForm.id.trim() || undefined,
      })
      ElMessage.success('供应商已创建')
    }
    supplierFormDialog.value = false
  } catch (error) {
    ElMessage.error(`保存失败：${error.message}`)
  } finally {
    supplierSaving.value = false
  }
}
</script>

<template>
  <div class="page procurement-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">采购管理</h1>
        <p class="page-subtitle">
          供应商采购单、审批流与到货验收
        </p>
      </div>

      <div class="page-head-actions">
        <el-input
          v-model="search"
          class="search-input"
          placeholder="搜索采购单号、供应商或门店"
          :prefix-icon="Search"
          clearable
        />
        <el-select v-model="statusFilter" class="filter-select">
          <el-option label="全部状态" value="all" />
          <el-option label="草稿" value="draft" />
          <el-option label="待审批" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已入库" value="received" />
        </el-select>
        <el-button
          v-if="canManageSuppliers"
          :icon="OfficeBuilding"
          class="supplier-manage"
          @click="supplierDialog = true"
        >
          供应商
        </el-button>
        <el-button
          v-if="canCreate"
          type="primary"
          :icon="Plus"
          class="po-create"
          @click="openCreate"
        >
          新建采购单
        </el-button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat">
        <span>采购单总数</span>
        <strong class="tabular">{{ formatNumber(procurement.summary.total) }}</strong>
        <small>当前可见范围</small>
      </div>
      <div class="stat is-warning">
        <span>待审批</span>
        <strong class="tabular">{{ formatNumber(procurement.summary.pending) }}</strong>
        <small>等待区域经理</small>
      </div>
      <div class="stat">
        <span>已通过</span>
        <strong class="tabular">{{ formatNumber(procurement.summary.approved) }}</strong>
        <small>等待仓库验收</small>
      </div>
      <div class="stat is-success">
        <span>已入库</span>
        <strong class="tabular">{{ formatNumber(procurement.summary.received) }}</strong>
        <small>已完成采购</small>
      </div>
    </div>

    <section class="card" v-loading="procurement.loading">
      <el-table :data="pagedOrders" size="default" empty-text="暂无采购单">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="po-items">
              <div class="po-source">
                <span>来源：</span>
                <span v-if="row.sourceApprovalId" class="mono">
                  补货申请 {{ row.sourceApprovalId }}
                </span>
                <span v-else>手工创建</span>
                <span v-if="row.note" class="po-note">{{ row.note }}</span>
              </div>
              <el-table :data="row.items" size="small">
                <el-table-column prop="sku" label="SKU" width="132" />
                <el-table-column prop="name" label="商品" min-width="180" />
                <el-table-column label="数量" align="right" width="80">
                  <template #default="{ row: item }">
                    <span class="tabular">{{ formatNumber(item.quantity) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="单价" align="right" width="92">
                  <template #default="{ row: item }">
                    <span class="tabular">{{ formatCurrency(item.unitPrice, 1) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="小计" align="right" width="104">
                  <template #default="{ row: item }">
                    <span class="tabular">{{ formatCurrency(item.amount) }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="id" label="采购单号" width="150" />
        <el-table-column prop="supplierName" label="供应商" min-width="120" />
        <el-table-column prop="storeName" label="门店" width="96" />
        <el-table-column label="明细" align="right" width="72">
          <template #default="{ row }">
            <span class="tabular">{{ formatNumber(row.itemCount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="金额" align="right" width="104">
          <template #default="{ row }">
            <span class="tabular">{{ formatCurrency(row.totalAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="92">
          <template #default="{ row }">
            <el-tag size="small" effect="light" :type="statusTone(row.status)">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdBy" label="创建人" width="84" />
        <el-table-column prop="createdAt" label="创建时间" width="140" />
        <el-table-column label="操作" width="132" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'draft'">
              <el-button
                v-if="canCreate"
                link
                type="primary"
                @click="openEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                v-if="canCreate"
                link
                type="primary"
                @click="action(row, 'submit')"
              >
                提交
              </el-button>
              <span v-if="!canCreate" class="muted">—</span>
            </template>
            <el-button
              v-else-if="row.status === 'pending' && canApprove"
              link
              type="primary"
              @click="action(row, 'approve')"
            >
              审批
            </el-button>
            <el-button
              v-else-if="row.status === 'approved' && canReceive"
              link
              type="primary"
              @click="action(row, 'receive')"
            >
              验收
            </el-button>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>

      <TablePagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="filteredOrders.length"
      />
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="640px"
      class="po-dialog"
    >
      <div v-if="isEditing" class="po-edit-hint">
        <span v-if="editingSource" class="mono">
          来源：补货申请 {{ editingSource }}
        </span>
        <span v-else>来源：手工创建</span>
        <span>数量沿用申请，可调整供应商与单价。</span>
      </div>

      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="供应商">
            <el-select v-model="form.supplierId" class="full-width">
              <el-option
                v-for="supplier in catalog.suppliers"
                :key="supplier.id"
                :label="`${supplier.name} · ${supplier.contact}`"
                :value="supplier.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="收货门店">
            <el-select
              v-model="form.storeId"
              class="full-width"
              :disabled="isEditing"
            >
              <el-option
                v-for="store in storeOptions"
                :key="store.id"
                :label="`${store.city} · ${store.name}`"
                :value="store.id"
              />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="备注">
          <el-input v-model="form.note" placeholder="例如：周末乳品补货" />
        </el-form-item>

        <div class="po-item-editor">
          <div class="po-item-editor-head">采购明细</div>
          <div v-if="!isEditing" class="po-item-editor-row">
            <el-select
              v-model="itemDraft.sku"
              placeholder="选择商品"
              class="item-product"
              @change="onProductChange"
            >
              <el-option
                v-for="product in catalog.products"
                :key="product.id"
                :label="`${product.name} · ${product.id}`"
                :value="product.id"
              />
            </el-select>
            <el-input-number
              v-model="itemDraft.quantity"
              :min="1"
              :step="1"
              class="item-number"
            />
            <el-input-number
              v-model="itemDraft.unitPrice"
              :min="0"
              :precision="2"
              :step="1"
              class="item-number"
            />
            <el-button @click="addItem">添加</el-button>
          </div>

          <div v-if="form.items.length" class="po-draft-items">
            <div
              v-for="(item, index) in form.items"
              :key="item.sku"
              class="po-draft-item"
              :class="{ 'is-editing': isEditing }"
            >
              <span class="po-draft-name">{{ item.name }}</span>
              <template v-if="isEditing">
                <span class="muted tabular">{{ item.quantity }} 件</span>
                <el-input-number
                  v-model="item.unitPrice"
                  :min="0"
                  :precision="2"
                  :step="1"
                  size="small"
                  class="po-edit-price"
                />
              </template>
              <span v-else class="muted tabular">
                {{ item.quantity }} × {{ formatCurrency(item.unitPrice, 1) }}
              </span>
              <span class="tabular">
                {{ formatCurrency(item.quantity * item.unitPrice) }}
              </span>
              <el-button
                v-if="!isEditing"
                link
                type="danger"
                @click="removeItem(index)"
              >
                移除
              </el-button>
            </div>
          </div>
          <div v-else class="po-empty muted">还没有采购明细</div>

          <div class="po-total">
            合计
            <strong class="tabular">{{ formatCurrency(draftTotal) }}</strong>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          class="po-save"
          @click="save"
        >
          {{ isEditing ? '保存修改' : '保存草稿' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="supplierDialog"
      title="供应商管理"
      width="720px"
      class="supplier-dialog"
    >
      <div class="supplier-toolbar">
        <span class="section-hint">
          共 {{ catalog.suppliers.length }} 家供应商
        </span>
        <el-button
          type="primary"
          size="small"
          :icon="Plus"
          class="supplier-create"
          @click="openSupplierForm()"
        >
          新增供应商
        </el-button>
      </div>

      <el-table :data="catalog.suppliers" size="small" empty-text="暂无供应商">
        <el-table-column prop="id" label="编号" width="112" />
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="contact" label="联系人" width="96" />
        <el-table-column prop="phone" label="电话" width="132" />
        <el-table-column label="状态" width="88">
          <template #default="{ row }">
            <el-tag
              size="small"
              effect="light"
              :type="row.status === 'active' ? 'success' : 'info'"
            >
              {{ row.status === 'active' ? '合作中' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="72" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openSupplierForm(row)">
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog
        v-model="supplierFormDialog"
        :title="supplierEditingId ? '编辑供应商' : '新增供应商'"
        width="440px"
        append-to-body
        class="supplier-form-dialog"
      >
        <el-form label-position="top">
          <el-form-item label="供应商编号">
            <el-input
              v-model="supplierForm.id"
              :disabled="Boolean(supplierEditingId)"
              placeholder="留空自动生成，如 SUP-004"
            />
          </el-form-item>
          <el-form-item label="供应商名称">
            <el-input v-model="supplierForm.name" placeholder="例如：华东鲜配" />
          </el-form-item>
          <el-form-item label="联系人">
            <el-input v-model="supplierForm.contact" placeholder="例如：王磊" />
          </el-form-item>
          <el-form-item label="联系电话">
            <el-input v-model="supplierForm.phone" placeholder="例如：13800001111" />
          </el-form-item>
          <el-form-item label="合作状态">
            <el-radio-group v-model="supplierForm.status">
              <el-radio-button label="active">合作中</el-radio-button>
              <el-radio-button label="inactive">已停用</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="supplierFormDialog = false">取消</el-button>
          <el-button
            type="primary"
            :loading="supplierSaving"
            class="supplier-save"
            @click="saveSupplier"
          >
            保存
          </el-button>
        </template>
      </el-dialog>
    </el-dialog>
  </div>
</template>

<style scoped>
.procurement-page .page-head-actions {
  flex-wrap: wrap;
}

.filter-select {
  width: 132px;
}

.supplier-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.po-items {
  padding: 8px 16px 12px 44px;
  background: var(--surface-muted, #f7f8f7);
}

.po-source {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
  color: var(--text-soft);
  font-size: 11.5px;
}

.po-note {
  overflow: hidden;
  color: var(--faint);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.full-width {
  width: 100%;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.po-item-editor {
  padding: 14px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  background: var(--surface-muted, #f7f8f7);
}

.po-item-editor-head {
  margin-bottom: 10px;
  font-weight: 600;
}

.po-item-editor-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 104px auto;
  gap: 8px;
}

.item-product {
  width: 100%;
}

.item-number {
  width: 100%;
}

.po-draft-items {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}

.po-edit-hint {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-bottom: 14px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-deep);
  font-size: 12px;
}

.po-draft-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 130px 90px auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface, #fff);
}

.po-draft-item.is-editing {
  grid-template-columns: minmax(0, 1fr) 64px 132px 90px;
}

.po-edit-price {
  width: 100%;
}

.po-draft-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.po-empty {
  margin-top: 12px;
  font-size: 13px;
}

.po-total {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 10px;
  margin-top: 12px;
  font-size: 13px;
}

.po-total strong {
  font-size: 18px;
}

@media (max-width: 640px) {
  .filter-select {
    width: 100%;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .po-item-editor-row {
    grid-template-columns: 1fr 1fr;
  }

  .po-draft-item {
    grid-template-columns: 1fr 1fr;
  }

  .po-draft-item.is-editing {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }

  .po-draft-item.is-editing .po-draft-name {
    flex: 1 1 100%;
  }

  .po-draft-item.is-editing .po-edit-price {
    flex: 1 1 140px;
  }
}
</style>
