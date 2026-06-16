import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

export interface Notification {
  id: string; type: string; title: string; body: string; linkUrl: string | null; isRead: boolean; createdAt: string;
}

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    refetchInterval: 30_000,
    queryFn: async () => (await api.get<Paginated<Notification> & { unreadCount: number }>('/notifications', { params: { limit: 10 } })).data,
  });

export const useMarkNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.patch(`/notifications/${id}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

export const useMarkAllNotifications = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.patch('/notifications/read-all')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};
