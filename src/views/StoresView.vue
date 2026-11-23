<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index'
import { Search, Plus } from '@element-plus/icons-vue'
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
import { useAuthStore } from '@/stores/auth'
import { useDirectoryStore } from '@/stores/directory'
import {
  formatCurrency,
  formatNumber,
  statusLabel,
  statusTone,
} from '@/utils/format'

const auth = useAuthStore()
const directory = useDirectoryStore()

const search = ref('')
const regionFilter = ref('all')
const editVisible = ref(false)
const detailVisible = ref(false)
const saving = ref(false)
const detailLoading = ref(false)
const editing = ref(null)
const detail = ref(null)

const form = reactive({
  manager: '',
  phone: '',
  status: 'normal',
})

const createVisible = ref(false)
const createSaving = ref(false)
const createForm = reactive({
  name: '',
  city: '',
  region: '',
  manager: '',
  phone: '',
  openedAt: '',
})

function todayString() {
  const date = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function openCreate() {
  createForm.name = ''
  createForm.city = ''
  createForm.region =
    auth.user?.region && auth.user.region !== '全国'
      ? auth.user.region
      : '华东'
  createForm.manager = ''
  createForm.phone = ''
  createForm.openedAt = todayString()
  createVisible.value = true
}

async function createStore() {
  if (
    !createForm.name.trim() ||
    !createForm.city.trim() ||
    !createForm.region.trim() ||
    !createForm.manager.trim() ||
    !createForm.phone.trim()
  ) {
    ElMessage.warning('请填写完整的门店信息')
    return
  }
  createSaving.value = true
  try {
    const record = await directory.create({
      name: createForm.name.trim(),
      city: createForm.city.trim(),
      region: createForm.region.trim(),
      manager: createForm.manager.trim(),
      phone: createForm.phone.trim(),
      openedAt: createForm.openedAt,
    })
    ElMessage.success(`门店 ${record.name} 已创建`)
    createVisible.value = false
  } catch (error) {
    ElMessage.error(`创建失败：${error.message}`)
  } finally {
    createSaving.value = false
  }
}

const regions = computed(() => [
  ...new Set(directory.stores.map((store) => store.region)),
])

const filteredStores = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return directory.stores.filter((store) => {
    if (regionFilter.value !== 'all' && store.region !== regionFilter.value) {
      return false
    }
    if (!keyword) return true
    return (
      store.name.toLowerCase().includes(keyword) ||
      store.city.toLowerCase().includes(keyword) ||
      store.manager.toLowerCase().includes(keyword)
    )
  })
})

const {
  page,
  pageSize,
  paged: pagedStores,
} = usePagination(filteredStores, {
  resetOn: [search, regionFilter],
})

const summary = computed(() => ({
  total: filteredStores.value.length,
  regions: new Set(filteredStores.value.map((store) => store.region)).size,
  sales: filteredStores.value.reduce(
    (sum, store) => sum + Number(store.sales || 0),
    0,
  ),
  warning: filteredStores.value.filter(
    (store) => store.status !== 'normal',
  ).length,
  members: filteredStores.value.reduce(
    (sum, store) => sum + Number(store.members || 0),
    0,
  ),
}))

onMounted(async () => {
  try {
    await directory.refresh()
  } catch (error) {
    ElMessage.error(`门店数据加载失败：${error.message}`)
  }
})

function openEdit(row) {
  editing.value = row
  form.manager = row.manager
  form.phone = row.phone
  form.status = row.status
  editVisible.value = true
}

async function save() {
  if (!form.manager.trim() || !form.phone.trim()) {
    ElMessage.warning('请填写店长与门店电话')
    return
  }
  saving.value = true
  try {
    await directory.update(editing.value.id, {
      manager: form.manager.trim(),
      phone: form.phone.trim(),
      status: form.status,
    })
    ElMessage.success('门店信息已更新')
    editVisible.value = false
  } catch (error) {
    ElMessage.error(`保存失败：${error.message}`)
  } finally {
    saving.value = false
  }
}

async function openDetail(row) {
  detailLoading.value = true
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await directory.loadDetail(row.id)
  } catch (error) {
    ElMessage.error(`门店详情加载失败：${error.message}`)
  } finally {
    detailLoading.value = false
  }
}
</script>

