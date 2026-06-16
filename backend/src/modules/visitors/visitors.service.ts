import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { env } from '@/config/env';
import { putObject, storageEnabled } from '@/lib/storage';
import { logger } from '@/lib/logger';
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

const QR_GRACE_HOURS = 12; // tolerância após o horário previsto
const QR_DEFAULT_TTL_DAYS = 7; // validade quando não há horário previsto

export async function create(input: CreateVisitorInput, user: AuthUser) {
  const resident = await getResident(user.id);
  const qrCode = crypto.randomBytes(24).toString('base64url');

  // Validade do QR: até o horário previsto + tolerância, ou 7 dias se não informado.
  const expiresAt = input.expectedAt
    ? new Date(new Date(input.expectedAt).getTime() + QR_GRACE_HOURS * 60 * 60 * 1000)
    : new Date(Date.now() + QR_DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000);

  const visitor = await prisma.visitor.create({
    data: {
      ...input,
      residentId: resident.id,
      qrCode,
      expiresAt,
      status: 'EXPECTED',
    } as Prisma.VisitorUncheckedCreateInput,
    include,
  });

  await audit({ userId: user.id, action: 'visitor.create', entity: 'Visitor', entityId: visitor.id });
  // QR codifica uma URL de deep link (funciona no scanner do app e em câmeras externas).
  const accessUrl = `${env.WEB_URL.replace(/\/$/, '')}/portaria?code=${qrCode}`;
  const qrCodeDataUrl = await QRCode.toDataURL(accessUrl, { width: 320, margin: 1 });
  return { ...visitor, qrCodeDataUrl, accessUrl };
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

/** Valida o QR na portaria (porteiro/síndico). Aceita o token puro ou a URL completa. */
export async function validateQr(raw: string) {
  const qrCode = extractCode(raw);
  const visitor = await prisma.visitor.findFirst({ where: { qrCode }, include });
  if (!visitor) throw AppError.notFound('QR inválido');

  // QR expirado só bloqueia quem ainda não entrou (histórico continua consultável).
  if (visitor.status === 'EXPECTED' && visitor.expiresAt && visitor.expiresAt < new Date()) {
    throw AppError.business('QR expirado — peça ao morador para gerar um novo');
  }
  return visitor;
}

/** Extrai o token de um conteúdo de QR que pode ser o token puro ou uma URL `?code=`. */
function extractCode(raw: string): string {
  const value = raw.trim();
  if (value.includes('code=')) {
    try {
      return new URL(value).searchParams.get('code') ?? value;
    } catch {
      const m = value.match(/code=([^&\s]+)/);
      if (m) return m[1];
    }
  }
  return value;
}

export async function checkIn(id: string, user: AuthUser, photo?: string) {
  const visitor = await prisma.visitor.findFirst({ where: { id } });
  if (!visitor) throw AppError.notFound('Visitante não encontrado');
  if (visitor.status !== 'EXPECTED') {
    throw AppError.business('Visitante não está em estado de entrada esperada');
  }

  let photoUrl = visitor.photoUrl;
  if (photo) {
    photoUrl = await persistPhoto(user.condominiumId!, photo);
  }

  const updated = await prisma.visitor.update({
    where: { id },
    data: { status: 'CHECKED_IN', checkedInAt: new Date(), registeredBy: user.id, photoUrl },
    include,
  });
  await audit({ userId: user.id, action: 'visitor.checkin', entity: 'Visitor', entityId: id, metadata: { photo: !!photo } });
  await notifyResident(visitor.residentId, 'checkin', visitor.fullName);
  return updated;
}

/** Nega a entrada de um visitante esperado. */
export async function deny(id: string, user: AuthUser, reason?: string) {
  const visitor = await prisma.visitor.findFirst({ where: { id } });
  if (!visitor) throw AppError.notFound('Visitante não encontrado');
  if (visitor.status !== 'EXPECTED') {
    throw AppError.business('Só é possível negar um visitante que ainda não entrou');
  }
  const updated = await prisma.visitor.update({
    where: { id },
    data: { status: 'DENIED', registeredBy: user.id },
    include,
  });
  await audit({ userId: user.id, action: 'visitor.deny', entity: 'Visitor', entityId: id, metadata: reason ? { reason } : undefined });
  await notifyResident(visitor.residentId, 'deny', visitor.fullName);
  return updated;
}

/**
 * Notifica o morador dono do visitante sobre um evento na portaria.
 * Silencioso por design — não deve derrubar a operação da portaria.
 */
async function notifyResident(
  residentId: string,
  event: 'checkin' | 'checkout' | 'deny',
  visitorName: string,
): Promise<void> {
  try {
    const resident = await prisma.resident.findFirst({ where: { id: residentId }, select: { userId: true } });
    if (!resident?.userId) return;
    const text: Record<typeof event, { title: string; body: string }> = {
      checkin: { title: 'Visitante chegou', body: `${visitorName} registrou entrada na portaria.` },
      checkout: { title: 'Visitante saiu', body: `${visitorName} registrou saída.` },
      deny: { title: 'Visitante não autorizado', body: `A entrada de ${visitorName} foi negada na portaria.` },
    };
    await prisma.notification.create({
      // condominiumId injetado pela extensão de tenant (contexto do porteiro).
      data: {
        userId: resident.userId,
        type: 'VISITOR',
        title: text[event].title,
        body: text[event].body,
        linkUrl: '/visitantes',
      } as Prisma.NotificationUncheckedCreateInput,
    });
  } catch (err) {
    logger.warn({ err, residentId, event }, 'Falha ao notificar morador sobre visitante');
  }
}

/**
 * Persiste a foto do check-in. Com S3 configurado → faz upload e guarda a URL;
 * caso contrário (dev) → guarda o próprio data URL (já vem reduzido do cliente).
 */
async function persistPhoto(condominiumId: string, dataUrl: string): Promise<string> {
  const m = dataUrl.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/);
  if (!m) return dataUrl;
  if (!storageEnabled()) return dataUrl;
  try {
    const [, mime, ext, b64] = m;
    return await putObject({
      condominiumId,
      scope: 'visitors',
      fileName: `visitor.${ext.replace('jpeg', 'jpg')}`,
      contentType: mime,
      body: Buffer.from(b64, 'base64'),
    });
  } catch (err) {
    logger.warn({ err }, 'Falha no upload da foto do visitante — guardando data URL');
    return dataUrl;
  }
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
  await notifyResident(visitor.residentId, 'checkout', visitor.fullName);
  return updated;
}
