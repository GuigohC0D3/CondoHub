import { Prisma, Reservation, ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import {
  dayKeyInZone,
  hhmmToMinutes,
  minutesOfDayInZone,
  monthKeyInZone,
} from '@/utils/datetime';
import type { AuthUser } from '@/types/express';
import type {
  ApproveReservationInput,
  CreateReservationInput,
  ListReservationsQuery,
} from './reservations.schemas';

// Status que ocupam um horário (bloqueiam conflito e contam no limite mensal).
const ACTIVE_STATUSES: ReservationStatus[] = ['PENDING', 'APPROVED'];

const reservationInclude = {
  commonArea: { select: { id: true, name: true } },
  resident: { select: { id: true, fullName: true, apartmentId: true } },
} satisfies Prisma.ReservationInclude;

async function getCondoTimezone(condominiumId: string): Promise<string> {
  const condo = await prisma.condominium.findUnique({
    where: { id: condominiumId },
    select: { timezone: true },
  });
  return condo?.timezone ?? 'America/Sao_Paulo';
}

/** Resolve o morador (aprovado) vinculado ao usuário logado. */
async function getApprovedResident(userId: string) {
  const resident = await prisma.resident.findFirst({ where: { userId } });
  if (!resident) throw AppError.business('Usuário não está vinculado a um morador');
  if (resident.status !== 'APPROVED') {
    throw AppError.business('Cadastro de morador ainda não aprovado');
  }
  return resident;
}

/** Valida que a reserva cabe na janela diária da área (no fuso do condomínio). */
function assertWithinWindow(
  area: { openTime: string; closeTime: string },
  startsAt: Date,
  endsAt: Date,
  tz: string,
): void {
  if (dayKeyInZone(startsAt, tz) !== dayKeyInZone(endsAt, tz)) {
    throw AppError.business('A reserva deve começar e terminar no mesmo dia');
  }
  const start = minutesOfDayInZone(startsAt, tz);
  const end = minutesOfDayInZone(endsAt, tz);
  const open = hhmmToMinutes(area.openTime);
  const close = hhmmToMinutes(area.closeTime);
  if (start < open || end > close) {
    throw AppError.business(`Fora do horário de funcionamento (${area.openTime}–${area.closeTime})`);
  }
}

export async function create(input: CreateReservationInput, user: AuthUser): Promise<Reservation> {
  const { commonAreaId, startsAt, endsAt, notes } = input;
  const resident = await getApprovedResident(user.id);

  const area = await prisma.commonArea.findFirst({ where: { id: commonAreaId } });
  if (!area || !area.isActive) throw AppError.business('Área comum indisponível');

  const tz = await getCondoTimezone(user.condominiumId!);
  assertWithinWindow(area, startsAt, endsAt, tz);

  const status: ReservationStatus = area.approvalMode === 'AUTOMATIC' ? 'APPROVED' : 'PENDING';

  try {
    const reservation = await prisma.$transaction(
      async (tx) => {
        // 1. Conflito de horário (sobreposição com reservas ativas na mesma área).
        const overlap = await tx.reservation.findFirst({
          where: {
            commonAreaId,
            status: { in: ACTIVE_STATUSES },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { id: true },
        });
        if (overlap) throw AppError.conflict('Horário já reservado para esta área');

        // 2. Limite mensal por morador (no mês da data de início, no fuso do condo).
        const monthKey = monthKeyInZone(startsAt, tz);
        const sameAreaActive = await tx.reservation.findMany({
          where: { commonAreaId, residentId: resident.id, status: { in: ACTIVE_STATUSES } },
          select: { startsAt: true },
        });
        const usedThisMonth = sameAreaActive.filter(
          (r) => monthKeyInZone(r.startsAt, tz) === monthKey,
        ).length;
        if (usedThisMonth >= area.maxPerMonthPerResident) {
          throw AppError.business(
            `Limite de ${area.maxPerMonthPerResident} reserva(s)/mês atingido para esta área`,
          );
        }

        return tx.reservation.create({
          data: {
            commonAreaId,
            residentId: resident.id,
            startsAt,
            endsAt,
            notes,
            status,
          } as Prisma.ReservationUncheckedCreateInput,
          include: reservationInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await audit({
      userId: user.id,
      action: 'reservation.create',
      entity: 'Reservation',
      entityId: reservation.id,
      metadata: { status, commonAreaId },
    });
    return reservation;
  } catch (err) {
    // Falha de serialização (corrida com outra reserva concorrente) → conflito.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      throw AppError.conflict('Horário já reservado para esta área');
    }
    throw err;
  }
}

export async function list(query: ListReservationsQuery, user: AuthUser) {
  const { commonAreaId, status, from, to, page, limit } = query;

  const where: Prisma.ReservationWhereInput = {
    ...(commonAreaId && { commonAreaId }),
    ...(status && { status }),
    ...((from || to) && { startsAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
  };

  // Morador só enxerga as próprias reservas.
  if (user.role === 'MORADOR') {
    const resident = await prisma.resident.findFirst({ where: { userId: user.id }, select: { id: true } });
    where.residentId = resident?.id ?? '__none__';
  }

  const [data, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: reservationInclude,
      orderBy: { startsAt: 'desc' },
      ...toSkipTake({ page, limit }),
    }),
    prisma.reservation.count({ where }),
  ]);
  return paginate(data, total, { page, limit });
}

export async function getById(id: string, user: AuthUser) {
  const reservation = await prisma.reservation.findFirst({ where: { id }, include: reservationInclude });
  if (!reservation) throw AppError.notFound('Reserva não encontrada');
  if (user.role === 'MORADOR') {
    const resident = await prisma.resident.findFirst({ where: { userId: user.id }, select: { id: true } });
    if (reservation.residentId !== resident?.id) throw AppError.notFound('Reserva não encontrada');
  }
  return reservation;
}

export async function setApproval(id: string, input: ApproveReservationInput, user: AuthUser) {
  const reservation = await prisma.reservation.findFirst({ where: { id } });
  if (!reservation) throw AppError.notFound('Reserva não encontrada');
  if (reservation.status !== 'PENDING') {
    throw AppError.business('Apenas reservas pendentes podem ser aprovadas ou rejeitadas');
  }

  if (input.approve) {
    // Revalida conflito contra reservas já APROVADAS (excluindo a própria).
    const overlap = await prisma.reservation.findFirst({
      where: {
        id: { not: id },
        commonAreaId: reservation.commonAreaId,
        status: 'APPROVED',
        startsAt: { lt: reservation.endsAt },
        endsAt: { gt: reservation.startsAt },
      },
      select: { id: true },
    });
    if (overlap) throw AppError.conflict('Conflito com outra reserva já aprovada');
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: { status: input.approve ? 'APPROVED' : 'REJECTED' },
    include: reservationInclude,
  });
  await audit({
    userId: user.id,
    action: input.approve ? 'reservation.approve' : 'reservation.reject',
    entity: 'Reservation',
    entityId: id,
    metadata: input.reason ? { reason: input.reason } : undefined,
  });
  return updated;
}

export async function cancel(id: string, user: AuthUser) {
  const reservation = await prisma.reservation.findFirst({ where: { id } });
  if (!reservation) throw AppError.notFound('Reserva não encontrada');

  if (user.role === 'MORADOR') {
    const resident = await prisma.resident.findFirst({ where: { userId: user.id }, select: { id: true } });
    if (reservation.residentId !== resident?.id) throw AppError.notFound('Reserva não encontrada');
  }
  if (reservation.status === 'CANCELED' || reservation.status === 'REJECTED') {
    throw AppError.business('Reserva não pode ser cancelada');
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: { status: 'CANCELED', canceledAt: new Date() },
    include: reservationInclude,
  });
  await audit({ userId: user.id, action: 'reservation.cancel', entity: 'Reservation', entityId: id });
  return updated;
}
