import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(2).max(120),
  role: z.enum(['MORADOR', 'PORTEIRO']),
  // Vínculo opcional com um cadastro de morador existente (sem login).
  residentId: z.string().uuid().optional(),
});

export const acceptInvitationSchema = z.object({
  password: z.string().min(8).max(100),
});

export const tokenParamSchema = z.object({ token: z.string().min(10).max(120) });
export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
