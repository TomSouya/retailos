import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/layouts/AppLayout.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: AppLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: {
          title: '经营驾驶舱',
          section: '经营数据中心',
          permission: 'dashboard.read',
        },
      },
      {
        path: 'inventory',
        name: 'inventory',
        component: () => import('@/views/InventoryView.vue'),
        meta: {
          title: '库存管理',
          section: '商品与供应链',
          permission: 'inventory.read',
        },
      },
      {
        path: 'audit',
        name: 'audit',
        component: () => import('@/views/AuditView.vue'),
        meta: {
          title: '审计日志',
          section: '系统管理',
          permission: 'system.audit',
        },
      },
      {
        path: 'products',
        name: 'products',
        component: () => import('@/views/ProductsView.vue'),
        meta: {
          title: '商品管理',
          section: '商品与供应链',
          icon: 'Goods',
          permission: 'products.read',
        },
      },
      {
        path: 'procurement',
        name: 'procurement',
        component: () => import('@/views/ProcurementView.vue'),
        meta: {
          title: '采购管理',
          section: '商品与供应链',
          icon: 'ShoppingCart',
          permission: 'procurement.read',
        },
      },
      {
        path: 'stores',
        name: 'stores',
        component: () => import('@/views/StoresView.vue'),
        meta: {
          title: '门店管理',
          section: '商品与供应链',
          icon: 'Shop',
          permission: 'stores.read',
        },
      },
      {
        path: 'members',
        name: 'members',
        component: () => import('@/views/MembersView.vue'),
        meta: {
          title: '会员管理',
          section: '客户与系统',
          icon: 'User',
          permission: 'members.read',
        },
      },
      {
        path: 'orders',
        name: 'orders',
        component: () => import('@/views/OrdersView.vue'),
        meta: {
          title: '订单管理',
          section: '经营数据中心',
          icon: 'Tickets',
          permission: 'orders.read',
        },
      },
      {
        path: 'system',
        name: 'system',
        component: () => import('@/views/SystemView.vue'),
        meta: {
          title: '系统管理',
          section: '系统管理',
          icon: 'Setting',
          permission: 'system.accounts',
        },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.public) {
    if (auth.isAuthenticated) return auth.homePath
    return true
  }

  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.permission && !auth.can(to.meta.permission)) {
    ElMessage.warning('当前角色无权访问该页面')
    return auth.homePath
  }

  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · RetailOS` : 'RetailOS'
})

export default router
