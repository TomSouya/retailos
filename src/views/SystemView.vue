<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'
import { ElMessageBox } from 'element-plus/es/components/message-box/index'
import {
  CircleCheckFilled,
  Minus,
  Plus,
  Refresh,
  UserFilled,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useDirectoryStore } from '@/stores/directory'
import { useSystemStore } from '@/stores/system'

const router = useRouter()
const auth = useAuthStore()
const directory = useDirectoryStore()
const system = useSystemStore()

const editVisible = ref(false)
const saving = ref(false)
const editing = ref(null)
const form = reactive({ roleKey: '', storeId: '' })

const createVisible = ref(false)
const createSaving = ref(false)
const createForm = reactive({
  username: '',
  name: '',
  password: '',
  roleKey: 'regional_manager',
  region: '华东',
  storeId: '',
})

const roleTone = {
  owner: 'danger',
  regional_manager: 'warning',
  store_manager: 'primary',
  warehouse: 'info',
}

const summary = computed(() => ({
  total: system.users.length,
  active: system.users.filter((user) => user.status === 'active').length,
  disabled: system.users.filter((user) => user.status === 'disabled').length,
  roles: system.roles.length,
}))

const matrixRows = computed(() =>
  system.matrix.flatMap((module) =>
    module.actions.map((action) => ({
      key: `${module.key}-${action.key}`,
      moduleKey: module.key,
      module: module.label,
      action: action.label,
      permission: `${module.key}.${action.key}`,
    })),
  ),
)

const selectedRoleKey = ref('')
const draftPermissions = ref([])
const roleSaving = ref(false)
const roleVisible = ref(false)
const roleFormSaving = ref(false)
const roleForm = reactive({
  key: '',
  name: '',
  scopeType: 'region',
  description: '',
  permissions: [],
})

const selectedRole = computed(
  () =>
    system.roles.find((role) => role.key === selectedRoleKey.value) || null,
)
const roleEditable = computed(
  () => Boolean(selectedRole.value) && selectedRole.value.key !== 'owner',
)

function selectRole(key) {
  selectedRoleKey.value = key
  const role = system.roles.find((item) => item.key === key)
  draftPermissions.value = role ? [...role.permissions] : []
}

function hasDraftPermission(permission) {
  return draftPermissions.value.includes(permission)
}

function toggleDraftPermission(permission, checked) {
  if (checked && !draftPermissions.value.includes(permission)) {
    draftPermissions.value = [...draftPermissions.value, permission]
  } else if (!checked) {
    draftPermissions.value = draftPermissions.value.filter(
      (item) => item !== permission,
    )
  }
}

async function saveRolePermissions() {
  if (!roleEditable.value) return
  roleSaving.value = true
  try {
    await system.updateRole(selectedRole.value.key, {
      permissions: draftPermissions.value,
    })
    selectRole(selectedRole.value.key)
    ElMessage.success(`「${selectedRole.value.name}」权限已保存`)
  } catch (error) {
    ElMessage.error(`保存失败：${error.message}`)
  } finally {
    roleSaving.value = false
  }
}

async function resetRolePermissions() {
  if (!roleEditable.value) return
  roleSaving.value = true
  try {
    await system.updateRole(selectedRole.value.key, {
      resetDefaults: true,
    })
    selectRole(selectedRole.value.key)
    ElMessage.success('已恢复默认权限')
  } catch (error) {
    ElMessage.error(`恢复失败：${error.message}`)
  } finally {
    roleSaving.value = false
  }
}

function openRoleCreate() {
  roleForm.key = ''
  roleForm.name = ''
  roleForm.scopeType = 'region'
  roleForm.description = ''
  roleForm.permissions = []
  roleVisible.value = true
}

function toggleRoleFormPermission(permission, checked) {
  if (checked && !roleForm.permissions.includes(permission)) {
    roleForm.permissions = [...roleForm.permissions, permission]
  } else if (!checked) {
    roleForm.permissions = roleForm.permissions.filter(
      (item) => item !== permission,
    )
  }
}

async function createRole() {
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(roleForm.key.trim())) {
    ElMessage.warning('角色编号需为 2-32 位小写字母、数字或下划线')
    return
  }
  if (!roleForm.name.trim()) {
    ElMessage.warning('请填写角色名称')
    return
  }
  if (!roleForm.permissions.length) {
    ElMessage.warning('请至少选择一项权限')
    return
  }
  roleFormSaving.value = true
  try {
    const record = await system.createRole({
      key: roleForm.key.trim(),
      name: roleForm.name.trim(),
      scopeType: roleForm.scopeType,
      description: roleForm.description.trim(),
      permissions: roleForm.permissions,
    })
    roleVisible.value = false
    ElMessage.success(`角色「${roleForm.name.trim()}」已创建`)
    if (record?.key) selectRole(record.key)
  } catch (error) {
    ElMessage.error(`创建失败：${error.message}`)
  } finally {
    roleFormSaving.value = false
  }
}

