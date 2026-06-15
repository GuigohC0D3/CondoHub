import { z } from 'zod';

const category = z.enum(['LEAK', 'CLEANING', 'NOISE', 'SECURITY', 'MAINTENANCE', 'OTHER']);
const priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const status = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

export const createTicketSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(3).max(4000),
  category: category.default('OTHER'),
  priority: priority.default('MEDIUM'),
});

// Atualização do síndico: status / prioridade / responsável (assignee).
export const updateTicketSchema = z
  .object({
    status,
    priority,
    category,
    assigneeId: z.string().uuid().nullable(), // null = desatribuir
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo para atualizar' });

export const listTicketsQuerySchema = z.object({
  status: status.optional(),
  priority: priority.optional(),
  category: category.optional(),
  assigneeId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const commentSchema = z.object({
  body: z.string().min(1).max(2000),
});

export const attachmentSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(100),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type AttachmentInput = z.infer<typeof attachmentSchema>;
