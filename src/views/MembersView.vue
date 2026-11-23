<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index'
import { ElMessageBox } from 'element-plus/es/components/message-box/index'
import { Download, Refresh, Search, Plus } from '@element-plus/icons-vue'
import { downloadCsv } from '@/api/client'
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
import { useAuthStore } from '@/stores/auth'
import { useDirectoryStore } from '@/stores/directory'
import { useMembersStore } from '@/stores/members'
import { stores } from '@/mocks/data'
import {
  formatCurrency,
  formatNumber,
  statusLabel,
  statusTone,
} from '@/utils/format'

const auth = useAuthStore()
const directory = useDirectoryStore()
const membersStore = useMembersStore()

const search = ref('')
const levelFilter = ref('all')
const statusFilter = ref('all')
const segmentFilter = ref('all')
const inactiveDaysFilter = ref(0)
const exporting = ref(false)
const recalculating = ref(false)
const storeFilter = ref(
  auth.roleKey === 'store_manager' ? auth.user?.storeId || 'all' : 'all',
)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref(null)
const editVisible = ref(false)
const saving = ref(false)
const editing = ref(null)

const form = reactive({
  level: 'gold',
  status: 'normal',
  points: 0,
})

const createVisible = ref(false)
const createSaving = ref(false)
const createForm = reactive({
  name: '',
  phone: '',
  level: 'basic',
  storeId: '',
  points: 0,
})

const LEVEL_LABELS = {
  diamond: '钻石会员',
  gold: '黄金会员',
  silver: '白银会员',
  basic: '普通会员',
}

const LEVEL_TONES = {
  diamond: 'danger',
  gold: 'warning',
  silver: 'info',
  basic: 'info',
}

const SEGMENT_LABELS = {
  high_value: '高价值',
  repeat: '复购',
  active: '活跃',
  dormant: '沉睡',
  new: '新会员',
}

const SEGMENT_TONES = {
  high_value: 'danger',
  repeat: 'warning',
  active: 'success',
  dormant: 'info',
  new: 'primary',
}

const canEdit = computed(() => auth.can('members.write'))

const storeOptions = computed(() => {
  if (auth.roleKey === 'store_manager') {
    return stores.filter((store) => store.id === auth.user?.storeId)
  }
  if (directory.stores.length) return directory.stores
  if (auth.roleKey === 'owner') return stores
  return stores.filter((store) => store.region === auth.user?.region)
})

const summary = computed(
  () =>
    membersStore.summary || {
      total: 0,
      active: 0,
      dormant: 0,
      silent: 0,
      repeatMembers: 0,
      repeatRate: 0,
      avgSpent: 0,
      totalSpent: 0,
      newThisMonth: 0,
      points: 0,
    },
)

const memberRows = computed(() => membersStore.members)

const {
  page,
  pageSize,
  paged: pagedMembers,
} = usePagination(memberRows, {
  resetOn: [
    search,
    levelFilter,
    statusFilter,
    segmentFilter,
    inactiveDaysFilter,
    storeFilter,
  ],
})

async function refresh() {
  try {
    await membersStore.refresh({
      search: search.value,
      level: levelFilter.value,
      status: statusFilter.value,
      storeId: storeFilter.value,
      segment: segmentFilter.value,
      inactiveDays: inactiveDaysFilter.value || undefined,
    })
  } catch (error) {
    ElMessage.error(`会员数据加载失败：${error.message}`)
  }
}

async function recalculatePoints() {
  try {
    await ElMessageBox.confirm(
      '将按净消费额重新计算当前权限范围内所有会员的积分，确认继续？',
      '按消费重算积分',
      { type: 'warning', confirmButtonText: '开始重算' },
    )
  } catch {
    return
  }
  try {
    recalculating.value = true
    const result = await membersStore.recalculatePoints()
    ElMessage.success(
      `已重算 ${result.updated} 位会员，共 ${result.totalPoints} 分`,
    )
    await refresh()
  } catch (error) {
    ElMessage.error(`重算失败：${error.message}`)
  } finally {
    recalculating.value = false
  }
}

