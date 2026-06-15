import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import type { AuthUser } from '@/types/express';
import type { CreateVisitorInput, ListVisitorsQuery } from './visitors.schemas';

const include = {
  resident: { select: { id: true, fullName: true, apartmentId: true } },
} satisfies Prisma.VisitorInclude;

async function getResident(userId: string) {
  const resident = await prisma.resident.findFirst({ where: { userId }, select: { id: true } });
  if (!resident) throw AppError.business('Usuário não está vinculado a um morador');
  return resident;
}

export async function create(input: CreateVisitorInput, user: AuthUser) {
  const resident = await getResident(user.id);
  const qrCode = crypto.randomBytes(24).toString('base64url');

  const visitor = await prisma.visitor.create({
    data: {
      ...input,
      residentId: resident.id,
      qrCode,
      status: 'EXPECTED',
    } as Prisma.VisitorUncheckedCreateInput,
    include,
  });

  await audit({ userId: user.id, action: 'visitor.create', entity: 'Visitor', entityId: visitor.id });
  const qrCodeDataUrl = await QRCode.toDataURL(qrCode);
  return { ...visitor, qrCodeDataUrl };
}

export async function list(query: ListVisitorsQuery, user: AuthUser) {
  const { status, search, page, limit } = query;
  const where: Prisma.VisitorWhereInput = {
    ...(status && { status }),
    ...(search && { fullName: { contains: search, mode: 'insensitive' } }),
  };
  if (user.role === 'MORADOR') {
    const resident = await prisma.resident.findFirst({ where: { userId: user.id }, select: { id: true } });
    where.residentId = resident?.id ?? '__none__';
  }

  const [data, total] = await Promise.all([
    prisma.visitor.findMany({ where, include, orderBy: { createdAt: 'desc' }, ...toSkipTake({ page, limit }) }),
    prisma.visitor.count({ where }),
  ]);
  return paginate(data, total, { page, limit });
}

export async function getById(id: string, user: AuthUser) {
  const visitor = await prisma.visitor.findFirst({ where: { id }, include });
  if (!visitor) throw AppError.notFound('Visitante não encontrado');
  if (user.role === 'MORADOR') {
    const resident = await prisma.resident.findFirst({ where: { userId: user.id }, select: { id: true } });
    if (visitor.residentId !== resident?.id) throw AppError.notFound('Visitante não encontrado');
  }
  return visitor;
}

/** Valida o QR na portaria (porteiro/síndico). */
export async function validateQr(qrCode: string) {
  const visitor = await prisma.visitor.findFirst({ where: { qrCode }, include });
  if (!visitor) throw AppError.notFound('QR inválido');
  return visitor;
}

export async function checkIn(id: string, user: AuthUser) {
  const visitor = await prisma.visitor.findFirst({ where: { id } });
  if (!visitor) throw AppError.notFound('Visitante não encontrado');
  if (visitor.status !== 'EXPECTED') {
    throw AppError.business('Visitante não está em estado de entrada esperada');
  }
  const updated = await prisma.visitor.update({
    where: { id },
    data: { status: 'CHECKED_IN', checkedInAt: new Date(), registeredBy: user.id },
    include,
  });
  await audit({ userId: user.id, action: 'visitor.checkin', entity: 'Visitor', entityId: id });
  return updated;
}

export async function checkOut(id: string, user: AuthUser) {
  const visitor = await prisma.visitor.findFirst({ where: { id } });
  if (!visitor) throw AppError.notFound('Visitante não encontrado');
  if (visitor.status !== 'CHECKED_IN') {
    throw AppError.business('Visitante não está com entrada registrada');
  }
  const updated = await prisma.visitor.update({
    where: { id },
    data: { status: 'CHECKED_OUT', checkedOutAt: new Date() },
    include,
  });
  await audit({ userId: user.id, action: 'visitor.checkout', entity: 'Visitor', entityId: id });
  return updated;
}
