import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import type { AuthUser } from '@/types/express';
import type {
  CreateSuggestionInput,
  ListSuggestionsQuery,
  SetStatusInput,
  UpdateSuggestionInput,
} from './suggestions.schemas';

const listInclude = {
  resident: { select: { id: true, fullName: true, apartment: { select: { number: true, block: { select: { name: true } } } } } },
  _count: { select: { votes: true } },
} satisfies Prisma.SuggestionInclude;

/** Resolve o morador vinculado ao usuário; sugestões são sempre de moradores. */
async function getResident(userId: string) {
  const resident = await prisma.resident.findFirst({ where: { userId }, select: { id: true } });
  if (!resident) throw AppError.business('Usuário não está vinculado a um morador');
  return resident;
}

/** Decora as sugestões com hasVoted e isAuthor para o morador atual. */
async function decorate<T extends { id: string; residentId: string }>(rows: T[], residentId: string | null) {
  if (!residentId || rows.length === 0) return rows.map((r) => ({ ...r, hasVoted: false, isAuthor: false }));
  const votes = await prisma.suggestionVote.findMany({
    where: { residentId, suggestionId: { in: rows.map((r) => r.id) } },
    select: { suggestionId: true },
  });
  const voted = new Set(votes.map((v) => v.suggestionId));
  return rows.map((r) => ({ ...r, hasVoted: voted.has(r.id), isAuthor: r.residentId === residentId }));
}

async function currentResidentId(user: AuthUser): Promise<string | null> {
  if (user.role !== 'MORADOR') return null;
  const r = await prisma.resident.findFirst({ where: { userId: user.id }, select: { id: true } });
  return r?.id ?? null;
}

export async function list(q: ListSuggestionsQuery, user: AuthUser) {
  const residentId = await currentResidentId(user);
  const where: Prisma.SuggestionWhereInput = {
    ...(q.status && { status: q.status }),
    ...(q.category && { category: q.category }),
    ...(q.mine && { residentId: residentId ?? '__none__' }),
  };
  const orderBy: Prisma.SuggestionOrderByWithRelationInput =
    q.sort === 'recent' ? { createdAt: 'desc' } : { votes: { _count: 'desc' } };

  const [rows, total] = await Promise.all([
    prisma.suggestion.findMany({ where, include: listInclude, orderBy, ...toSkipTake(q) }),
    prisma.suggestion.count({ where }),
  ]);
  return paginate(await decorate(rows, residentId), total, q);
}

export async function getById(id: string, user: AuthUser) {
  const suggestion = await prisma.suggestion.findFirst({ where: { id }, include: listInclude });
  if (!suggestion) throw AppError.notFound('Sugestão não encontrada');
  const residentId = await currentResidentId(user);
  const [withVote] = await decorate([suggestion], residentId);
  return withVote;
}

export async function create(input: CreateSuggestionInput, user: AuthUser) {
  const resident = await getResident(user.id);
  const suggestion = await prisma.suggestion.create({
    data: { ...input, residentId: resident.id, status: 'OPEN' } as Prisma.SuggestionUncheckedCreateInput,
    include: listInclude,
  });
  await audit({ userId: user.id, action: 'suggestion.create', entity: 'Suggestion', entityId: suggestion.id });
  return { ...suggestion, hasVoted: false, isAuthor: true };
}

export async function update(id: string, input: UpdateSuggestionInput, user: AuthUser) {
  const resident = await getResident(user.id);
  const existing = await prisma.suggestion.findFirst({ where: { id }, select: { residentId: true, status: true } });
  if (!existing) throw AppError.notFound('Sugestão não encontrada');
  if (existing.residentId !== resident.id) throw AppError.forbidden('Só o autor pode editar a sugestão');
  if (existing.status !== 'OPEN') throw AppError.business('Sugestão em análise não pode mais ser editada');

  const suggestion = await prisma.suggestion.update({ where: { id }, data: input, include: listInclude });
  await audit({ userId: user.id, action: 'suggestion.update', entity: 'Suggestion', entityId: id });
  return suggestion;
}

export async function remove(id: string, user: AuthUser) {
  const existing = await prisma.suggestion.findFirst({ where: { id }, select: { residentId: true, status: true } });
  if (!existing) throw AppError.notFound('Sugestão não encontrada');

  // Autor remove a própria enquanto OPEN; síndico remove qualquer uma.
  if (user.role !== 'SINDICO') {
    const resident = await getResident(user.id);
    if (existing.residentId !== resident.id) throw AppError.forbidden('Sem permissão para remover');
    if (existing.status !== 'OPEN') throw AppError.business('Sugestão em análise não pode ser removida pelo autor');
  }
  await prisma.suggestion.delete({ where: { id } });
  await audit({ userId: user.id, action: 'suggestion.delete', entity: 'Suggestion', entityId: id });
}

/** Alterna o voto do morador (apoia/retira apoio). Retorna estado e total. */
export async function toggleVote(id: string, user: AuthUser) {
  const resident = await getResident(user.id);
  const suggestion = await prisma.suggestion.findFirst({ where: { id }, select: { id: true } });
  if (!suggestion) throw AppError.notFound('Sugestão não encontrada');

  const existing = await prisma.suggestionVote.findUnique({
    where: { suggestionId_residentId: { suggestionId: id, residentId: resident.id } },
    select: { id: true },
  });

  if (existing) {
    await prisma.suggestionVote.delete({ where: { id: existing.id } });
  } else {
    await prisma.suggestionVote.create({ data: { suggestionId: id, residentId: resident.id } });
  }
  const voteCount = await prisma.suggestionVote.count({ where: { suggestionId: id } });
  return { hasVoted: !existing, voteCount };
}

/** Síndico move o status e (opcional) registra a resposta oficial; notifica o autor. */
export async function setStatus(id: string, input: SetStatusInput, user: AuthUser) {
  const existing = await prisma.suggestion.findFirst({ where: { id }, select: { residentId: true } });
  if (!existing) throw AppError.notFound('Sugestão não encontrada');

  const suggestion = await prisma.suggestion.update({
    where: { id },
    data: {
      status: input.status,
      ...(input.message !== undefined && { responseMessage: input.message || null }),
      respondedAt: new Date(),
    },
    include: listInclude,
  });
  await audit({ userId: user.id, action: 'suggestion.status', entity: 'Suggestion', entityId: id, metadata: { status: input.status } });
  await notifyAuthor(existing.residentId, suggestion.title, input.status, input.message);
  return suggestion;
}

const STATUS_LABEL: Record<SetStatusInput['status'], string> = {
  OPEN: 'reaberta',
  UNDER_REVIEW: 'em análise',
  PLANNED: 'aprovada/planejada',
  DONE: 'concluída',
  REJECTED: 'recusada',
};

async function notifyAuthor(residentId: string, title: string, status: SetStatusInput['status'], message?: string) {
  try {
    const resident = await prisma.resident.findFirst({ where: { id: residentId }, select: { userId: true } });
    if (!resident?.userId) return;
    let body = `Sua sugestão "${title}" foi marcada como ${STATUS_LABEL[status]}.`;
    if (message) body += ` Resposta da administração: "${message}"`;
    await prisma.notification.create({
      data: {
        userId: resident.userId,
        type: 'SYSTEM',
        title: 'Atualização na sua sugestão',
        body,
        linkUrl: '/sugestoes',
      } as Prisma.NotificationUncheckedCreateInput,
    });
  } catch (err) {
    logger.warn({ err, residentId }, 'Falha ao notificar autor da sugestão');
  }
}
