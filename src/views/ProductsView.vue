<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index'
import { FolderOpened, Plus, Search } from '@element-plus/icons-vue'
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
import { useCatalogStore } from '@/stores/catalog'
import { useAuthStore } from '@/stores/auth'
import {
  formatCurrency,
  formatNumber,
  statusLabel,
  statusTone,
} from '@/utils/format'

const catalog = useCatalogStore()
const auth = useAuthStore()

const search = ref('')
const categoryFilter = ref('all')
const statusFilter = ref('all')
const dialogVisible = ref(false)
const editing = ref(null)
const saving = ref(false)

const form = reactive({
  id: '',
  name: '',
  category: '乳品',
  price: 0,
  costPrice: 0,
  unit: '件',
  safetyStock: 0,
  status: 'active',
})

const canEdit = computed(() =>
  ['owner', 'regional_manager'].includes(auth.roleKey),
)

const filteredProducts = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return catalog.products.filter((item) => {
    if (
      categoryFilter.value !== 'all' &&
      item.category !== categoryFilter.value
    ) {
      return false
    }
    if (statusFilter.value !== 'all' && item.status !== statusFilter.value) {
      return false
    }
    if (!keyword) return true
    return (
      item.name.toLowerCase().includes(keyword) ||
      item.id.toLowerCase().includes(keyword)
    )
  })
})

const summary = computed(() => {
  const total = catalog.products.length
  const active = catalog.products.filter(
    (item) => item.status === 'active',
  ).length
  const categories = new Set(
    catalog.products.map((item) => item.category),
  ).size
  const avgPrice = total
    ? catalog.products.reduce(
        (sum, item) => sum + Number(item.price || 0),
        0,
      ) / total
    : 0
  return { total, active, categories, avgPrice }
})

const {
  page,
  pageSize,
  paged: pagedProducts,
} = usePagination(filteredProducts, {
  resetOn: [search, categoryFilter, statusFilter],
})

onMounted(async () => {
  try {
    await catalog.refresh()
  } catch (error) {
    ElMessage.error(`商品数据加载失败：${error.message}`)
  }
})

function openCreate() {
  editing.value = null
  Object.assign(form, {
    id: '',
    name: '',
    category: catalog.categories[0]?.name || '乳品',
    price: 0,
    costPrice: 0,
    unit: '件',
    safetyStock: 0,
    status: 'active',
  })
  dialogVisible.value = true
}

function openEdit(row) {
  editing.value = row
  Object.assign(form, {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    costPrice: Number(row.costPrice || 0),
    unit: row.unit,
    safetyStock: Number(row.safetyStock),
    status: row.status,
  })
  dialogVisible.value = true
}

async function save() {
  if (!form.name.trim() || !form.category) {
    ElMessage.warning('请填写商品名称与分类')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await catalog.updateProduct(editing.value.id, {
        name: form.name.trim(),
        category: form.category,
        price: Number(form.price),
        costPrice: Number(form.costPrice),
        unit: form.unit,
        safetyStock: Number(form.safetyStock),
      })
      ElMessage.success('商品已更新')
    } else {
      await catalog.createProduct({
        id: form.id.trim() || undefined,
        name: form.name.trim(),
        category: form.category,
        price: Number(form.price),
        costPrice: Number(form.costPrice),
        unit: form.unit,
        safetyStock: Number(form.safetyStock),
        status: form.status,
      })
      ElMessage.success('商品已创建')
    }
    dialogVisible.value = false
  } catch (error) {
    ElMessage.error(`保存失败：${error.message}`)
  } finally {
    saving.value = false
  }
}

async function toggle(row) {
  const next = row.status === 'active' ? 'inactive' : 'active'
  try {
    await catalog.toggleProduct(row.id, next)
    ElMessage.success(next === 'active' ? '商品已上架' : '商品已下架')
  } catch (error) {
    ElMessage.error(`状态更新失败：${error.message}`)
  }
}

const categoryDialog = ref(false)
const categoryFormDialog = ref(false)
const categorySaving = ref(false)
const categoryEditingId = ref('')

