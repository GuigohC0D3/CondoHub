import { useQuery } from '@tanstack/vue-query';
import { api } from '@/lib/api';

export interface DashboardData {
  kpis: {
    residents: number;
    pendingResidents: number;
    openTickets: number;
    pendingPackages: number;
    monthExpense: number;
    monthRevenue: number;
    monthBalance: number;
  };
  upcomingReservations: { id: string; startsAt: string; commonArea: { name: string }; resident: { fullName: string } }[];
  recentNotices: { id: string; title: string; isPinned: boolean; publishedAt: string }[];
  ticketsByStatus: { status: string; count: number }[];
  cashflow: { year: number; months: { month: number; revenue: number; expense: number; balance: number }[]; totals: { revenue: number; expense: number; balance: number } };
  generatedAt: string;
}

export const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/dashboard')).data,
  });
