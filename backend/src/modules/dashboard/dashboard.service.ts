import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { cashflow } from '@/modules/finance/finance.service';

const CACHE_TTL = 60; // segundos

export async function getDashboard(condominiumId: string) {
  const cacheKey = `dashboard:${condominiumId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    logger.warn({ err }, 'Falha ao ler cache do dashboard');
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [
    residentsCount,
    pendingResidents,
    openTickets,
    pendingPackages,
    upcomingReservations,
    recentNotices,
    monthExpense,
    monthRevenue,
    ticketsByStatus,
    yearCashflow,
  ] = await Promise.all([
    prisma.resident.count({ where: { status: 'APPROVED' } }),
    prisma.resident.count({ where: { status: 'PENDING' } }),
    prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.package.count({ where: { status: { in: ['RECEIVED', 'NOTIFIED'] } } }),
    prisma.reservation.findMany({
      where: { status: 'APPROVED', startsAt: { gte: now } },
      include: { commonArea: { select: { name: true } }, resident: { select: { fullName: true } } },
      orderBy: { startsAt: 'asc' },
      take: 5,
    }),
    prisma.notice.findMany({
      where: { publishedAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 5,
      select: { id: true, title: true, isPinned: true, publishedAt: true },
    }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { dueDate: { gte: monthStart, lt: monthEnd } } }),
    prisma.revenue.aggregate({ _sum: { amount: true }, where: { receivedAt: { gte: monthStart, lt: monthEnd } } }),
    prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
    cashflow(now.getUTCFullYear()),
  ]);

  const result = {
    kpis: {
      residents: residentsCount,
      pendingResidents,
      openTickets,
      pendingPackages,
      monthExpense: Number(monthExpense._sum.amount ?? 0),
      monthRevenue: Number(monthRevenue._sum.amount ?? 0),
      monthBalance: Number(monthRevenue._sum.amount ?? 0) - Number(monthExpense._sum.amount ?? 0),
    },
    upcomingReservations,
    recentNotices,
    ticketsByStatus: ticketsByStatus.map((t) => ({ status: t.status, count: t._count._all })),
    cashflow: yearCashflow,
    generatedAt: now.toISOString(),
  };

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
  } catch (err) {
    logger.warn({ err }, 'Falha ao gravar cache do dashboard');
  }
  return result;
}
