import { z } from 'zod';

export const createPackageSchema = z.object({
  apartmentId: z.string().uuid(),
  description: z.string().max(300).optional(),
  carrier: z.string().max(80).optional(),
  photoUrl: z.string().url().optional(),
});

export const listPackagesQuerySchema = z.object({
  status: z.enum(['RECEIVED', 'NOTIFIED', 'PICKED_UP']).optional(),
  apartmentId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const pickupSchema = z.object({
  pickedUpBy: z.string().min(2).max(120), // nome de quem retirou
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type ListPackagesQuery = z.infer<typeof listPackagesQuerySchema>;
export type PickupInput = z.infer<typeof pickupSchema>;
