import { z } from 'zod';

const money = z.number().positive().max(99_999_999).refine((n) => Number((n * 100).toFixed(0)) / 100 === n, {
  message: 'Valor com no máximo 2 casas decimais',
});

export const createCategorySchema = z.object({ name: z.string().min(2).max(60) });

export const createExpenseSchema = z.object({
  description: z.string().min(2).max(200),
  amount: money,
  dueDate: z.coerce.date(),
  categoryId: z.string().uuid().optional(),
  paidAt: z.coerce.date().optional(),
  receiptUrl: z.string().url().optional(),
});

export const updateExpenseSchema = z
  .object({
    description: z.string().min(2).max(200),
    amount: money,
    dueDate: z.coerce.date(),
    categoryId: z.string().uuid().nullable(),
    paidAt: z.coerce.date().nullable(),
    receiptUrl: z.string().url().nullable(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo para atualizar' });

export const createRevenueSchema = z.object({
  description: z.string().min(2).max(200),
  amount: money,
  receivedAt: z.coerce.date(),
  category: z.string().max(60).optional(),
});

export const listExpensesQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listRevenuesQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cashflowQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
});

export const reportQuerySchema = z
  .object({
    period: z.enum(['monthly', 'annual']),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(), // YYYY-MM
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    format: z.enum(['pdf', 'xlsx', 'json']).default('json'),
  })
  .refine((d) => (d.period === 'monthly' ? !!d.month : !!d.year), {
    message: 'monthly exige month=YYYY-MM; annual exige year',
  });

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type CreateRevenueInput = z.infer<typeof createRevenueSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
export type ListRevenuesQuery = z.infer<typeof listRevenuesQuerySchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
