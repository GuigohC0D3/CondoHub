import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { enqueue } from '@/lib/queue';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import type { AuthUser } from '@/types/express';
import type { CreateNoticeInput, ListNoticesQuery, UpdateNoticeInput } from './notices.schemas';

const baseInclude = {
  author: { select: { id: true, name: true } },
  attachments: true,
  _count: { select: { reads: true } },
} satisfies Prisma.NoticeInclude;

/** Anexa a flag isRead (para o usuário atual) a uma lista de avisos. */
async function withReadFlag<T extends { id: string }>(notices: T[], userId: string) {
  if (!notices.length) return notices.map((n) => ({ ...n, isRead: false }));
  const reads = await prisma.noticeRead.findMany({
    where: { userId, noticeId: { in: notices.map((n) => n.id) } },
    select: { noticeId: true },
  });
  const readSet = new Set(reads.map((r) => r.noticeId));
  return notices.map((n) => ({ ...n, isRead: readSet.has(n.id) }));
}

export async function list(query: ListNoticesQuery, user: AuthUser) {
  const { pinned, includeExpired, page, limit } = query;
  const now = new Date();

  const where: Prisma.NoticeWhereInput = {
    ...(pinned && { isPinned: pinned === 'true' }),
    // Moradores nunca veem avisos expirados; síndico pode optar por incluir.
    ...(!(user.role === 'SINDICO' && includeExpired === 'true') && {
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    }),
    // Não exibe avisos agendados para o futuro.
    publishedAt: { lte: now },
  };

  const [rows, total] = await Promise.all([
    prisma.notice.findMany({
      where,
      include: baseInclude,
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      ...toSkipTake({ page, limit }),
    }),
    prisma.notice.count({ where }),
  ]);

  const data = await withReadFlag(rows, user.id);
  return paginate(data, total, { page, limit });
}

export async function getById(id: string, user: AuthUser) {
  const notice = await prisma.notice.findFirst({ where: { id }, include: baseInclude });
  if (!notice) throw AppError.notFound('Aviso não encontrado');
  const [withFlag] = await withReadFlag([notice], user.id);
  return withFlag;
}

export async function create(input: CreateNoticeInput, user: AuthUser) {
  const { attachments, ...data } = input;
  const notice = await prisma.notice.create({
    data: {
      ...data,
      authorId: user.id,
      ...(attachments?.length && { attachments: { create: attachments } }),
    } as Prisma.NoticeUncheckedCreateInput,
    include: baseInclude,
  });

  // Fan-out de notificações vai para a fila (assíncrono).
  try {
    await enqueue('notice.fanout', {
      condominiumId: user.condominiumId!,
      noticeId: notice.id,
      title: notice.title,
    });
  } catch (err) {
    logger.warn({ err, noticeId: notice.id }, 'Falha ao enfileirar fan-out do aviso');
  }

  await audit({ userId: user.id, action: 'notice.create', entity: 'Notice', entityId: notice.id });
  return { ...notice, isRead: false };
}

export async function update(id: string, input: UpdateNoticeInput, user: AuthUser) {
  const existing = await prisma.notice.findFirst({ where: { id }, select: { id: true } });
  if (!existing) throw AppError.notFound('Aviso não encontrado');

  const notice = await prisma.notice.update({ where: { id }, data: input, include: baseInclude });
  await audit({ userId: user.id, action: 'notice.update', entity: 'Notice', entityId: id });
  return notice;
}

export async function remove(id: string, user: AuthUser) {
  const existing = await prisma.notice.findFirst({ where: { id }, select: { id: true } });
  if (!existing) throw AppError.notFound('Aviso não encontrado');
  await prisma.notice.delete({ where: { id } }); // cascade: attachments + reads
  await audit({ userId: user.id, action: 'notice.delete', entity: 'Notice', entityId: id });
}

export async function markRead(id: string, user: AuthUser) {
  const notice = await prisma.notice.findFirst({ where: { id }, select: { id: true } });
  if (!notice) throw AppError.notFound('Aviso não encontrado');

  // Idempotente: marcar como lido múltiplas vezes não duplica.
  await prisma.noticeRead.upsert({
    where: { noticeId_userId: { noticeId: id, userId: user.id } },
    update: {},
    create: { noticeId: id, userId: user.id },
  });
  return { isRead: true };
}
