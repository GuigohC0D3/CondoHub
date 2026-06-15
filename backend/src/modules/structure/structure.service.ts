import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import type { CreateApartmentInput, ListApartmentsQuery, UpdateApartmentInput } from './structure.schemas';

// ---- Blocos ----
export async function listBlocks() {
  return prisma.block.findMany({ include: { _count: { select: { apartments: true } } }, orderBy: { name: 'asc' } });
}
export async function createBlock(name: string) {
  return prisma.block.create({ data: { name } as Prisma.BlockUncheckedCreateInput });
}
export async function updateBlock(id: string, name: string) {
  const b = await prisma.block.findFirst({ where: { id }, select: { id: true } });
  if (!b) throw AppError.notFound('Bloco não encontrado');
  return prisma.block.update({ where: { id }, data: { name } });
}
export async function removeBlock(id: string) {
  const b = await prisma.block.findFirst({ where: { id }, select: { id: true } });
  if (!b) throw AppError.notFound('Bloco não encontrado');
  await prisma.block.delete({ where: { id } });
}

// ---- Apartamentos ----
async function assertBlockInTenant(blockId: string) {
  const b = await prisma.block.findFirst({ where: { id: blockId }, select: { id: true } });
  if (!b) throw AppError.business('Bloco inexistente neste condomínio');
}

export async function listApartments(q: ListApartmentsQuery) {
  const where: Prisma.ApartmentWhereInput = { ...(q.blockId && { blockId: q.blockId }) };
  const [data, total] = await Promise.all([
    prisma.apartment.findMany({ where, include: { block: true, _count: { select: { residents: true } } }, orderBy: { number: 'asc' }, ...toSkipTake(q) }),
    prisma.apartment.count({ where }),
  ]);
  return paginate(data, total, q);
}

export async function createApartment(input: CreateApartmentInput) {
  if (input.blockId) await assertBlockInTenant(input.blockId);
  return prisma.apartment.create({ data: input as Prisma.ApartmentUncheckedCreateInput, include: { block: true } });
}

export async function updateApartment(id: string, input: UpdateApartmentInput) {
  const apt = await prisma.apartment.findFirst({ where: { id }, select: { id: true } });
  if (!apt) throw AppError.notFound('Apartamento não encontrado');
  if (input.blockId) await assertBlockInTenant(input.blockId);
  return prisma.apartment.update({ where: { id }, data: input, include: { block: true } });
}

export async function removeApartment(id: string) {
  const apt = await prisma.apartment.findFirst({ where: { id }, select: { id: true } });
  if (!apt) throw AppError.notFound('Apartamento não encontrado');
  await prisma.apartment.delete({ where: { id } });
}
