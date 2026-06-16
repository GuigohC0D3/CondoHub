import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

export type ReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

export interface CommonArea {
  id: string;
  name: string;
  approvalMode: 'AUTOMATIC' | 'MANUAL';
  openTime: string;
  closeTime: string;
  maxPerMonthPerResident: number;
  isActive: boolean;
}
export interface Reservation {
  id: string;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  notes: string | null;
  commonArea: { id: string; name: string };
  resident: { id: string; fullName: string };
}

export const useCommonAreas = () =>
  useQuery({ queryKey: ['common-areas'], queryFn: async () => (await api.get<{ commonAreas: CommonArea[] }>('/common-areas')).data.commonAreas });

export const useReservations = (page: Ref<number>) =>
  useQuery({
    queryKey: ['reservations', page],
    queryFn: async () => (await api.get<Paginated<Reservation>>('/reservations', { params: { page: page.value, limit: 20 } })).data,
  });

export const useCreateCommonArea = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; approvalMode: string; maxPerMonthPerResident: number; openTime: string; closeTime: string }) =>
      (await api.post('/common-areas', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['common-areas'] }),
  });
};

export const useUpdateCommonArea = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      (await api.patch(`/common-areas/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['common-areas'] }),
  });
};

export const useCreateReservation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { commonAreaId: string; startsAt: string; endsAt: string; notes?: string }) =>
      (await api.post('/reservations', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  });
};

export const useDecideReservation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => (await api.patch(`/reservations/${id}/approve`, { approve })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  });
};

export const useCancelReservation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.patch(`/reservations/${id}/cancel`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  });
};
