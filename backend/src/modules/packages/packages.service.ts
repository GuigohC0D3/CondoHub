import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import type { AuthUser } from '@/types/express';
import type { CreatePackageInput, ListPackagesQuery, PickupInput } from './packages.schemas';

const include = {
  apartment: { include: { block: true } },
  resident: { select: { id: true, fullName: true } },
} satisfies Prisma.PackageInclude;

/** Notifica os moradores (com login) do apartamento sobre a encomenda. */
async function notifyApartment(apartmentId: string, packageId: string): Promise<number> {
  const residents = await prisma.resident.findMany({
    where: { apartmentId, status: 'APPROVED', userId: { not: null } },
    select: { userId: true },
  });
  const userIds = residents.map((r) => r.userId).filter((id): id is string => !!id);
  if (!userIds.length) return 0;

  await prisma.notification.createMany({
    // condominiumId injetado pela extensão de tenant.
    data: userIds.map((userId) => ({
      userId,
      type: 'PACKAGE' as const,
      title: 'Encomenda recebida',
      body: 'Você tem uma encomenda na portaria',
      linkUrl: `/packages/${packageId}`,
    })) as Prisma.NotificationCreateManyInput[],
  });
  return userIds.length;
}

export async function create(input: CreatePackageInput, user: AuthUser) {
  const apt = await prisma.apartment.findFirst({ where: { id: input.apartmentId }, select: { id: true } });
  if (!apt) throw AppError.business('Apartamento inexistente neste condomínio');

  const pkg = await prisma.package.create({
    data: { ...input, status: 'RECEIVED', receivedBy: user.id } as Prisma.PackageUncheckedCreateInput,
    include,
  });

  let notified = 0;
  try {
    notified = await notifyApartment(input.apartmentId, pkg.id);
    if (notified > 0) {
      await prisma.package.update({ where: { id: pkg.id }, data: { status: 'NOTIFIED' } });
      pkg.status = 'NOTIFIED';
    }
  } catch (err) {
    logger.warn({ err, packageId: pkg.id }, 'Falha ao notificar encomenda');
  }

  await audit({ userId: user.id, action: 'package.create', entity: 'Package', entityId: pkg.id, metadata: { notified } });
  return pkg;
}

export async function list(query: ListPackagesQuery, user: AuthUser) {
  const { status, apartmentId, page, limit } = query;
  const where: Prisma.PackageWhereInput = {
    ...(status && { status }),
    ...(apartmentId && { apartmentId }),
  };
  if (user.role === 'MORADOR') {
    const resident = await prisma.resident.findFirst({ where: { userId: user.id }, select: { apartmentId: true } });
    where.apartmentId = resident?.apartmentId ?? '__none__';
  }

  const [data, total] = await Promise.all([
    prisma.package.findMany({ where, include, orderBy: { receivedAt: 'desc' }, ...toSkipTake({ page, limit }) }),
    prisma.package.count({ where }),
  ]);
  return paginate(data, total, { page, limit });
}

export async function getById(id: string, user: AuthUser) {
  const pkg = await prisma.package.findFirst({ where: { id }, include });
  if (!pkg) throw AppError.notFound('Encomenda não encontrada');
  if (user.role === 'MORADOR') {
    const resident = await prisma.resident.findFirst({ where: { userId: user.id }, select: { apartmentId: true } });
    if (pkg.apartmentId !== resident?.apartmentId) throw AppError.notFound('Encomenda não encontrada');
  }
  return pkg;
}

export async function pickup(id: string, input: PickupInput, user: AuthUser) {
  const pkg = await prisma.package.findFirst({ where: { id } });
  if (!pkg) throw AppError.notFound('Encomenda não encontrada');
  if (pkg.status === 'PICKED_UP') throw AppError.business('Encomenda já retirada');

  const updated = await prisma.package.update({
    where: { id },
    data: { status: 'PICKED_UP', pickedUpAt: new Date(), pickedUpBy: input.pickedUpBy },
    include,
  });
  await audit({ userId: user.id, action: 'package.pickup', entity: 'Package', entityId: id });
  return updated;
}
