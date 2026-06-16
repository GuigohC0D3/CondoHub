import { Prisma, Ticket, TicketStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import type { AuthUser } from '@/types/express';
import type {
  AttachmentInput,
  CommentInput,
  CreateTicketInput,
  ListTicketsQuery,
  UpdateTicketInput,
} from './tickets.schemas';

const STATUS_DONE: TicketStatus[] = ['RESOLVED', 'CLOSED'];

const listInclude = {
  resident: { select: { id: true, fullName: true, apartmentId: true } },
  assignee: { select: { id: true, name: true, role: true } },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.TicketInclude;

const detailInclude = {
  resident: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      apartment: { select: { number: true, block: { select: { name: true } } } },
    },
  },
  assignee: { select: { id: true, name: true, role: true } },
  comments: {
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, name: true, role: true } } },
  },
  attachments: true,
} satisfies Prisma.TicketInclude;

/** Morador vinculado ao usuário (necessário para abrir/comentar nos próprios chamados). */
async function getResident(userId: string) {
  const resident = await prisma.resident.findFirst({ where: { userId }, select: { id: true } });
  if (!resident) throw AppError.business('Usuário não está vinculado a um morador');
  return resident;
}

/** Carrega o chamado e aplica escopo de acesso (morador só os próprios). */
async function loadAccessible(id: string, user: AuthUser, include: Prisma.TicketInclude) {
  const ticket = await prisma.ticket.findFirst({ where: { id }, include });
  if (!ticket) throw AppError.notFound('Chamado não encontrado');
  if (user.role === 'MORADOR') {
    const resident = await prisma.resident.findFirst({ where: { userId: user.id }, select: { id: true } });
    if ((ticket as { residentId: string }).residentId !== resident?.id) {
      throw AppError.notFound('Chamado não encontrado');
    }
  }
  return ticket;
}

export async function list(query: ListTicketsQuery, user: AuthUser) {
  const { status, priority, category, assigneeId, search, page, limit } = query;
  const where: Prisma.TicketWhereInput = {
    ...(status && { status }),
    ...(priority && { priority }),
    ...(category && { category }),
    ...(assigneeId && { assigneeId }),
    ...(search && { title: { contains: search, mode: 'insensitive' } }),
  };

  if (user.role === 'MORADOR') {
    const resident = await prisma.resident.findFirst({ where: { userId: user.id }, select: { id: true } });
    where.residentId = resident?.id ?? '__none__';
  }

  const [data, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: listInclude,
      // Urgentes primeiro, depois mais recentes.
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      ...toSkipTake({ page, limit }),
    }),
    prisma.ticket.count({ where }),
  ]);
  return paginate(data, total, { page, limit });
}

export async function getById(id: string, user: AuthUser) {
  return loadAccessible(id, user, detailInclude);
}

export async function create(input: CreateTicketInput, user: AuthUser): Promise<Ticket> {
  const resident = await getResident(user.id);
  const ticket = await prisma.ticket.create({
    data: {
      ...input,
      residentId: resident.id,
      status: 'OPEN',
    } as Prisma.TicketUncheckedCreateInput,
    include: detailInclude,
  });
  await audit({ userId: user.id, action: 'ticket.create', entity: 'Ticket', entityId: ticket.id });
  return ticket;
}

export async function update(id: string, input: UpdateTicketInput, user: AuthUser) {
  const existing = await prisma.ticket.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Chamado não encontrado');

  // Valida responsável: deve ser síndico ou porteiro do mesmo condomínio.
  if (input.assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: { id: input.assigneeId, role: { in: ['SINDICO', 'PORTEIRO'] } },
      select: { id: true },
    });
    if (!assignee) throw AppError.business('Responsável inválido para este condomínio');
  }

  const data: Prisma.TicketUncheckedUpdateInput = { ...input };
  // Gerencia resolvedAt conforme o status.
  if (input.status) {
    if (STATUS_DONE.includes(input.status) && !existing.resolvedAt) {
      data.resolvedAt = new Date();
    } else if (!STATUS_DONE.includes(input.status)) {
      data.resolvedAt = null;
    }
  }

  const ticket = await prisma.ticket.update({ where: { id }, data, include: detailInclude });
  await audit({
    userId: user.id,
    action: 'ticket.update',
    entity: 'Ticket',
    entityId: id,
    metadata: {
      ...(input.status && { status: { from: existing.status, to: input.status } }),
      ...(input.priority && { priority: { from: existing.priority, to: input.priority } }),
      ...(input.assigneeId !== undefined && { assignee: input.assigneeId }),
    },
  });
  return ticket;
}

export async function addComment(id: string, input: CommentInput, user: AuthUser) {
  await loadAccessible(id, user, {}); // valida acesso
  const comment = await prisma.ticketComment.create({
    data: { ticketId: id, authorId: user.id, body: input.body },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
  await audit({ userId: user.id, action: 'ticket.comment', entity: 'Ticket', entityId: id });
  return comment;
}

export async function addAttachment(id: string, input: AttachmentInput, user: AuthUser) {
  await loadAccessible(id, user, {}); // valida acesso
  const attachment = await prisma.ticketAttachment.create({
    data: { ticketId: id, ...input },
  });
  await audit({ userId: user.id, action: 'ticket.attachment', entity: 'Ticket', entityId: id });
  return attachment;
}
