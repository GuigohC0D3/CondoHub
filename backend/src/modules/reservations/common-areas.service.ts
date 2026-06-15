import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/errors';
import type { CreateCommonAreaInput, UpdateCommonAreaInput } from './common-areas.schemas';

export async function list(includeInactive: boolean) {
  return prisma.commonArea.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function getById(id: string) {
  const area = await prisma.commonArea.findFirst({ where: { id } });
  if (!area) throw AppError.notFound('Área comum não encontrada');
  return area;
}

export async function create(input: CreateCommonAreaInput, actorId: string) {
  const data = {
    ...input,
    feeAmount: input.feeAmount != null ? new Prisma.Decimal(input.feeAmount) : null,
  } satisfies Omit<Prisma.CommonAreaUncheckedCreateInput, 'condominiumId'>;

  const area = await prisma.commonArea.create({
    data: data as Prisma.CommonAreaUncheckedCreateInput,
  });
  await audit({ userId: actorId, action: 'commonArea.create', entity: 'CommonArea', entityId: area.id });
  return area;
}

export async function update(id: string, input: UpdateCommonAreaInput, actorId: string) {
  await getById(id); // garante existência no tenant

  const { feeAmount, ...rest } = input;
  const area = await prisma.commonArea.update({
    where: { id },
    data: {
      ...rest,
      ...(feeAmount !== undefined && {
        feeAmount: feeAmount === null ? null : new Prisma.Decimal(feeAmount),
      }),
    },
  });
  await audit({ userId: actorId, action: 'commonArea.update', entity: 'CommonArea', entityId: id });
  return area;
}
