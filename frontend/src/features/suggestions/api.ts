import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { Ref } from 'vue';
import { api } from '@/lib/api';
import type { Paginated } from '@/types';

export type SuggestionCategory = 'COMMON_AREAS' | 'SECURITY' | 'SUSTAINABILITY' | 'INFRASTRUCTURE' | 'FINANCE' | 'OTHER';
export type SuggestionStatus = 'OPEN' | 'UNDER_REVIEW' | 'PLANNED' | 'DONE' | 'REJECTED';

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: SuggestionCategory;
  status: SuggestionStatus;
  responseMessage: string | null;
  respondedAt: string | null;
  createdAt: string;
  hasVoted: boolean;
  isAuthor: boolean;
  resident: { id: string; fullName: string; apartment?: { number: string; block: { name: string } | null } | null };
  _count?: { votes: number };
}

export interface SuggestionFilters {
  status?: SuggestionStatus;
  category?: SuggestionCategory;
  sort: 'votes' | 'recent';
  mine?: boolean;
}

export const useSuggestions = (page: Ref<number>, filters: Ref<SuggestionFilters>) =>
  useQuery({
    queryKey: ['suggestions', page, filters],
    queryFn: async () =>
      (await api.get<Paginated<Suggestion>>('/suggestions', {
        params: { page: page.value, limit: 20, ...filters.value },
      })).data,
  });

export const useCreateSuggestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; description: string; category: string }) =>
      (await api.post('/suggestions', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggestions'] }),
  });
};

export const useVoteSuggestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<{ hasVoted: boolean; voteCount: number }>(`/suggestions/${id}/vote`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggestions'] }),
  });
};

export const useSetSuggestionStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, message }: { id: string; status: string; message?: string }) =>
      (await api.patch(`/suggestions/${id}/status`, { status, message })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggestions'] }),
  });
};

export const useDeleteSuggestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/suggestions/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suggestions'] }),
  });
};
