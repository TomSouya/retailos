import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/loading/style/css'
import './style.css'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { installErrorReporting } from './utils/error-reporter'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
installErrorReporting(app, router)

// 任意已登录请求返回 401：清理会话并回到登录页
window.addEventListener('retailos:unauthorized', () => {
  const auth = useAuthStore(pinia)
  auth.logout()
  if (router.currentRoute.value.path !== '/login') {
    router.replace('/login')
  }
})

app.mount('#app')
