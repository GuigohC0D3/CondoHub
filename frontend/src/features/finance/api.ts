import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

export interface Expense {
  id: string; description: string; amount: string; dueDate: string; paidAt: string | null;
  category: { id: string; name: string } | null;
}
export interface Revenue { id: string; description: string; amount: string; receivedAt: string; category: string | null }
export interface Category { id: string; name: string }
export interface Cashflow {
  year: number;
  months: { month: number; revenue: number; expense: number; balance: number }[];
  totals: { revenue: number; expense: number; balance: number };
}

export const useExpenses = (page: Ref<number>) =>
  useQuery({ queryKey: ['expenses', page], queryFn: async () => (await api.get<Paginated<Expense>>('/finance/expenses', { params: { page: page.value, limit: 20 } })).data });

export const useRevenues = (page: Ref<number>) =>
  useQuery({ queryKey: ['revenues', page], queryFn: async () => (await api.get<Paginated<Revenue>>('/finance/revenues', { params: { page: page.value, limit: 20 } })).data });

export const useCategories = () =>
  useQuery({ queryKey: ['fin-categories'], queryFn: async () => (await api.get<{ categories: Category[] }>('/finance/categories')).data.categories });

export const useCashflow = (year: Ref<number>) =>
  useQuery({ queryKey: ['cashflow', year], queryFn: async () => (await api.get<Cashflow>('/finance/cashflow', { params: { year: year.value } })).data });

export const useCreateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { description: string; amount: number; dueDate: string; categoryId?: string }) => (await api.post('/finance/expenses', body)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
};
export const useCreateRevenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { description: string; amount: number; receivedAt: string }) => (await api.post('/finance/revenues', body)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['revenues'] }); qc.invalidateQueries({ queryKey: ['cashflow'] }); },
  });
};

/** Baixa o relatório (pdf|xlsx) como arquivo. */
export async function downloadReport(month: string, format: 'pdf' | 'xlsx') {
  const res = await api.get('/finance/report', {
    params: { period: 'monthly', month, format }, responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-${month}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
