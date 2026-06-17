import { z } from 'zod';

const money = z
  .number()
  .positive()
  .max(99_999_999)
  .refine((n) => Number((n * 100).toFixed(0)) / 100 === n, {
    message: 'Valor com no máximo 2 casas decimais',
  });

const referenceMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato esperado YYYY-MM');

export const createChargeSchema = z.object({
  apartmentId: z.string().uuid(),
  residentId: z.string().uuid().optional(), // pagador; default = morador da unidade
  kind: z.enum(['CONDO_FEE', 'RESERVATION', 'EXTRA']).default('CONDO_FEE'),
  description: z.string().min(2).max(200),
  referenceMonth: referenceMonth.optional(),
  amount: money,
  dueDate: z.coerce.date(),
  method: z.enum(['PIX', 'BOLETO']).default('PIX'),
});

export const createBatchSchema = z.object({
  referenceMonth,
  description: z.string().min(2).max(200).optional(),
  amount: money,
  dueDate: z.coerce.date(),
  method: z.enum(['PIX', 'BOLETO']).default('PIX'),
});

export const listChargesQuerySchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELED', 'REFUNDED']).optional(),
  apartmentId: z.string().uuid().optional(),
  referenceMonth: referenceMonth.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateChargeInput = z.infer<typeof createChargeSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type ListChargesQuery = z.infer<typeof listChargesQuerySchema>;
