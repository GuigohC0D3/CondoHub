import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import type { CreateApartmentInput, CreateBlockInput, ListApartmentsQuery, UpdateApartmentInput } from './structure.schemas';

// ---- Blocos ----
export async function listBlocks() {
  return prisma.block.findMany({ include: { _count: { select: { apartments: true } } }, orderBy: { name: 'asc' } });
}

/**
 * Cria o bloco e, opcionalmente, gera N apartamentos numerados por andar.
 * Numeração: `${andar}${unidade:2}` (ex.: 4 unidades/andar → 101,102,103,104,201...).
 */
export async function createBlock(input: CreateBlockInput) {
  const { name, apartmentCount = 0, unitsPerFloor = 4, startFloor = 1 } = input;
  return prisma.$transaction(async (tx) => {
    const block = await tx.block.create({ data: { name } as Prisma.BlockUncheckedCreateInput });
    if (apartmentCount > 0) {
      const apartments = Array.from({ length: apartmentCount }, (_, i) => {
        const floor = startFloor + Math.floor(i / unitsPerFloor);
        const unit = (i % unitsPerFloor) + 1;
        return { blockId: block.id, number: `${floor}${String(unit).padStart(2, '0')}`, floor };
      });
      // condominiumId é injetado pela extensão de tenant.
      await tx.apartment.createMany({ data: apartments as unknown as Prisma.ApartmentCreateManyInput[] });
    }
    return tx.block.findFirstOrThrow({ where: { id: block.id }, include: { _count: { select: { apartments: true } } } });
  });
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
