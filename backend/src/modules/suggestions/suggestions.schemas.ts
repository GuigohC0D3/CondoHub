import { z } from 'zod';

const category = z.enum(['COMMON_AREAS', 'SECURITY', 'SUSTAINABILITY', 'INFRASTRUCTURE', 'FINANCE', 'OTHER']);

export const createSuggestionSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(5).max(3000),
  category: category.default('OTHER'),
});

export const updateSuggestionSchema = z
  .object({
    title: z.string().min(3).max(160),
    description: z.string().min(5).max(3000),
    category,
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo para atualizar' });

export const setStatusSchema = z.object({
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'PLANNED', 'DONE', 'REJECTED']),
  message: z.string().max(1000).optional(), // resposta oficial ao autor
});

export const listSuggestionsQuerySchema = z.object({
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'PLANNED', 'DONE', 'REJECTED']).optional(),
  category: category.optional(),
  sort: z.enum(['votes', 'recent']).default('votes'),
  mine: z.coerce.boolean().optional(), // só as minhas
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;
export type UpdateSuggestionInput = z.infer<typeof updateSuggestionSchema>;
export type SetStatusInput = z.infer<typeof setStatusSchema>;
export type ListSuggestionsQuery = z.infer<typeof listSuggestionsQuerySchema>;