function exportMembers() {
  if (!membersStore.remote) {
    ElMessage.warning('演示模式暂不支持服务端导出')
    return
  }
  const params = new URLSearchParams()
  if (levelFilter.value !== 'all') params.set('level', levelFilter.value)
  if (segmentFilter.value !== 'all') {
    params.set('segment', segmentFilter.value)
  }
  if (statusFilter.value !== 'all') {
    params.set('status', statusFilter.value)
  } else if (segmentFilter.value === 'all') {
    params.set('status', 'dormant')
  }
  const days = inactiveDaysFilter.value || 45
  params.set('inactiveDays', String(days))
  if (storeFilter.value !== 'all') params.set('storeId', storeFilter.value)
  if (search.value.trim()) params.set('search', search.value.trim())

  exporting.value = true
  downloadCsv(
    `/api/exports/members?${params.toString()}`,
    `retailos-members-${days}d.csv`,
  )
    .then((filename) => ElMessage.success(`已导出 ${filename}`))
    .catch((error) => ElMessage.error(`导出失败：${error.message}`))
    .finally(() => {
      exporting.value = false
    })
}

onMounted(async () => {
  await refresh()
  if (['owner', 'regional_manager'].includes(auth.roleKey)) {
    try {
      await directory.refresh()
    } catch {
      // 门店目录仅用于筛选与建档，失败不影响会员列表
    }
  }
})

async function openDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await membersStore.loadDetail(row.id)
  } catch (error) {
    ElMessage.error(`会员详情加载失败：${error.message}`)
  } finally {
    detailLoading.value = false
  }
}

function openEdit(row) {
  editing.value = row
  form.level = row.level
  form.status = row.status
  form.points = Number(row.points)
  editVisible.value = true
}

async function save() {
  saving.value = true
  try {
    await membersStore.update(editing.value.id, {
      level: form.level,
      status: form.status,
      points: Number(form.points),
    })
    ElMessage.success('会员信息已更新')
    editVisible.value = false
    await refresh()
  } catch (error) {
    ElMessage.error(`保存失败：${error.message}`)
  } finally {
    saving.value = false
  }
}

function openCreate() {
  createForm.name = ''
  createForm.phone = ''
  createForm.level = 'basic'
  createForm.points = 0
  createForm.storeId =
    storeFilter.value !== 'all'
      ? storeFilter.value
      : storeOptions.value[0]?.id || ''
  createVisible.value = true
}

async function createMember() {
  if (!createForm.name.trim() || !createForm.phone.trim()) {
    ElMessage.warning('请填写姓名与手机号')
    return
  }
  if (!/^1\d{10}$/.test(createForm.phone.trim())) {
    ElMessage.warning('请输入 11 位手机号')
    return
  }
  if (!createForm.storeId) {
    ElMessage.warning('请选择所属门店')
    return
  }

  createSaving.value = true
  try {
    const record = await membersStore.create({
      name: createForm.name.trim(),
      phone: createForm.phone.trim(),
      level: createForm.level,
      storeId: createForm.storeId,
      points: Number(createForm.points),
    })
    ElMessage.success(`会员 ${record.name} 已建档`)
    createVisible.value = false
    await refresh()
  } catch (error) {
    ElMessage.error(`建档失败：${error.message}`)
  } finally {
    createSaving.value = false
  }
}
</script>

