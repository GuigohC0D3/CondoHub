import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types';
import { homeFor } from '@/router/nav';
import AppShell from '@/components/layout/AppShell.vue';

const appChildren: RouteRecordRaw[] = [
  { path: '', name: 'dashboard', component: () => import('@/features/dashboard/DashboardView.vue'), meta: { roles: ['SINDICO'] as Role[] } },
  { path: 'moradores', name: 'residents', component: () => import('@/features/residents/ResidentsListView.vue'), meta: { roles: ['SINDICO'] as Role[] } },
  { path: 'estrutura', name: 'structure', component: () => import('@/features/structure/StructureView.vue'), meta: { roles: ['SINDICO'] as Role[] } },
  { path: 'equipe', name: 'invitations', component: () => import('@/features/invitations/InvitationsView.vue'), meta: { roles: ['SINDICO'] as Role[] } },
  { path: 'avisos', name: 'notices', component: () => import('@/features/notices/NoticesListView.vue'), meta: { roles: ['SINDICO', 'MORADOR', 'PORTEIRO'] as Role[] } },
  { path: 'reservas', name: 'reservations', component: () => import('@/features/reservations/ReservationsView.vue'), meta: { roles: ['SINDICO', 'MORADOR'] as Role[] } },
  { path: 'chamados', name: 'tickets', component: () => import('@/features/tickets/TicketsView.vue'), meta: { roles: ['SINDICO', 'MORADOR'] as Role[] } },
  { path: 'financeiro', name: 'finance', component: () => import('@/features/finance/FinanceView.vue'), meta: { roles: ['SINDICO'] as Role[] } },
  { path: 'portaria', name: 'gate', component: () => import('@/features/portaria/GateView.vue'), meta: { roles: ['SINDICO', 'PORTEIRO'] as Role[] } },
  { path: 'visitantes', name: 'visitors', component: () => import('@/features/visitors/VisitorsView.vue'), meta: { roles: ['MORADOR'] as Role[] } },
  { path: 'encomendas', name: 'packages', component: () => import('@/features/packages/PackagesView.vue'), meta: { roles: ['MORADOR', 'PORTEIRO'] as Role[] } },
  { path: 'admin', name: 'admin', component: () => import('@/features/admin/AdminView.vue'), meta: { roles: ['SUPER_ADMIN'] as Role[] } },
  { path: 'perfil', name: 'profile', component: () => import('@/features/profile/ProfileView.vue') },
];

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/features/auth/LoginView.vue'), meta: { public: true } },
  { path: '/convite/:token', name: 'accept-invite', component: () => import('@/features/invitations/AcceptInviteView.vue'), meta: { public: true } },
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
    if (to.name === 'login' && auth.isAuthenticated) return homeFor(auth.role);
    return true;
  }

  if (to.matched.some((r) => r.meta.requiresAuth) && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  // Dashboard ('/') é só do síndico → manda cada papel para o seu início.
  if (to.name === 'dashboard' && auth.role && auth.role !== 'SINDICO') {
    return homeFor(auth.role);
  }

  const roles = to.meta.roles as Role[] | undefined;
  if (roles && auth.role && !roles.includes(auth.role)) {
    return { name: 'forbidden' };
  }
  return true;
});
