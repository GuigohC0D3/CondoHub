import { z } from 'zod';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM');

export const createCommonAreaSchema = z
  .object({
    name: z.string().min(2).max(80),
    description: z.string().max(500).optional(),
    capacity: z.number().int().positive().optional(),
    openTime: hhmm.default('08:00'),
    closeTime: hhmm.default('22:00'),
    approvalMode: z.enum(['AUTOMATIC', 'MANUAL']).default('MANUAL'),
    maxPerMonthPerResident: z.number().int().min(1).max(31).default(2),
    feeAmount: z.number().nonnegative().optional(),
  })
  .refine((d) => hhmmLt(d.openTime, d.closeTime), {
    message: 'openTime deve ser anterior a closeTime',
    path: ['closeTime'],
  });

export const updateCommonAreaSchema = z
  .object({
    name: z.string().min(2).max(80),
    description: z.string().max(500).nullable(),
    capacity: z.number().int().positive().nullable(),
    openTime: hhmm,
    closeTime: hhmm,
    approvalMode: z.enum(['AUTOMATIC', 'MANUAL']),
    maxPerMonthPerResident: z.number().int().min(1).max(31),
    feeAmount: z.number().nonnegative().nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo para atualizar' });

export const idParamSchema = z.object({ id: z.string().uuid() });

function hhmmLt(a: string, b: string): boolean {
  return a < b; // comparação lexicográfica funciona para HH:MM zero-padded
}

export type CreateCommonAreaInput = z.infer<typeof createCommonAreaSchema>;
export type UpdateCommonAreaInput = z.infer<typeof updateCommonAreaSchema>;
