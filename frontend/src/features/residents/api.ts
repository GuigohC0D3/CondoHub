import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

export type ResidentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE';

export interface Resident {
  id: string;
  fullName: string;
  cpf: string;
  userId: string | null;
  email: string | null;
  phone: string | null;
  occupancy: 'OWNER' | 'TENANT';
  status: ResidentStatus;
  apartment: { number: string; block: { name: string } | null } | null;
  vehicles: { id: string; plate: string; model: string | null }[];
}

export interface ResidentListParams {
  status?: ResidentStatus;
  search?: string;
  page: number;
  limit: number;
}

export const useResidents = (params: Ref<ResidentListParams>) =>
  useQuery({
    queryKey: ['residents', params],
    queryFn: async () => (await api.get<Paginated<Resident>>('/residents', { params: params.value })).data,
  });

export interface CreateResidentBody {
  fullName: string;
  cpf: string;
  apartmentId: string;
  email?: string;
  phone?: string;
  occupancy: 'OWNER' | 'TENANT';
}

export const useCreateResident = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateResidentBody) => (await api.post('/residents', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['residents'] }),
  });
};

export interface UpdateResidentBody {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  occupancy?: 'OWNER' | 'TENANT';
  apartmentId?: string;
}

export const useUpdateResident = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateResidentBody }) =>
      (await api.patch(`/residents/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['residents'] }),
  });
};

export const useApproveResident = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) =>
      (await api.patch(`/residents/${id}/approve`, { approve })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['residents'] }),
  });
};
