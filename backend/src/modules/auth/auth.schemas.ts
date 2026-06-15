import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
  // Slug do condomínio (subdomínio). Ausente = login de plataforma (SUPER_ADMIN).
  condominiumSlug: z.string().min(1).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
