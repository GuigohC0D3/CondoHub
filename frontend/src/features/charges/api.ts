import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

export type ChargeStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED' | 'REFUNDED';
export type ChargeMethod = 'PIX' | 'BOLETO';

export interface Charge {
  id: string;
  description: string;
  amount: string | number;
  referenceMonth: string | null;
  dueDate: string;
  status: ChargeStatus;
  method: ChargeMethod;
  pixPayload: string | null;
  pixQrCodeUrl: string | null;
  boletoUrl: string | null;
  paidAt: string | null;
  apartment: { number: string; block: { name: string } | null } | null;
  resident: { fullName: string } | null;
}

const qc = ['charges'];

export const useCharges = (page: Ref<number>, status: Ref<string>) =>
  useQuery({
    queryKey: ['charges', page, status],
    queryFn: async () =>
      (await api.get<Paginated<Charge>>('/charges', {
        params: { page: page.value, limit: 20, ...(status.value ? { status: status.value } : {}) },
      })).data,
  });

export const useMyCharges = (page: Ref<number>) =>
  useQuery({
    queryKey: ['my-charges', page],
    queryFn: async () =>
      (await api.get<Paginated<Charge>>('/charges/mine', { params: { page: page.value, limit: 20 } })).data,
  });

export const useCreateCharge = () => {
  const c = useQueryClient();
  return useMutation({
    mutationFn: async (body: { apartmentId: string; description: string; amount: number; dueDate: string; method: string }) =>
      (await api.post('/charges', body)).data,
    onSuccess: () => c.invalidateQueries({ queryKey: qc }),
  });
};

export const useCreateBatch = () => {
  const c = useQueryClient();
  return useMutation({
    mutationFn: async (body: { referenceMonth: string; amount: number; dueDate: string; description?: string; method: string }) =>
      (await api.post('/charges/batch', body)).data,
    onSuccess: () => c.invalidateQueries({ queryKey: qc }),
  });
};

export const useCancelCharge = () => {
  const c = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/charges/${id}/cancel`)).data,
    onSuccess: () => c.invalidateQueries({ queryKey: qc }),
  });
};

/** DEMO: confirma o pagamento sem gateway real (modo stub). */
export const useSimulatePayment = () => {
  const c = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/charges/${id}/simulate-payment`)).data,
    onSuccess: () => {
      c.invalidateQueries({ queryKey: ['charges'] });
      c.invalidateQueries({ queryKey: ['my-charges'] });
    },
  });
};