const categoryForm = reactive({
  id: '',
  name: '',
  sort: 0,
})

function openCategoryForm(row = null) {
  categoryEditingId.value = row?.id || ''
  categoryForm.id = row?.id || ''
  categoryForm.name = row?.name || ''
  categoryForm.sort = Number(row?.sort) || catalog.categories.length + 1
  categoryFormDialog.value = true
}

async function saveCategory() {
  if (!categoryForm.name.trim()) {
    ElMessage.warning('请填写分类名称')
    return
  }

  categorySaving.value = true
  try {
    const payload = {
      name: categoryForm.name.trim(),
      sort: Number(categoryForm.sort) || 0,
    }
    if (categoryEditingId.value) {
      await catalog.updateCategory(categoryEditingId.value, payload)
      ElMessage.success('分类已更新，商品分类已同步')
    } else {
      await catalog.createCategory({
        ...payload,
        id: categoryForm.id.trim() || undefined,
      })
      ElMessage.success('分类已创建')
    }
    categoryFormDialog.value = false
  } catch (error) {
    ElMessage.error(`保存失败：${error.message}`)
  } finally {
    categorySaving.value = false
  }
}
</script>

<template>
  <div class="page products-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">商品管理</h1>
        <p class="page-subtitle">
          商品档案、分类、价格与上下架状态
        </p>
      </div>

      <div class="page-head-actions">
        <el-input
          v-model="search"
          class="search-input"
          placeholder="搜索商品名称或 SKU"
          :prefix-icon="Search"
          clearable
        />
        <el-select v-model="categoryFilter" class="filter-select">
          <el-option label="全部分类" value="all" />
          <el-option
            v-for="category in catalog.categories"
            :key="category.id"
            :label="category.name"
            :value="category.name"
          />
        </el-select>
        <el-select v-model="statusFilter" class="filter-select">
          <el-option label="全部状态" value="all" />
          <el-option label="在售" value="active" />
          <el-option label="已下架" value="inactive" />
        </el-select>
        <el-button
          v-if="canEdit"
          :icon="FolderOpened"
          class="category-manage"
          @click="categoryDialog = true"
        >
          分类管理
        </el-button>
        <el-button
          v-if="canEdit"
          type="primary"
          :icon="Plus"
          class="product-create"
          @click="openCreate"
        >
          新增商品
        </el-button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat">
        <span>SKU 总数</span>
        <strong class="tabular">{{ formatNumber(summary.total) }}</strong>
        <small>全部商品档案</small>
      </div>
      <div class="stat is-success">
        <span>在售商品</span>
        <strong class="tabular">{{ formatNumber(summary.active) }}</strong>
        <small>当前可售 SKU</small>
      </div>
      <div class="stat">
        <span>商品分类</span>
        <strong class="tabular">{{ formatNumber(summary.categories) }}</strong>
        <small>已启用分类</small>
      </div>
      <div class="stat">
        <span>平均单价</span>
        <strong class="tabular">{{ formatCurrency(summary.avgPrice, 1) }}</strong>
        <small>全部 SKU</small>
      </div>
    </div>

    <section class="card" v-loading="catalog.loading">
      <el-table :data="pagedProducts" size="default" empty-text="暂无商品">
        <el-table-column prop="id" label="SKU" width="132" />
        <el-table-column label="商品" min-width="200">
          <template #default="{ row }">
            <div class="product-name">{{ row.name }}</div>
            <div class="product-meta">{{ row.category }} · {{ row.unit }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="88" />
        <el-table-column label="单价" align="right" width="100">
          <template #default="{ row }">
            <span class="tabular">{{ formatCurrency(row.price, 1) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="成本价" align="right" width="100">
          <template #default="{ row }">
            <span class="tabular muted">
              {{ formatCurrency(row.costPrice, 1) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="安全库存" align="right" width="100">
          <template #default="{ row }">
            <span class="tabular muted">{{ formatNumber(row.safetyStock) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="96">
          <template #default="{ row }">
            <el-tag size="small" effect="light" :type="statusTone(row.status)">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="136">
          <template #default="{ row }">
            <span class="muted">{{ row.updatedAt || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="canEdit" label="操作" width="132" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button link type="warning" @click="toggle(row)">
              {{ row.status === 'active' ? '下架' : '上架' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <TablePagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="filteredProducts.length"
      />
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editing ? '编辑商品' : '新增商品'"
      width="560px"
      class="product-dialog"
    >
      <el-form label-position="top" class="product-form">
        <div class="form-grid">
          <el-form-item label="SKU">
            <el-input
              v-model="form.id"
              :disabled="Boolean(editing)"
              placeholder="留空自动生成"
            />
          </el-form-item>
          <el-form-item label="商品名称">
            <el-input v-model="form.name" placeholder="例如：有机鲜牛奶 950ml" />
          </el-form-item>
          <el-form-item label="分类">
            <el-select v-model="form.category" class="full-width">
              <el-option
                v-for="category in catalog.categories"
                :key="category.id"
                :label="category.name"
                :value="category.name"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="单位">
            <el-input v-model="form.unit" placeholder="箱 / 盒 / 瓶" />
          </el-form-item>
          <el-form-item label="单价（元）">
            <el-input-number
              v-model="form.price"
              :min="0"
              :precision="2"
              :step="1"
              class="full-width"
            />
          </el-form-item>
          <el-form-item label="成本价（元）">
            <el-input-number
              v-model="form.costPrice"
              :min="0"
              :precision="2"
              :step="1"
              class="full-width"
            />
          </el-form-item>
          <el-form-item label="安全库存">
            <el-input-number
              v-model="form.safetyStock"
              :min="0"
              :step="1"
              class="full-width"
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          class="product-save"
          @click="save"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="categoryDialog"
      title="商品分类管理"
      width="560px"
      class="category-dialog"
    >
      <div class="category-toolbar">
        <span class="muted">
          共 {{ catalog.categories.length }} 个分类，重命名会同步更新商品档案
        </span>
        <el-button
          type="primary"
          size="small"
          :icon="Plus"
          class="category-create"
          @click="openCategoryForm()"
        >
          新增分类
        </el-button>
      </div>

      <el-table :data="catalog.categories" size="small" empty-text="暂无分类">
        <el-table-column prop="id" label="编号" width="120" />
        <el-table-column prop="name" label="分类名称" min-width="140" />
        <el-table-column prop="sort" label="排序" width="72" align="right" />
        <el-table-column label="商品数" width="84" align="right">
          <template #default="{ row }">
            <span class="tabular muted">
              {{ catalog.products.filter((item) => item.category === row.name).length }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="72" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openCategoryForm(row)">
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog
        v-model="categoryFormDialog"
        :title="categoryEditingId ? '编辑分类' : '新增分类'"
        width="420px"
        append-to-body
        class="category-form-dialog"
      >
        <el-form label-position="top">
          <el-form-item label="分类编号">
            <el-input
              v-model="categoryForm.id"
              :disabled="Boolean(categoryEditingId)"
              placeholder="留空自动生成，如 CAT-07"
            />
          </el-form-item>
          <el-form-item label="分类名称">
            <el-input v-model="categoryForm.name" placeholder="例如：冷冻食品" />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number
              v-model="categoryForm.sort"
              :min="0"
              :step="1"
              class="full-width"
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="categoryFormDialog = false">取消</el-button>
          <el-button
            type="primary"
            :loading="categorySaving"
            class="category-save"
            @click="saveCategory"
          >
            保存
          </el-button>
        </template>
      </el-dialog>
    </el-dialog>
  </div>
</template>

<style scoped>
.products-page .page-head-actions {
  flex-wrap: wrap;
}

.filter-select {
  width: 132px;
}

.category-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.category-toolbar .muted {
  font-size: 12px;
}

.product-name {
  font-weight: 600;
}

.product-meta {
  margin-top: 2px;
  color: var(--text-muted, #6b7280);
  font-size: 12px;
}

.full-width {
  width: 100%;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

@media (max-width: 640px) {
  .filter-select {
    width: 100%;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