<template>
  <div class="page stores-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">门店管理</h1>
        <p class="page-subtitle">门店档案、店长信息与实时经营概况</p>
      </div>

      <div class="page-head-actions">
        <el-button type="primary" :icon="Plus" @click="openCreate">
          新增门店
        </el-button>
        <el-select v-model="regionFilter" class="filter-select">
          <el-option label="全部区域" value="all" />
          <el-option
            v-for="region in regions"
            :key="region"
            :label="region"
            :value="region"
          />
        </el-select>
        <el-input
          v-model="search"
          class="search-input"
          placeholder="搜索门店、城市或店长"
          :prefix-icon="Search"
          clearable
        />
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat">
        <span>门店数</span>
        <strong class="tabular">{{ formatNumber(summary.total) }}</strong>
        <small>当前可见范围</small>
      </div>
      <div class="stat">
        <span>覆盖区域</span>
        <strong class="tabular">{{ formatNumber(summary.regions) }}</strong>
        <small>区域分布</small>
      </div>
      <div class="stat is-success">
        <span>销售额</span>
        <strong class="tabular">{{ formatCurrency(summary.sales) }}</strong>
        <small>订单净额</small>
      </div>
      <div class="stat is-warning">
        <span>预警门店</span>
        <strong class="tabular">{{ formatNumber(summary.warning) }}</strong>
        <small>需要关注</small>
      </div>
    </div>

    <section class="card" v-loading="directory.loading">
      <el-table :data="pagedStores" size="default" empty-text="暂无门店">
        <el-table-column label="门店" min-width="160">
          <template #default="{ row }">
            <div class="store-name">{{ row.name }}</div>
            <div class="store-meta">{{ row.city }} · 开业 {{ row.openedAt }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="region" label="区域" width="80" />
        <el-table-column prop="manager" label="店长" width="86" />
        <el-table-column prop="phone" label="电话" width="136" />
        <el-table-column label="销售额" align="right" width="110">
          <template #default="{ row }">
            <span class="tabular">{{ formatCurrency(row.sales) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="订单" align="right" width="72">
          <template #default="{ row }">
            <span class="tabular">{{ formatNumber(row.orders) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="会员" align="right" width="72">
          <template #default="{ row }">
            <span class="tabular">{{ formatNumber(row.members) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="低库存" align="right" width="82">
          <template #default="{ row }">
            <span
              class="tabular"
              :class="row.lowStock ? 'low-stock' : 'muted'"
            >
              {{ formatNumber(row.lowStock) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" effect="light" :type="statusTone(row.status)">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="118" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">
              详情
            </el-button>
            <el-button link type="primary" @click="openEdit(row)">
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <TablePagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="filteredStores.length"
      />
    </section>

    <el-dialog v-model="editVisible" title="编辑门店" width="460px">
      <el-form label-position="top">
        <el-form-item label="门店">
          <el-input :model-value="editing?.name" disabled />
        </el-form-item>
        <el-form-item label="店长">
          <el-input v-model="form.manager" placeholder="门店负责人" />
        </el-form-item>
        <el-form-item label="门店电话">
          <el-input v-model="form.phone" placeholder="例如：021-6200 1001" />
        </el-form-item>
        <el-form-item label="经营状态">
          <el-radio-group v-model="form.status">
            <el-radio-button label="normal">正常</el-radio-button>
            <el-radio-button label="warning">预警</el-radio-button>
            <el-radio-button label="danger">高风险</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="createVisible" title="新增门店" width="480px">
      <el-form label-position="top">
        <el-form-item label="门店名称">
          <el-input v-model="createForm.name" placeholder="例如：静安店" />
        </el-form-item>
        <el-form-item label="城市">
          <el-input v-model="createForm.city" placeholder="例如：上海" />
        </el-form-item>
        <el-form-item label="区域">
          <el-input v-model="createForm.region" placeholder="例如：华东" />
        </el-form-item>
        <el-form-item label="店长">
          <el-input v-model="createForm.manager" placeholder="门店负责人" />
        </el-form-item>
        <el-form-item label="门店电话">
          <el-input v-model="createForm.phone" placeholder="例如：021-6200 1001" />
        </el-form-item>
        <el-form-item label="开业时间">
          <el-input
            v-model="createForm.openedAt"
            placeholder="YYYY-MM-DD"
          />
        </el-form-item>
        <p class="dialog-note">
          新建门店会写入审计日志；库存、订单与会员可按新门店继续建档。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="createSaving"
          @click="createStore"
        >
          创建
        </el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="detailVisible"
      title="门店详情"
      size="480px"
      class="store-detail"
    >
      <div v-loading="detailLoading" class="store-detail-body">
        <template v-if="detail">
          <div class="store-detail-head">
            <div>
              <div class="store-detail-name">{{ detail.store.name }}</div>
              <div class="muted">
                {{ detail.store.city }} · {{ detail.store.region }} · 店长
                {{ detail.store.manager }}
              </div>
            </div>
            <el-tag effect="light" :type="statusTone(detail.store.status)">
              {{ statusLabel(detail.store.status) }}
            </el-tag>
          </div>

          <div class="store-detail-meta">
            <div>
              <span>销售额</span>
              <strong class="tabular">
                {{ formatCurrency(detail.store.sales) }}
              </strong>
            </div>
            <div>
              <span>订单数</span>
              <strong class="tabular">
                {{ formatNumber(detail.store.orders) }}
              </strong>
            </div>
            <div>
              <span>会员数</span>
              <strong class="tabular">
                {{ formatNumber(detail.store.members) }}
              </strong>
            </div>
            <div>
              <span>低库存 SKU</span>
              <strong class="tabular">
                {{ formatNumber(detail.store.lowStock) }}
              </strong>
            </div>
            <div>
              <span>电话</span>
              <strong>{{ detail.store.phone }}</strong>
            </div>
            <div>
              <span>开业时间</span>
              <strong>{{ detail.store.openedAt }}</strong>
            </div>
          </div>

          <div class="section-label">最近订单</div>
          <el-table :data="detail.orders" size="small" empty-text="暂无订单">
            <el-table-column prop="id" label="订单号" width="140" />
            <el-table-column prop="memberName" label="会员" width="84" />
            <el-table-column label="金额" align="right" width="90">
              <template #default="{ row }">
                <span class="tabular">{{ formatCurrency(row.amount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="88">
              <template #default="{ row }">
                <el-tag size="small" effect="light" :type="statusTone(row.status)">
                  {{ statusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="时间" width="132" />
          </el-table>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.stores-page .page-head-actions {
  flex-wrap: wrap;
}

.filter-select {
  width: 120px;
}

.store-name {
  font-weight: 600;
}

.store-meta {
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
}

.low-stock {
  color: var(--danger);
  font-weight: 600;
}

.full-width {
  width: 100%;
}

.dialog-note {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.store-detail-body {
  display: grid;
  gap: 18px;
}

.store-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.store-detail-name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.store-detail-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  background: var(--surface-2);
}

.store-detail-meta div {
  display: grid;
  gap: 2px;
}

.store-detail-meta span {
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 640px) {
  .filter-select {
    width: 100%;
  }
}
</style>
