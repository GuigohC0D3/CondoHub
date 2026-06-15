import { z } from 'zod';

export const createCondominiumSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'slug inválido (a-z, 0-9, hífen)').min(2).max(50),
  cnpj: z.string().max(20).optional(),
  city: z.string().max(80).optional(),
  state: z.string().length(2).optional(),
  plan: z.enum(['FREE', 'BASICO', 'PROFISSIONAL', 'ENTERPRISE']).default('FREE'),
  sindico: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().toLowerCase(),
    password: z.string().min(8).max(100),
  }),
});

export const updateSubscriptionSchema = z
  .object({
    plan: z.enum(['FREE', 'BASICO', 'PROFISSIONAL', 'ENTERPRISE']),
    status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'BLOCKED']),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo para atualizar' });

export const blockSchema = z.object({ reason: z.string().max(300).optional() });

export const listQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateCondominiumInput = z.infer<typeof createCondominiumSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
