import { Prisma, PlanTier } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { hashPassword } from '@/modules/auth/auth.service';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import type { AuthUser } from '@/types/express';
import type { CreateCondominiumInput, ListQuery, UpdateSubscriptionInput } from './admin.schemas';

// Configuração de planos (limite de unidades + preço mensal).
export const PLANS: Record<PlanTier, { maxUnits: number; price: number }> = {
  FREE: { maxUnits: 10, price: 0 },
  BASICO: { maxUnits: 30, price: 99 },
  PROFISSIONAL: { maxUnits: 100, price: 249 },
  ENTERPRISE: { maxUnits: 100_000, price: 0 }, // sob consulta
};

export async function createCondominium(input: CreateCondominiumInput, actor: AuthUser) {
  const plan = PLANS[input.plan];
  const passwordHash = await hashPassword(input.sindico.password);

  const condo = await prisma.$transaction(async (tx) => {
    const created = await tx.condominium.create({
      data: {
        name: input.name,
        slug: input.slug,
        cnpj: input.cnpj,
        city: input.city,
        state: input.state,
        subscription: {
          create: {
            plan: input.plan,
            status: 'TRIALING',
            maxUnits: plan.maxUnits,
            pricePerMonth: new Prisma.Decimal(plan.price),
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: { subscription: true },
    });

    await tx.user.create({
      data: {
        name: input.sindico.name,
        email: input.sindico.email,
        passwordHash,
        role: 'SINDICO',
        condominiumId: created.id,
      },
    });
    return created;
  });

  await audit({ userId: actor.id, action: 'admin.condominium.create', entity: 'Condominium', entityId: condo.id });
  return condo;
}

export async function listCondominiums(q: ListQuery) {
  const where: Prisma.CondominiumWhereInput = q.search
    ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { slug: { contains: q.search } }] }
    : {};
  const [data, total] = await Promise.all([
    prisma.condominium.findMany({
      where,
      include: { subscription: true, _count: { select: { users: true, apartments: true } } },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(q),
    }),
    prisma.condominium.count({ where }),
  ]);
  return paginate(data, total, q);
}

export async function getCondominium(id: string) {
  const condo = await prisma.condominium.findUnique({
    where: { id },
    include: {
      subscription: { include: { payments: { orderBy: { dueDate: 'desc' }, take: 12 } } },
      _count: { select: { users: true, apartments: true, residents: true } },
    },
  });
  if (!condo) throw AppError.notFound('Condomínio não encontrado');
  return condo;
}

export async function setBlocked(id: string, blocked: boolean, actor: AuthUser, reason?: string) {
  const condo = await prisma.condominium.findUnique({ where: { id }, select: { id: true } });
  if (!condo) throw AppError.notFound('Condomínio não encontrado');

  const [updated] = await prisma.$transaction([
    prisma.condominium.update({ where: { id }, data: { isActive: !blocked } }),
    prisma.subscription.update({
      where: { condominiumId: id },
      data: { status: blocked ? 'BLOCKED' : 'ACTIVE' },
    }),
  ]);

  await audit({
    userId: actor.id,
    action: blocked ? 'admin.condominium.block' : 'admin.condominium.unblock',
    entity: 'Condominium',
    entityId: id,
    metadata: reason ? { reason } : undefined,
  });
  return updated;
}

export async function updateSubscription(id: string, input: UpdateSubscriptionInput, actor: AuthUser) {
  const sub = await prisma.subscription.findUnique({ where: { id }, select: { id: true } });
  if (!sub) throw AppError.notFound('Assinatura não encontrada');

  const data: Prisma.SubscriptionUpdateInput = { ...input };
  if (input.plan) {
    data.maxUnits = PLANS[input.plan].maxUnits;
    data.pricePerMonth = new Prisma.Decimal(PLANS[input.plan].price);
  }
  const updated = await prisma.subscription.update({ where: { id }, data });
  await audit({ userId: actor.id, action: 'admin.subscription.update', entity: 'Subscription', entityId: id });
  return updated;
}

export async function globalMetrics() {
  const [totalCondos, activeCondos, byPlan, activeSubs, totalUsers, mrrAgg] = await Promise.all([
    prisma.condominium.count(),
    prisma.condominium.count({ where: { isActive: true } }),
    prisma.subscription.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count(),
    prisma.subscription.aggregate({ _sum: { pricePerMonth: true }, where: { status: 'ACTIVE' } }),
  ]);

  const mrr = Number(mrrAgg._sum.pricePerMonth ?? 0);
  return {
    condominiums: { total: totalCondos, active: activeCondos, blocked: totalCondos - activeCondos },
    subscriptions: { active: activeSubs, byPlan: byPlan.map((p) => ({ plan: p.plan, count: p._count._all })) },
    users: totalUsers,
    mrr,
    arr: mrr * 12,
  };
}
