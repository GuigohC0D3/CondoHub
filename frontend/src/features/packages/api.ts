import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

export type PackageStatus = 'RECEIVED' | 'NOTIFIED' | 'PICKED_UP';

export interface Package {
  id: string;
  description: string | null;
  carrier: string | null;
  status: PackageStatus;
  photoUrl: string | null;
  receivedAt: string;
  pickedUpAt: string | null;
  pickedUpBy: string | null;
  apartment: { number: string; block: { name: string } | null };
}

export const usePackages = (page: Ref<number>) =>
  useQuery({
    queryKey: ['packages', page],
    queryFn: async () => (await api.get<Paginated<Package>>('/packages', { params: { page: page.value, limit: 20 } })).data,
  });

export const useCreatePackage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { apartmentId: string; description?: string; carrier?: string; photo?: string }) => (await api.post('/packages', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
};

export const usePickup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pickedUpBy }: { id: string; pickedUpBy: string }) => (await api.patch(`/packages/${id}/pickup`, { pickedUpBy })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
};
