import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

export interface Notice {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  publishedAt: string;
  expiresAt: string | null;
  isRead: boolean;
  author: { name: string };
  attachments: { id: string; fileName: string; fileUrl: string }[];
  _count: { reads: number };
}

export const useNotices = (page: Ref<number>) =>
  useQuery({
    queryKey: ['notices', page],
    queryFn: async () => (await api.get<Paginated<Notice>>('/notices', { params: { page: page.value, limit: 20 } })).data,
  });

export const useCreateNotice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; body: string; isPinned: boolean }) => (await api.post('/notices', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices'] }),
  });
};

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/notices/${id}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices'] }),
  });
};

export const useDeleteNotice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/notices/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices'] }),
  });
};
