import { z } from 'zod';

export const createVisitorSchema = z.object({
  fullName: z.string().min(2).max(120),
  document: z.string().max(30).optional(),
  photoUrl: z.string().url().optional(),
  expectedAt: z.coerce.date().optional(),
});

export const listVisitorsQuerySchema = z.object({
  status: z.enum(['EXPECTED', 'CHECKED_IN', 'CHECKED_OUT', 'DENIED']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().uuid() });
export const qrParamSchema = z.object({ qrCode: z.string().min(10).max(100) });

export type CreateVisitorInput = z.infer<typeof createVisitorSchema>;
export type ListVisitorsQuery = z.infer<typeof listVisitorsQuerySchema>;
