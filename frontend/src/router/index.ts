import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types';
import AppShell from '@/components/layout/AppShell.vue';

const placeholder = () => import('@/pages/PlaceholderView.vue');

const appChildren: RouteRecordRaw[] = [
  { path: '', name: 'dashboard', component: () => import('@/features/dashboard/DashboardView.vue'), meta: { roles: ['SINDICO'] as Role[] } },
  { path: 'moradores', name: 'residents', component: placeholder, meta: { roles: ['SINDICO'] as Role[] } },
  { path: 'estrutura', name: 'structure', component: placeholder, meta: { roles: ['SINDICO'] as Role[] } },
  { path: 'avisos', name: 'notices', component: placeholder, meta: { roles: ['SINDICO', 'MORADOR', 'PORTEIRO'] as Role[] } },
  { path: 'reservas', name: 'reservations', component: placeholder, meta: { roles: ['SINDICO', 'MORADOR'] as Role[] } },
  { path: 'chamados', name: 'tickets', component: placeholder, meta: { roles: ['SINDICO', 'MORADOR'] as Role[] } },
  { path: 'financeiro', name: 'finance', component: placeholder, meta: { roles: ['SINDICO'] as Role[] } },
  { path: 'portaria', name: 'gate', component: placeholder, meta: { roles: ['SINDICO', 'PORTEIRO'] as Role[] } },
  { path: 'visitantes', name: 'visitors', component: placeholder, meta: { roles: ['MORADOR'] as Role[] } },
  { path: 'encomendas', name: 'packages', component: placeholder, meta: { roles: ['MORADOR', 'PORTEIRO'] as Role[] } },
  { path: 'admin', name: 'admin', component: placeholder, meta: { roles: ['SUPER_ADMIN'] as Role[] } },
  { path: 'perfil', name: 'profile', component: placeholder },
];

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/features/auth/LoginView.vue'), meta: { public: true } },
  { path: '/403', name: 'forbidden', component: () => import('@/pages/Forbidden.vue') },
  {
    path: '/',
    component: AppShell,
    meta: { requiresAuth: true },
    children: appChildren,
  },
  { path: '/:pathMatch(.*)*', name: 'notfound', component: () => import('@/pages/NotFound.vue') },
];

export const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.restore();

  if (to.meta.public) {
    if (to.name === 'login' && auth.isAuthenticated) return { path: '/' };
    return true;
  }

  if (to.matched.some((r) => r.meta.requiresAuth) && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  const roles = to.meta.roles as Role[] | undefined;
  if (roles && auth.role && !roles.includes(auth.role)) {
    return { name: 'forbidden' };
  }
  return true;
});
