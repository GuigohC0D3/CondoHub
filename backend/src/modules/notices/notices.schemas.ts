import { z } from 'zod';

const attachment = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(100),
});

export const createNoticeSchema = z.object({
  title: z.string().min(3).max(150),
  body: z.string().min(1).max(10000),
  isPinned: z.boolean().default(false),
  publishedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  attachments: z.array(attachment).max(10).optional(),
});

export const updateNoticeSchema = z
  .object({
    title: z.string().min(3).max(150),
    body: z.string().min(1).max(10000),
    isPinned: z.boolean(),
    expiresAt: z.coerce.date().nullable(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo para atualizar' });

export const listNoticesQuerySchema = z.object({
  pinned: z.enum(['true', 'false']).optional(),
  includeExpired: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;
export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>;
export type ListNoticesQuery = z.infer<typeof listNoticesQuerySchema>;
