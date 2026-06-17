import { z } from 'zod';

const fraction = z.number().min(0).max(1); // proporção da fração ideal (0..1)

const itemInputSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  quorumRule: z.enum(['SIMPLE_MAJORITY', 'ABSOLUTE_MAJORITY', 'TWO_THIRDS', 'UNANIMITY']).default('SIMPLE_MAJORITY'),
  order: z.number().int().min(0).optional(),
  // Opções para item de múltipla escolha (ex.: eleição). Vazio = voto SIM/NÃO/ABSTENÇÃO.
  options: z.array(z.string().min(1).max(120)).max(20).optional(),
});

export const createAssemblySchema = z.object({
  title: z.string().min(3).max(200),
  notice: z.string().min(10).max(20000), // edital/convocação
  type: z.enum(['ORDINARIA', 'EXTRAORDINARIA']).default('ORDINARIA'),
  mode: z.enum(['PRESENCIAL', 'VIRTUAL', 'HIBRIDA']).default('VIRTUAL'),
  scheduledFor: z.coerce.date(),
  quorumFirst: fraction.default(0.5),
  quorumSecond: fraction.nullable().optional(),
  meetingUrl: z.string().url().max(500).optional(),
  items: z.array(itemInputSchema).max(50).optional(),
});

export const updateAssemblySchema = z
  .object({
    title: z.string().min(3).max(200),
    notice: z.string().min(10).max(20000),
    type: z.enum(['ORDINARIA', 'EXTRAORDINARIA']),
    mode: z.enum(['PRESENCIAL', 'VIRTUAL', 'HIBRIDA']),
    scheduledFor: z.coerce.date(),
    quorumFirst: fraction,
    quorumSecond: fraction.nullable(),
    meetingUrl: z.string().url().max(500).nullable(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo para atualizar' });

export const createItemSchema = itemInputSchema;

export const updateItemSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().max(5000).nullable(),
    quorumRule: z.enum(['SIMPLE_MAJORITY', 'ABSOLUTE_MAJORITY', 'TWO_THIRDS', 'UNANIMITY']),
    order: z.number().int().min(0),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo para atualizar' });

export const voteSchema = z
  .object({
    choice: z.enum(['YES', 'NO', 'ABSTAIN']).optional(),
    optionId: z.string().uuid().optional(),
  })
  .refine((d) => (d.choice ? !d.optionId : !!d.optionId), {
    message: 'Informe choice (SIM/NÃO/ABSTENÇÃO) OU optionId, nunca ambos',
  });

export const checkinSchema = z.object({
  apartmentId: z.string().uuid().optional(), // síndico pode dar presença a uma unidade
});

export const listAssembliesQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().uuid() });
export const itemParamSchema = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });

export type CreateAssemblyInput = z.infer<typeof createAssemblySchema>;
export type UpdateAssemblyInput = z.infer<typeof updateAssemblySchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
export type CheckinInput = z.infer<typeof checkinSchema>;
export type ListAssembliesQuery = z.infer<typeof listAssembliesQuerySchema>;
