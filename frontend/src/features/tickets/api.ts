import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'LEAK' | 'CLEANING' | 'NOISE' | 'SECURITY' | 'MAINTENANCE' | 'OTHER';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  resolvedAt: string | null;
  resident: {
    fullName: string;
    phone?: string | null;
    apartment?: { number: string; block: { name: string } | null } | null;
  };
  assignee: { id: string; name: string } | null;
  comments?: { id: string; body: string; createdAt: string; author: { name: string; role: string } }[];
  attachments?: { id: string; fileName: string }[];
  _count?: { comments: number; attachments: number };
}

export const useTickets = (page: Ref<number>) =>
  useQuery({
    queryKey: ['tickets', page],
    queryFn: async () => (await api.get<Paginated<Ticket>>('/tickets', { params: { page: page.value, limit: 20 } })).data,
  });

export const useTicket = (id: Ref<string | null>) =>
  useQuery({
    queryKey: ['ticket', id],
    enabled: () => !!id.value,
    queryFn: async () => (await api.get<{ ticket: Ticket }>(`/tickets/${id.value}`)).data.ticket,
  });

export const useCreateTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; description: string; category: string; priority: string }) =>
      (await api.post('/tickets', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  });
};

export const useUpdateTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => (await api.patch(`/tickets/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['ticket'] });
    },
  });
};

export const useAddComment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => (await api.post(`/tickets/${id}/comments`, { body })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket'] }),
  });
};
