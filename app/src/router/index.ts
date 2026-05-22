import { createRouter, createWebHistory } from 'vue-router'
import WorkspaceView from '@/views/WorkspaceView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/workspace' },
    { path: '/workspace', name: 'workspace', component: WorkspaceView },
    {
      path: '/profiles',
      name: 'profiles',
      component: () => import('@/views/SteelProfileView.vue'),
    },
    {
      path: '/analysis',
      name: 'analysis',
      component: () => import('@/views/AnalysisView.vue'),
    },
    {
      path: '/report',
      name: 'report',
      component: () => import('@/views/ReportView.vue'),
    },
  ],
})
