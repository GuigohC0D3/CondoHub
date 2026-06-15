import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import type {
  ApproveResidentInput,
  CreateResidentInput,
  ListResidentsQuery,
  UpdateResidentInput,
} from './residents.schemas';

const residentInclude = {
  apartment: { include: { block: true } },
  vehicles: true,
} satisfies Prisma.ResidentInclude;

// Campos rastreados no histórico de alterações.
const TRACKED = ['fullName', 'cpf', 'phone', 'email', 'photoUrl', 'occupancy', 'movedInAt', 'apartmentId'] as const;

/** Garante que o apartamento existe no tenant atual (extensão escopa por condominiumId). */
async function assertApartmentInTenant(apartmentId: string): Promise<void> {
  const apt = await prisma.apartment.findFirst({ where: { id: apartmentId }, select: { id: true } });
  if (!apt) throw AppError.business('Apartamento inexistente neste condomínio');
}

export async function list(query: ListResidentsQuery) {
  const { status, apartmentId, search, page, limit } = query;

  const where: Prisma.ResidentWhereInput = {
    ...(status && { status }),
    ...(apartmentId && { apartmentId }),
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.resident.findMany({
      where,
      include: residentInclude,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake({ page, limit }),
    }),
    prisma.resident.count({ where }),
  ]);

  return paginate(data, total, { page, limit });
}

export async function getById(id: string) {
  const resident = await prisma.resident.findFirst({
    where: { id },
    include: { ...residentInclude, documents: true },
  });
  if (!resident) throw AppError.notFound('Morador não encontrado');
  return resident;
}

export async function getByUserId(userId: string) {
  const resident = await prisma.resident.findFirst({
    where: { userId },
    include: { ...residentInclude, documents: true },
  });
  if (!resident) throw AppError.notFound('Cadastro de morador não encontrado');
  return resident;
}

export async function create(input: CreateResidentInput, actorId: string) {
  await assertApartmentInTenant(input.apartmentId);

  const { vehicles, ...data } = input;
  // condominiumId é injetado pela extensão de tenant (src/lib/prisma.ts), por isso
  // é omitido aqui — o cast reconcilia o tipo estático com a injeção em runtime.
  const createData = {
    ...data,
    status: 'PENDING' as const,
    ...(vehicles?.length && { vehicles: { create: vehicles } }),
  } satisfies Omit<Prisma.ResidentUncheckedCreateInput, 'condominiumId'>;

  const resident = await prisma.resident.create({
    data: createData as Prisma.ResidentUncheckedCreateInput,
    include: residentInclude,
  });

  await audit({ userId: actorId, action: 'resident.create', entity: 'Resident', entityId: resident.id });
  return resident;
}

export async function update(id: string, input: UpdateResidentInput, actorId: string) {
  const existing = await prisma.resident.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Morador não encontrado');

  if (input.apartmentId && input.apartmentId !== existing.apartmentId) {
    await assertApartmentInTenant(input.apartmentId);
  }

  // Diff dos campos rastreados → registros de histórico.
  const historyEntries: Prisma.ResidentHistoryCreateManyInput[] = [];
  for (const field of TRACKED) {
    if (!(field in input)) continue;
    const oldVal = normalize((existing as Record<string, unknown>)[field]);
    const newVal = normalize((input as Record<string, unknown>)[field]);
    if (oldVal !== newVal) {
      historyEntries.push({ residentId: id, changedBy: actorId, field, oldValue: oldVal, newValue: newVal });
    }
  }

  const resident = await prisma.$transaction(async (tx) => {
    const updated = await tx.resident.update({
      where: { id },
      data: input,
      include: residentInclude,
    });
    if (historyEntries.length) {
      await tx.residentHistory.createMany({ data: historyEntries });
    }
    return updated;
  });

  await audit({
    userId: actorId,
    action: 'resident.update',
    entity: 'Resident',
    entityId: id,
    metadata: { changedFields: historyEntries.map((h) => h.field) },
  });
  return resident;
}

export async function setApproval(id: string, input: ApproveResidentInput, actorId: string) {
  const existing = await prisma.resident.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Morador não encontrado');
  if (existing.status !== 'PENDING') {
    throw AppError.business('Apenas cadastros pendentes podem ser aprovados ou rejeitados');
  }

  const status = input.approve ? 'APPROVED' : 'REJECTED';
  const resident = await prisma.resident.update({
    where: { id },
    data: { status },
    include: residentInclude,
  });

  await audit({
    userId: actorId,
    action: input.approve ? 'resident.approve' : 'resident.reject',
    entity: 'Resident',
    entityId: id,
    metadata: input.reason ? { reason: input.reason } : undefined,
  });
  return resident;
}

function normalize(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
