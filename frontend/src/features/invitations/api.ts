import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types';

export interface Invitation {
  id: string;
  email: string;
  name: string;
  role: 'MORADOR' | 'PORTEIRO';
  token: string;
  status: string;
  createdAt: string;
  resident: { fullName: string } | null;
}

export const useInvitations = () =>
  useQuery({ queryKey: ['invitations'], queryFn: async () => (await api.get<{ invitations: Invitation[] }>('/invitations')).data.invitations });

export const useCreateInvitation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; name: string; role: string; residentId?: string }) =>
      (await api.post<{ invitation: Invitation }>('/invitations', body)).data.invitation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
      qc.invalidateQueries({ queryKey: ['residents'] });
    },
  });
};

export const useRevokeInvitation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/invitations/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }),
  });
};

// --- Público (tela de aceite) ---
export interface InviteInfo {
  email: string; name: string; role: string; condominium: { name: string; slug: string };
}
export const fetchInviteInfo = async (token: string) =>
  (await api.get<{ invitation: InviteInfo }>(`/invitations/accept/${token}`)).data.invitation;

export const acceptInvite = async (token: string, password: string) =>
  (await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>(`/invitations/accept/${token}`, { password })).data;