<template>
  <div class="page members-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">会员管理</h1>
        <p class="page-subtitle">会员档案、等级积分与消费记录</p>
      </div>

      <div class="page-head-actions">
        <el-button
          v-if="canEdit"
          type="primary"
          :icon="Plus"
          @click="openCreate"
        >
          新增会员
        </el-button>
        <el-button
          v-if="canEdit"
          :icon="Refresh"
          :loading="recalculating"
          @click="recalculatePoints"
        >
          重算积分
        </el-button>
        <el-button
          :icon="Download"
          :loading="exporting"
          class="member-export"
          @click="exportMembers"
        >
          导出唤醒名单
        </el-button>
        <el-select
          v-model="segmentFilter"
          class="filter-select"
          @change="refresh"
        >
          <el-option label="全部分层" value="all" />
          <el-option label="高价值" value="high_value" />
          <el-option label="复购" value="repeat" />
          <el-option label="活跃" value="active" />
          <el-option label="沉睡" value="dormant" />
          <el-option label="新会员" value="new" />
        </el-select>
        <el-select
          v-model="inactiveDaysFilter"
          class="filter-select"
          @change="refresh"
        >
          <el-option label="到店不限" :value="0" />
          <el-option label="30 天未到店" :value="30" />
          <el-option label="45 天未到店" :value="45" />
          <el-option label="60 天未到店" :value="60" />
          <el-option label="90 天未到店" :value="90" />
        </el-select>
        <el-select
          v-model="storeFilter"
          class="filter-select"
          :disabled="auth.roleKey === 'store_manager'"
          @change="refresh"
        >
          <el-option
            v-if="auth.roleKey !== 'store_manager'"
            label="全部门店"
            value="all"
          />
          <el-option
            v-for="store in storeOptions"
            :key="store.id"
            :label="store.name"
            :value="store.id"
          />
        </el-select>
        <el-select v-model="levelFilter" class="filter-select" @change="refresh">
          <el-option label="全部等级" value="all" />
          <el-option label="钻石会员" value="diamond" />
          <el-option label="黄金会员" value="gold" />
          <el-option label="白银会员" value="silver" />
          <el-option label="普通会员" value="basic" />
        </el-select>
        <el-select v-model="statusFilter" class="filter-select" @change="refresh">
          <el-option label="全部状态" value="all" />
          <el-option label="正常" value="normal" />
          <el-option label="沉睡" value="dormant" />
        </el-select>
        <el-input
          v-model="search"
          class="search-input"
          placeholder="搜索姓名、手机号或会员号"
          :prefix-icon="Search"
          clearable
          @change="refresh"
        />
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat">
        <span>会员总数</span>
        <strong class="tabular">{{ formatNumber(summary.total) }}</strong>
        <small>本月新增 {{ formatNumber(summary.newThisMonth) }}</small>
      </div>
      <div class="stat is-success">
        <span>复购率</span>
        <strong class="tabular">{{ summary.repeatRate }}%</strong>
        <small>复购会员 {{ formatNumber(summary.repeatMembers) }} 人</small>
      </div>
      <div class="stat is-warning">
        <span>沉睡预警</span>
        <strong class="tabular">{{ formatNumber(summary.silent) }}</strong>
        <small>标记沉睡 {{ formatNumber(summary.dormant) }} 人</small>
      </div>
      <div class="stat">
        <span>累计消费</span>
        <strong class="tabular">{{ formatCurrency(summary.totalSpent) }}</strong>
        <small>
          人均 {{ formatCurrency(summary.avgSpent) }} · 积分
          {{ formatNumber(summary.points) }}
        </small>
      </div>
    </div>

    <section class="card" v-loading="membersStore.loading">
      <el-table
        :data="pagedMembers"
        size="default"
        empty-text="暂无会员"
      >
        <el-table-column label="会员" min-width="142">
          <template #default="{ row }">
            <div class="member-name">{{ row.name }}</div>
            <div class="member-meta mono">{{ row.id }}</div>
          </template>
        </el-table-column>
        <el-table-column label="等级" width="104">
          <template #default="{ row }">
            <el-tag size="small" effect="light" :type="LEVEL_TONES[row.level]">
              {{ LEVEL_LABELS[row.level] || row.level }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="storeName" label="归属门店" width="92" />
        <el-table-column label="分层标签" min-width="146">
          <template #default="{ row }">
            <div class="segment-tags">
              <el-tag
                v-for="segment in row.segments || []"
                :key="segment"
                size="small"
                effect="light"
                :type="SEGMENT_TONES[segment] || 'info'"
              >
                {{ SEGMENT_LABELS[segment] || segment }}
              </el-tag>
              <span v-if="!row.segments?.length" class="muted">—</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="126" />
        <el-table-column label="积分" align="right" width="80">
          <template #default="{ row }">
            <span class="tabular">{{ formatNumber(row.points) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="订单" align="right" width="72">
          <template #default="{ row }">
            <span class="tabular">{{ formatNumber(row.orderCount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="累计消费" align="right" width="106">
          <template #default="{ row }">
            <span class="tabular">{{ formatCurrency(row.totalSpent) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最近到店" width="136">
          <template #default="{ row }">
            <span class="muted">{{ row.lastVisitAt || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="84">
          <template #default="{ row }">
            <el-tag size="small" effect="light" :type="statusTone(row.status)">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="112" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">
              详情
            </el-button>
            <el-button
              v-if="canEdit"
              link
              type="primary"
              @click="openEdit(row)"
            >
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <TablePagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="memberRows.length"
      />
    </section>

    <el-drawer
      v-model="detailVisible"
      title="会员详情"
      size="480px"
      class="member-detail"
    >
      <div v-loading="detailLoading" class="member-detail-body">
        <template v-if="detail">
          <div class="member-detail-head">
            <div>
              <div class="member-detail-name">{{ detail.member.name }}</div>
              <div class="muted mono">{{ detail.member.id }}</div>
            </div>
            <el-tag effect="light" :type="LEVEL_TONES[detail.member.level]">
              {{ LEVEL_LABELS[detail.member.level] }}
            </el-tag>
          </div>

          <div class="segment-tags detail-tags">
            <el-tag
              v-for="segment in detail.member.segments || []"
              :key="segment"
              size="small"
              effect="light"
              :type="SEGMENT_TONES[segment] || 'info'"
            >
              {{ SEGMENT_LABELS[segment] || segment }}
            </el-tag>
          </div>

          <div class="member-detail-meta">
            <div>
              <span>手机号</span>
              <strong>{{ detail.member.phone }}</strong>
            </div>
            <div>
              <span>归属门店</span>
              <strong>{{ detail.member.storeName }}</strong>
            </div>
            <div>
              <span>积分</span>
              <strong class="tabular">
                {{ formatNumber(detail.member.points) }}
              </strong>
            </div>
            <div>
              <span>累计消费</span>
              <strong class="tabular">
                {{ formatCurrency(detail.member.totalSpent) }}
              </strong>
            </div>
            <div>
              <span>订单数</span>
              <strong class="tabular">
                {{ formatNumber(detail.member.orderCount) }}
              </strong>
            </div>
            <div>
              <span>最近到店</span>
              <strong>{{ detail.member.lastVisitAt || '—' }}</strong>
            </div>
            <div>
              <span>沉睡天数</span>
              <strong class="tabular">
                {{ detail.member.inactiveDays ?? 0 }} 天
              </strong>
            </div>
            <div>
              <span>入会时间</span>
              <strong>{{ detail.member.joinedAt }}</strong>
            </div>
          </div>

          <div class="section-label">最近消费</div>
          <el-table :data="detail.orders" size="small" empty-text="暂无消费记录">
            <el-table-column prop="id" label="订单号" width="140" />
            <el-table-column prop="storeName" label="门店" width="76" />
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

    <el-dialog v-model="editVisible" title="编辑会员" width="460px">
      <el-form label-position="top">
        <el-form-item label="会员">
          <el-input :model-value="editing?.name" disabled />
        </el-form-item>
        <el-form-item label="会员等级">
          <el-select v-model="form.level" class="full-width">
            <el-option label="钻石会员" value="diamond" />
            <el-option label="黄金会员" value="gold" />
            <el-option label="白银会员" value="silver" />
            <el-option label="普通会员" value="basic" />
          </el-select>
        </el-form-item>
        <el-form-item label="会员状态">
          <el-radio-group v-model="form.status">
            <el-radio-button label="normal">正常</el-radio-button>
            <el-radio-button label="dormant">沉睡</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="积分">
          <el-input-number
            v-model="form.points"
            :min="0"
            :step="100"
            class="full-width"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="createVisible" title="新增会员" width="460px">
      <el-form label-position="top">
        <el-form-item label="姓名">
          <el-input v-model="createForm.name" placeholder="会员姓名" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input
            v-model="createForm.phone"
            placeholder="11 位手机号"
            maxlength="11"
          />
        </el-form-item>
        <el-form-item label="会员等级">
          <el-select v-model="createForm.level" class="full-width">
            <el-option label="普通会员" value="basic" />
            <el-option label="白银会员" value="silver" />
            <el-option label="黄金会员" value="gold" />
            <el-option label="钻石会员" value="diamond" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属门店">
          <el-select
            v-model="createForm.storeId"
            class="full-width"
            placeholder="选择门店"
          >
            <el-option
              v-for="store in storeOptions"
              :key="store.id"
              :label="`${store.city || ''} · ${store.name}`"
              :value="store.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="初始积分">
          <el-input-number
            v-model="createForm.points"
            :min="0"
            :step="100"
            class="full-width"
          />
        </el-form-item>
        <p class="dialog-note">
          手机号不可重复；建档后可在「会员详情」继续调整等级、状态与积分。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="createSaving"
          @click="createMember"
        >
          建档
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.members-page .page-head-actions {
  flex-wrap: wrap;
}

.dialog-note {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.filter-select {
  width: 124px;
}

.member-name {
  font-weight: 600;
}

.member-meta {
  margin-top: 2px;
  color: var(--faint);
  font-size: 10.5px;
}

.segment-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail-tags {
  margin-top: -6px;
}

.member-detail-body {
  display: grid;
  gap: 18px;
}

.member-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.member-detail-name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.member-detail-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  background: var(--surface-2);
}

.member-detail-meta div {
  display: grid;
  gap: 2px;
}

.member-detail-meta span {
  color: var(--muted);
  font-size: 12px;
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