async function removeRole(role) {
  try {
    await ElMessageBox.confirm(
      `删除角色「${role.name}」后不可恢复，确认删除？`,
      '删除角色',
      { type: 'warning', confirmButtonText: '删除' },
    )
  } catch {
    return
  }
  try {
    await system.deleteRole(role.key)
    ElMessage.success('角色已删除')
    if (selectedRoleKey.value === role.key) {
      selectRole(system.roles[0]?.key || '')
    }
  } catch (error) {
    ElMessage.error(`删除失败：${error.message}`)
  }
}

function scopeTypeOfRole(roleKey) {
  return (
    system.roles.find((role) => role.key === roleKey)?.scopeType || 'region'
  )
}

const createNeedsStore = computed(
  () => scopeTypeOfRole(createForm.roleKey) === 'store',
)
const createNeedsRegion = computed(
  () => scopeTypeOfRole(createForm.roleKey) !== 'global',
)
const editNeedsStore = computed(
  () => scopeTypeOfRole(form.roleKey) === 'store',
)

const storeOptions = computed(() =>
  directory.stores.map((store) => ({
    id: store.id,
    label: `${store.name} · ${store.city}`,
  })),
)

function isSelf(row) {
  return (
    row.username === auth.user?.username || row.name === auth.user?.name
  )
}

function isStrongPassword(value) {
  const text = String(value || '')
  return (
    text.length >= 8 &&
    text.length <= 32 &&
    !/\s/.test(text) &&
    /[A-Za-z]/.test(text) &&
    /\d/.test(text)
  )
}

onMounted(async () => {
  try {
    await system.refresh()
  } catch (error) {
    ElMessage.error(`系统数据加载失败：${error.message}`)
  }
  selectRole(
    system.roles.find((role) => role.key === 'regional_manager')?.key ||
      system.roles[0]?.key ||
      '',
  )
  try {
    await directory.refresh()
  } catch {
    /* 门店列表仅用于编辑店长账号，失败不阻塞页面 */
  }
})

async function toggleStatus(row, value) {
  const status = value ? 'active' : 'disabled'
  if (status === 'disabled') {
    try {
      await ElMessageBox.confirm(
        `停用后「${row.name}」将立即无法登录与调用接口，确认停用？`,
        '停用账号',
        { type: 'warning', confirmButtonText: '停用' },
      )
    } catch {
      return
    }
  }
  try {
    await system.updateUser(row.id, { status })
    ElMessage.success(status === 'disabled' ? '账号已停用' : '账号已启用')
  } catch (error) {
    ElMessage.error(`操作失败：${error.message}`)
  }
}

function openCreate() {
  createForm.username = ''
  createForm.name = ''
  createForm.password = ''
  createForm.roleKey = 'regional_manager'
  createForm.region = '华东'
  createForm.storeId = ''
  createVisible.value = true
}

async function createAccount() {
  if (!createForm.username.trim() || !createForm.name.trim()) {
    ElMessage.warning('请填写用户名与姓名')
    return
  }
  if (!isStrongPassword(createForm.password)) {
    ElMessage.warning('初始密码需 8-32 位，且同时包含字母和数字')
    return
  }
  if (createNeedsStore.value && !createForm.storeId) {
    ElMessage.warning('该角色必须绑定门店')
    return
  }

  createSaving.value = true
  try {
    const record = await system.createUser({
      username: createForm.username.trim(),
      name: createForm.name.trim(),
      password: createForm.password,
      roleKey: createForm.roleKey,
      region: createForm.region.trim(),
      ...(createForm.storeId ? { storeId: createForm.storeId } : {}),
    })
    ElMessage.success(`账号 ${record.username} 已创建`)
    createVisible.value = false
    try {
      await system.refresh()
    } catch {
      // 列表刷新失败不影响创建结果
    }
  } catch (error) {
    ElMessage.error(`创建失败：${error.message}`)
  } finally {
    createSaving.value = false
  }
}

