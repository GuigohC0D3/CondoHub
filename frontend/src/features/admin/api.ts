import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

export interface Metrics {
  condominiums: { total: number; active: number; blocked: number };
  subscriptions: { active: number; byPlan: { plan: string; count: number }[] };
  users: number;
  mrr: number;
  arr: number;
}
export interface Condominium {
  id: string; name: string; slug: string; isActive: boolean;
  subscription: { plan: string; status: string; pricePerMonth: string } | null;
  _count: { users: number; apartments: number };
}

export const useMetrics = () =>
  useQuery({ queryKey: ['admin-metrics'], queryFn: async () => (await api.get<Metrics>('/admin/metrics')).data });

export const useCondominiums = (page: Ref<number>, search: Ref<string | undefined>) =>
  useQuery({
    queryKey: ['admin-condos', page, search],
    queryFn: async () => (await api.get<Paginated<Condominium>>('/admin/condominiums', { params: { page: page.value, limit: 20, search: search.value } })).data,
  });

export const useCreateCondominium = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; slug: string; plan: string; sindico: { name: string; email: string; password: string } }) =>
      (await api.post('/admin/condominiums', body)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-condos'] }); qc.invalidateQueries({ queryKey: ['admin-metrics'] }); },
  });
};

export const useToggleBlock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, block }: { id: string; block: boolean }) =>
      (await api.patch(`/admin/condominiums/${id}/${block ? 'block' : 'unblock'}`, block ? { reason: 'inadimplência' } : {})).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-condos'] }); qc.invalidateQueries({ queryKey: ['admin-metrics'] }); },
  });
};
