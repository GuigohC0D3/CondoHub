import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

export interface Block {
  id: string;
  name: string;
  _count?: { apartments: number };
}
export interface Apartment {
  id: string;
  number: string;
  floor: number | null;
  block: { id: string; name: string } | null;
  _count?: { residents: number };
}

export const useBlocks = () =>
  useQuery({ queryKey: ['blocks'], queryFn: async () => (await api.get<{ blocks: Block[] }>('/blocks')).data.blocks });

export const useApartments = () =>
  useQuery({
    queryKey: ['apartments'],
    queryFn: async () => (await api.get<Paginated<Apartment>>('/apartments', { params: { limit: 200 } })).data,
  });

export interface CreateBlockBody {
  name: string;
  apartmentCount?: number;
  unitsPerFloor?: number;
  startFloor?: number;
}

export const useCreateBlock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateBlockBody) => (await api.post('/blocks', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocks'] });
      qc.invalidateQueries({ queryKey: ['apartments'] });
    },
  });
};

export const useCreateApartment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { number: string; blockId?: string; floor?: number }) =>
      (await api.post('/apartments', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apartments'] });
      qc.invalidateQueries({ queryKey: ['blocks'] });
    },
  });
};
