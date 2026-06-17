import type { Component } from 'vue';
import {
  LayoutDashboard, Users, Building2, Megaphone, CalendarCheck, Wrench,
  Wallet, DoorOpen, Package, UserPlus, ShieldCheck, Mail, Lightbulb,
} from 'lucide-vue-next';
import type { Role } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  icon: Component;
  roles: Role[];
}

/**
 * Fonte única de navegação: dirige tanto a Sidebar quanto os guards do router.
 * Mantém o RBAC do front alinhado ao do backend.
 */
export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['SINDICO'] },
  { to: '/moradores', label: 'Moradores', icon: Users, roles: ['SINDICO'] },
  { to: '/estrutura', label: 'Estrutura', icon: Building2, roles: ['SINDICO'] },
  { to: '/equipe', label: 'Convites', icon: Mail, roles: ['SINDICO'] },
  { to: '/avisos', label: 'Avisos', icon: Megaphone, roles: ['SINDICO', 'MORADOR', 'PORTEIRO'] },
  { to: '/reservas', label: 'Reservas', icon: CalendarCheck, roles: ['SINDICO', 'MORADOR'] },
  { to: '/chamados', label: 'Chamados', icon: Wrench, roles: ['SINDICO', 'MORADOR'] },
  { to: '/sugestoes', label: 'Sugestões', icon: Lightbulb, roles: ['SINDICO', 'MORADOR'] },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, roles: ['SINDICO'] },
  { to: '/portaria', label: 'Portaria', icon: DoorOpen, roles: ['SINDICO', 'PORTEIRO'] },
  { to: '/visitantes', label: 'Visitantes', icon: UserPlus, roles: ['MORADOR'] },
  { to: '/encomendas', label: 'Encomendas', icon: Package, roles: ['MORADOR', 'PORTEIRO'] },
  { to: '/admin', label: 'Plataforma', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
];

/** Rota inicial por papel (o dashboard em '/' é exclusivo do síndico). */
export function homeFor(role: Role | null): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/admin';
    case 'SINDICO': return '/';
    case 'MORADOR': return '/avisos';
    case 'PORTEIRO': return '/portaria';
    default: return '/login';
  }
}
