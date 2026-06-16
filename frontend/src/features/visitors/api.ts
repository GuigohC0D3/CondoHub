import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

export type VisitorStatus = 'EXPECTED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'DENIED';

export interface Visitor {
  id: string;
  fullName: string;
  document: string | null;
  photoUrl: string | null;
  status: VisitorStatus;
  qrCode: string;
  qrCodeDataUrl?: string;
  accessUrl?: string;
  expiresAt: string | null;
  expectedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  resident: { fullName: string; apartmentId: string };
}

export const useVisitors = (page: Ref<number>, status?: Ref<string | undefined>) =>
  useQuery({
    queryKey: ['visitors', page, status],
    queryFn: async () =>
      (await api.get<Paginated<Visitor>>('/visitors', { params: { page: page.value, limit: 20, status: status?.value } })).data,
  });

export const useCreateVisitor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { fullName: string; document?: string; expectedAt?: string }) =>
      (await api.post<{ visitor: Visitor }>('/visitors', body)).data.visitor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
};

export const validateQr = async (qrCode: string) =>
  (await api.get<{ visitor: Visitor }>(`/visitors/validate/${qrCode}`)).data.visitor;

export const useVisitorAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, body }: { id: string; action: 'checkin' | 'checkout' | 'deny'; body?: Record<string, unknown> }) =>
      (await api.post<{ visitor: Visitor }>(`/visitors/${id}/${action}`, body ?? {})).data.visitor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });
};
