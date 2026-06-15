import { z } from 'zod';

export const createBlockSchema = z.object({ name: z.string().min(1).max(60) });
export const updateBlockSchema = z.object({ name: z.string().min(1).max(60) });

export const createApartmentSchema = z.object({
  number: z.string().min(1).max(20),
  blockId: z.string().uuid().optional(),
  floor: z.number().int().min(-5).max(200).optional(),
});
export const updateApartmentSchema = z
  .object({
    number: z.string().min(1).max(20),
    blockId: z.string().uuid().nullable(),
    floor: z.number().int().min(-5).max(200).nullable(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo para atualizar' });

export const listApartmentsQuerySchema = z.object({
  blockId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateApartmentInput = z.infer<typeof createApartmentSchema>;
export type UpdateApartmentInput = z.infer<typeof updateApartmentSchema>;
export type ListApartmentsQuery = z.infer<typeof listApartmentsQuerySchema>;
