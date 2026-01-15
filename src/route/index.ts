import { createWebHistory, createWebHashHistory, createRouter } from 'vue-router'

import SceneList from '@/views/SceneList.vue'
import EnginePanel from '@/views/EnginePanel.vue'

const routes = [
  { path: '/', component: SceneList },
  { path: '/engine', component: EnginePanel },
]

// GitHub Pages 部署时使用 hash 模式，避免路由问题
// 本地开发可以使用 history 模式
const useHashMode = import.meta.env.PROD && import.meta.env.BASE_URL !== '/'

const router = createRouter({
  history: useHashMode 
    ? createWebHashHistory(import.meta.env.BASE_URL)
    : createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router;