async function resetPassword(row) {
  let value = ''
  try {
    const result = await ElMessageBox.prompt(
      `请输入 ${row.name}（@${row.username}）的新密码，需 8-32 位且包含字母和数字`,
      '重置密码',
      {
        inputType: 'password',
        inputPlaceholder: '至少 8 位，含字母和数字',
        inputValidator: (input) =>
          isStrongPassword(input)
            ? true
            : '密码需 8-32 位，且同时包含字母和数字',
        confirmButtonText: '重置',
        cancelButtonText: '取消',
      },
    )
    value = result.value
  } catch {
    return
  }

  try {
    await system.resetPassword(row.id, value)
    ElMessage.success('密码已重置，该账号的旧登录态已失效')
    if (isSelf(row)) {
      auth.logout()
      router.push('/login')
    }
  } catch (error) {
    ElMessage.error(`重置失败：${error.message}`)
  }
}

function openEdit(row) {
  editing.value = row
  form.roleKey = row.roleKey
  form.storeId = row.storeId || ''
  editVisible.value = true
}

async function save() {
  if (!form.roleKey) {
    ElMessage.warning('请选择角色')
    return
  }
  if (editNeedsStore.value && !form.storeId) {
    ElMessage.warning('该角色必须绑定门店')
    return
  }
  saving.value = true
  try {
    await system.updateUser(editing.value.id, {
      roleKey: form.roleKey,
      ...(form.storeId ? { storeId: form.storeId } : {}),
    })
    ElMessage.success('账号角色已更新，该账号重新登录后生效')
    editVisible.value = false
    try {
      await system.refresh()
    } catch {
      // 列表刷新失败不影响保存结果
    }
  } catch (error) {
    ElMessage.error(`保存失败：${error.message}`)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page system-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">系统管理</h1>
        <p class="page-subtitle">
          账号启停、角色分配与权限边界 · 仅企业老板可操作
        </p>
      </div>

      <div class="page-head-actions">
        <span class="pill is-accent">Owner 专属</span>
        <el-button type="primary" :icon="Plus" @click="openCreate">
          新增账号
        </el-button>
        <el-button :icon="Refresh" @click="system.refresh()">刷新</el-button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat">
        <span>账号总数</span>
        <strong class="tabular">{{ summary.total }}</strong>
        <small>含全部角色</small>
      </div>
      <div class="stat is-success">
        <span>启用中</span>
        <strong class="tabular">{{ summary.active }}</strong>
        <small>可正常登录</small>
      </div>
      <div class="stat is-warning">
        <span>已停用</span>
        <strong class="tabular">{{ summary.disabled }}</strong>
        <small>禁止登录与接口调用</small>
      </div>
      <div class="stat">
        <span>角色数</span>
        <strong class="tabular">{{ summary.roles }}</strong>
        <small>含自定义角色</small>
      </div>
    </div>

    <section class="card system-card" v-loading="system.loading">
      <div class="card-head">
        <div>
          <div class="section-label">用户与账号</div>
          <p class="card-sub">
            停用立即生效；调整角色后需该账号重新登录，JWT 内的角色信息才会更新。
          </p>
        </div>
        <el-icon class="head-icon"><UserFilled /></el-icon>
      </div>

      <el-table :data="system.users" size="default" empty-text="暂无账号">
        <el-table-column label="账号" min-width="170">
          <template #default="{ row }">
            <div class="user-name">
              {{ row.name }}
              <el-tag v-if="isSelf(row)" size="small" effect="plain">本人</el-tag>
            </div>
            <div class="user-meta">@{{ row.username }} · {{ row.region }}</div>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="118">
          <template #default="{ row }">
            <el-tag
              size="small"
              effect="light"
              :type="roleTone[row.roleKey] || 'info'"
            >
              {{ row.roleName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="数据范围" min-width="170">
          <template #default="{ row }">
            <div>{{ row.scope }}</div>
            <div v-if="row.storeId" class="user-meta">
              绑定门店 {{ row.storeId }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="最近登录" width="150">
          <template #default="{ row }">
            <span :class="row.lastLoginAt ? '' : 'muted'">
              {{ row.lastLoginAt || '从未登录' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <div class="status-cell">
              <el-switch
                :model-value="row.status === 'active'"
                :disabled="isSelf(row)"
                @change="(value) => toggleStatus(row, value)"
              />
              <span class="status-text" :class="row.status === 'active' ? 'is-on' : 'is-off'">
                {{ row.status === 'active' ? '启用' : '停用' }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="168" align="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :disabled="isSelf(row)"
              @click="openEdit(row)"
            >
              编辑
            </el-button>
            <el-button link type="warning" @click="resetPassword(row)">
              重置密码
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="card system-card">
      <div class="card-head">
        <div>
          <div class="section-label">角色与权限</div>
          <p class="card-sub">
            权限配置实时影响接口校验；企业老板固定为超级管理员，不可修改。
          </p>
        </div>
        <el-button type="primary" size="small" :icon="Plus" @click="openRoleCreate">
          新增角色
        </el-button>
      </div>

      <el-table :data="system.roles" size="small" empty-text="暂无角色">
        <el-table-column label="角色" min-width="150">
          <template #default="{ row }">
            <div class="user-name">
              {{ row.name }}
              <el-tag
                size="small"
                effect="plain"
                :type="row.builtin ? 'info' : 'success'"
              >
                {{ row.builtin ? '内置' : '自定义' }}
              </el-tag>
            </div>
            <div class="user-meta">@{{ row.key }}</div>
          </template>
        </el-table-column>
        <el-table-column label="数据范围" width="96">
          <template #default="{ row }">
            {{
              { global: '全国', region: '区域', store: '门店' }[
                row.scopeType
              ] || row.scopeType
            }}
          </template>
        </el-table-column>
        <el-table-column label="账号数" width="76" align="right">
          <template #default="{ row }">
            <span class="tabular muted">{{ row.userCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="权限项" width="76" align="right">
          <template #default="{ row }">
            <span class="tabular muted">{{ row.permissions.length }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="selectRole(row.key)">
              配置权限
            </el-button>
            <el-button
              v-if="!row.builtin"
              link
              type="danger"
              @click="removeRole(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="card system-card">
      <div class="card-head">
        <div>
          <div class="section-label">角色权限矩阵</div>
          <p class="card-sub">
            {{
              roleEditable
                ? `正在编辑「${selectedRole?.name}」：勾选后点击保存权限`
                : '企业老板为超级管理员，拥有全部权限'
            }}
          </p>
        </div>
        <div class="matrix-actions">
          <el-select
            v-model="selectedRoleKey"
            size="small"
            class="role-select"
            @change="selectRole"
          >
            <el-option
              v-for="role in system.roles"
              :key="role.key"
              :label="role.name"
              :value="role.key"
            />
          </el-select>
          <el-button
            v-if="roleEditable"
            size="small"
            :disabled="roleSaving"
            @click="resetRolePermissions"
          >
            恢复默认
          </el-button>
          <el-button
            v-if="roleEditable"
            type="primary"
            size="small"
            :loading="roleSaving"
            @click="saveRolePermissions"
          >
            保存权限
          </el-button>
        </div>
      </div>

      <el-table
        v-if="matrixRows.length"
        :data="matrixRows"
        size="small"
        class="permission-matrix"
      >
        <el-table-column prop="module" label="模块" width="130" />
        <el-table-column prop="action" label="操作" min-width="150" />
        <el-table-column
          v-for="role in system.roles"
          :key="role.key"
          :label="role.name"
          align="center"
          width="118"
        >
          <template #default="{ row }">
            <el-checkbox
              v-if="role.key === selectedRoleKey && roleEditable"
              :model-value="hasDraftPermission(row.permission)"
              :title="`${role.name} · ${row.module} · ${row.action}`"
              @change="(value) => toggleDraftPermission(row.permission, value)"
            >
              <span class="sr-only">
                {{ role.name }} · {{ row.module }} · {{ row.action }}
              </span>
            </el-checkbox>
            <el-icon
              v-else-if="role.permissions.includes(row.permission)"
              class="allow-icon"
            >
              <CircleCheckFilled />
            </el-icon>
            <el-icon v-else class="deny-icon"><Minus /></el-icon>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-else
        description="演示模式下未加载权限矩阵，切换后端连接后可见"
        :image-size="72"
      />
    </section>

    <el-dialog v-model="editVisible" title="编辑账号" width="440px">
      <el-form label-position="top">
        <el-form-item label="账号">
          <el-input :model-value="editing?.name" disabled />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.roleKey" class="full-width">
            <el-option
              v-for="role in system.roles"
              :key="role.key"
              :label="`${role.name}（${role.userCount} 人）`"
              :value="role.key"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editNeedsStore" label="绑定门店">
          <el-select
            v-model="form.storeId"
            class="full-width"
            placeholder="选择门店"
          >
            <el-option
              v-for="store in storeOptions"
              :key="store.id"
              :label="store.label"
              :value="store.id"
            />
          </el-select>
        </el-form-item>
        <p class="dialog-note">
          角色变更会写入审计日志；保存后旧登录态立即失效，该账号需重新登录。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="createVisible" title="新增账号" width="460px">
      <el-form label-position="top">
        <el-form-item label="用户名">
          <el-input
            v-model="createForm.username"
            placeholder="3-32 位字母、数字或下划线"
          />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="createForm.name" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.roleKey" class="full-width">
            <el-option
              v-for="role in system.roles"
              :key="role.key"
              :label="role.name"
              :value="role.key"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="createNeedsRegion"
          label="所属区域"
        >
          <el-input
            v-model="createForm.region"
            placeholder="例如：华东"
          />
        </el-form-item>
        <el-form-item
          v-if="createNeedsStore"
          label="绑定门店"
        >
          <el-select
            v-model="createForm.storeId"
            class="full-width"
            placeholder="选择门店"
          >
            <el-option
              v-for="store in storeOptions"
              :key="store.id"
              :label="store.label"
              :value="store.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="初始密码">
          <el-input
            v-model="createForm.password"
            type="password"
            show-password
            placeholder="至少 8 位，含字母和数字"
          />
        </el-form-item>
        <p class="dialog-note">
          新账号立即生效；初始密码请线下告知本人，并建议首次登录后修改。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="createSaving"
          @click="createAccount"
        >
          创建
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="roleVisible" title="新增角色" width="620px">
      <el-form label-position="top">
        <div class="role-form-grid">
          <el-form-item label="角色编号">
            <el-input
              v-model="roleForm.key"
              placeholder="小写字母开头，如 inventory_lead"
            />
          </el-form-item>
          <el-form-item label="角色名称">
            <el-input v-model="roleForm.name" placeholder="例如：库存主管" />
          </el-form-item>
          <el-form-item label="数据范围">
            <el-select v-model="roleForm.scopeType" class="full-width">
              <el-option
                v-for="item in system.scopeTypes"
                :key="item.key"
                :label="item.label"
                :value="item.key"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="角色描述">
            <el-input
              v-model="roleForm.description"
              placeholder="选填，用于说明职责边界"
            />
          </el-form-item>
        </div>

        <div class="permission-picker">
          <div
            v-for="module in system.matrix"
            :key="module.key"
            class="permission-module"
          >
            <div class="permission-module-head">{{ module.label }}</div>
            <div class="permission-options">
              <el-checkbox
                v-for="action in module.actions"
                :key="`${module.key}.${action.key}`"
                :model-value="
                  roleForm.permissions.includes(
                    `${module.key}.${action.key}`,
                  )
                "
                @change="
                  (value) =>
                    toggleRoleFormPermission(
                      `${module.key}.${action.key}`,
                      value,
                    )
                "
              >
                {{ action.label }}
              </el-checkbox>
            </div>
          </div>
        </div>

        <p class="dialog-note">
          新角色立即生效，可在新增账号或编辑账号时选择；创建后仍可调整权限。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="roleVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="roleFormSaving"
          @click="createRole"
        >
          创建角色
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.system-page {
  animation: rise-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.system-card {
  padding: 16px 18px 18px;
  margin-bottom: 14px;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.card-sub {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.head-icon {
  margin-top: 4px;
  color: var(--line-strong);
  font-size: 20px;
}

.user-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.user-meta {
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
}

.status-cell {
  display: flex;
  align-items: center;
  gap: 7px;
}

.status-text {
  font-size: 12px;
  font-weight: 600;
}

.status-text.is-on {
  color: var(--success, #3f8f5a);
}

.status-text.is-off {
  color: var(--muted);
}

.allow-icon {
  color: var(--success, #3f8f5a);
  font-size: 15px;
  vertical-align: middle;
}

.deny-icon {
  color: var(--line-strong);
  font-size: 14px;
  vertical-align: middle;
}

.full-width {
  width: 100%;
}

.matrix-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.role-select {
  width: 148px;
}

.role-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.permission-picker {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  max-height: 360px;
  padding: 10px 12px;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
  scrollbar-gutter: stable;
}

.permission-module-head {
  margin-bottom: 4px;
  color: var(--text-soft);
  font-size: 11px;
  font-weight: 650;
}

.permission-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}

.permission-options :deep(.el-checkbox) {
  height: 28px;
  margin-right: 0;
}

.dialog-note {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.muted {
  color: var(--muted);
}

@media (max-width: 720px) {
  .system-card {
    padding: 14px;
  }

  .role-form-grid,
  .permission-picker {
    grid-template-columns: 1fr;
  }
}
</style>
