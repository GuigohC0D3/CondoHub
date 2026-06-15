import { z } from 'zod';
import { isValidCpf, onlyDigits } from '@/utils/cpf';

const vehicleSchema = z.object({
  plate: z.string().min(5).max(8).toUpperCase(),
  model: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
});

const cpfField = z
  .string()
  .transform(onlyDigits)
  .refine(isValidCpf, { message: 'CPF inválido' });

export const createResidentSchema = z.object({
  fullName: z.string().min(2).max(120),
  cpf: cpfField,
  apartmentId: z.string().uuid(),
  phone: z.string().max(20).optional(),
  email: z.string().email().toLowerCase().optional(),
  photoUrl: z.string().url().optional(),
  occupancy: z.enum(['OWNER', 'TENANT']).default('OWNER'),
  movedInAt: z.coerce.date().optional(),
  vehicles: z.array(vehicleSchema).max(10).optional(),
});

// Edição: campos opcionais; CPF e apartamento podem mudar (registra histórico).
export const updateResidentSchema = z
  .object({
    fullName: z.string().min(2).max(120),
    cpf: cpfField,
    apartmentId: z.string().uuid(),
    phone: z.string().max(20).nullable(),
    email: z.string().email().toLowerCase().nullable(),
    photoUrl: z.string().url().nullable(),
    occupancy: z.enum(['OWNER', 'TENANT']),
    movedInAt: z.coerce.date().nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nenhum campo para atualizar' });

export const listResidentsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'INACTIVE']).optional(),
  apartmentId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const approveResidentSchema = z.object({
  approve: z.boolean(),
  reason: z.string().max(300).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export type CreateResidentInput = z.infer<typeof createResidentSchema>;
export type UpdateResidentInput = z.infer<typeof updateResidentSchema>;
export type ListResidentsQuery = z.infer<typeof listResidentsQuerySchema>;
export type ApproveResidentInput = z.infer<typeof approveResidentSchema>;
