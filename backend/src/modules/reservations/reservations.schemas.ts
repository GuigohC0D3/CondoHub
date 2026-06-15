import { z } from 'zod';

export const createReservationSchema = z
  .object({
    commonAreaId: z.string().uuid(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    notes: z.string().max(300).optional(),
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: 'endsAt deve ser posterior a startsAt',
    path: ['endsAt'],
  })
  .refine((d) => d.startsAt.getTime() > Date.now(), {
    message: 'Não é possível reservar no passado',
    path: ['startsAt'],
  });

export const listReservationsQuerySchema = z.object({
  commonAreaId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const approveReservationSchema = z.object({
  approve: z.boolean(),
  reason: z.string().max(300).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>;
export type ApproveReservationInput = z.infer<typeof approveReservationSchema>;
