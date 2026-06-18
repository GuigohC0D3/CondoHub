import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import { paymentGateway } from '@/lib/gateway';
import type {
  CreateChargeInput,
  GatewayCustomer,
  GatewayWebhookEvent,
} from '@/lib/gateway';
import type { AuthUser } from '@/types/express';
import type {
  CreateBatchInput,
  CreateChargeInput as CreateChargeBody,
  ListChargesQuery,
} from './charges.schemas';

const dec = (n: number) => new Prisma.Decimal(n);
const num = (d: Prisma.Decimal) => Number(d);

const chargeInclude = {
  apartment: { select: { id: true, number: true, block: { select: { name: true } } } },
  resident: { select: { id: true, fullName: true } },
} satisfies Prisma.ChargeInclude;

// ---- Helpers ----

/** Resolve o pagador da unidade: residentId informado ou primeiro morador cadastrado. */
async function resolvePayer(apartmentId: string, residentId?: string) {
  if (residentId) {
    const resident = await prisma.resident.findFirst({
      where: { id: residentId, apartmentId },
      select: { id: true, fullName: true, cpf: true, email: true, phone: true },
    });
    if (!resident) throw AppError.business('Morador não pertence à unidade informada');
    return resident;
  }
  return prisma.resident.findFirst({
    where: { apartmentId },
    orderBy: [{ occupancy: 'asc' }, { createdAt: 'asc' }], // OWNER antes de TENANT
    select: { id: true, fullName: true, cpf: true, email: true, phone: true },
  });
}

function toCustomer(
  payer: { fullName: string; cpf: string; email: string | null; phone: string | null } | null,
  apartmentNumber: string,
): GatewayCustomer {
  if (!payer) return { name: `Unidade ${apartmentNumber}` };
  return {
    name: payer.fullName,
    cpf: payer.cpf,
    email: payer.email ?? undefined,
    phone: payer.phone ?? undefined,
  };
}

/** Emite a cobrança no gateway e grava os dados retornados na Charge. */
async function issueGatewayCharge(
  charge: { id: string; description: string; dueDate: Date; amount: Prisma.Decimal },
  method: 'PIX' | 'BOLETO',
  customer: GatewayCustomer,
) {
  const input: CreateChargeInput = {
    externalReference: charge.id,
    amount: num(charge.amount),
    dueDate: charge.dueDate,
    description: charge.description,
    customer,
  };
  const result =
    method === 'BOLETO'
      ? await paymentGateway.createBoleto(input)
      : await paymentGateway.createPixCharge(input);

  return prisma.charge.update({
    where: { id: charge.id },
    data: {
      gatewayChargeId: result.gatewayChargeId,
      status: result.status,
      pixPayload: result.pixPayload ?? null,
      pixQrCodeUrl: result.pixQrCodeUrl ?? null,
      boletoUrl: result.boletoUrl ?? null,
    },
    include: chargeInclude,
  });
}

// ---- Cobranças avulsas ----

export async function listCharges(q: ListChargesQuery) {
  const where: Prisma.ChargeWhereInput = {
    ...(q.status && { status: q.status }),
    ...(q.apartmentId && { apartmentId: q.apartmentId }),
    ...(q.referenceMonth && { referenceMonth: q.referenceMonth }),
    ...((q.from || q.to) && { dueDate: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }),
  };
  const [data, total] = await Promise.all([
    prisma.charge.findMany({ where, include: chargeInclude, orderBy: { dueDate: 'desc' }, ...toSkipTake(q) }),
    prisma.charge.count({ where }),
  ]);
  return paginate(data, total, q);
}

export async function getCharge(id: string) {
  const charge = await prisma.charge.findFirst({ where: { id }, include: chargeInclude });
  if (!charge) throw AppError.notFound('Cobrança não encontrada');
  return charge;
}

/** Cobranças do morador autenticado (unidades onde ele consta como Resident). */
export async function listMyCharges(user: AuthUser, q: ListChargesQuery) {
  const apartmentIds = await prisma.resident.findMany({
    where: { userId: user.id },
    select: { apartmentId: true },
  });
  const ids = apartmentIds.map((r) => r.apartmentId);
  if (ids.length === 0) return paginate([], 0, q);

  const where: Prisma.ChargeWhereInput = {
    apartmentId: { in: ids },
    ...(q.status && { status: q.status }),
    ...(q.referenceMonth && { referenceMonth: q.referenceMonth }),
  };
  const [data, total] = await Promise.all([
    prisma.charge.findMany({ where, include: chargeInclude, orderBy: { dueDate: 'desc' }, ...toSkipTake(q) }),
    prisma.charge.count({ where }),
  ]);
  return paginate(data, total, q);
}

export async function createCharge(input: CreateChargeBody, user: AuthUser) {
  const apartment = await prisma.apartment.findFirst({
    where: { id: input.apartmentId },
    select: { id: true, number: true },
  });
  if (!apartment) throw AppError.notFound('Unidade não encontrada');

  const payer = await resolvePayer(apartment.id, input.residentId);

  const charge = await prisma.charge.create({
    data: {
      apartmentId: apartment.id,
      residentId: payer?.id ?? null,
      kind: input.kind,
      description: input.description,
      referenceMonth: input.referenceMonth ?? null,
      amount: dec(input.amount),
      dueDate: input.dueDate,
      method: input.method,
    } as Prisma.ChargeUncheckedCreateInput,
  });

  const issued = await issueGatewayCharge(charge, input.method, toCustomer(payer, apartment.number));
  await audit({ userId: user.id, action: 'charge.create', entity: 'Charge', entityId: charge.id });
  return issued;
}

export async function cancelCharge(id: string, user: AuthUser) {
  const charge = await prisma.charge.findFirst({ where: { id }, select: { id: true, status: true } });
  if (!charge) throw AppError.notFound('Cobrança não encontrada');
  if (charge.status === 'PAID') throw AppError.business('Cobrança paga não pode ser cancelada');
  if (charge.status === 'CANCELED') throw AppError.business('Cobrança já cancelada');

  const updated = await prisma.charge.update({
    where: { id },
    data: { status: 'CANCELED', canceledAt: new Date() },
    include: chargeInclude,
  });
  await audit({ userId: user.id, action: 'charge.cancel', entity: 'Charge', entityId: id });
  return updated;
}

/**
 * DEMO/MVP: confirma o pagamento de uma cobrança sem gateway real, reaproveitando
 * o caminho do webhook (idempotente). Disponível apenas com o gateway stub —
 * em produção com Asaas a baixa só ocorre pelo webhook real.
 */
export async function simulatePayment(id: string, user: AuthUser) {
  if (paymentGateway.provider !== 'stub') {
    throw AppError.business('Simulação disponível apenas no modo de demonstração (gateway stub)');
  }
  const charge = await prisma.charge.findFirst({
    where: { id },
    select: { id: true, gatewayChargeId: true, amount: true, status: true },
  });
  if (!charge) throw AppError.notFound('Cobrança não encontrada');
  if (!charge.gatewayChargeId) throw AppError.business('Cobrança sem identificador de gateway');
  if (charge.status === 'PAID') throw AppError.business('Cobrança já está paga');

  await handleWebhook({}, {
    gatewayChargeId: charge.gatewayChargeId,
    type: 'PAYMENT_RECEIVED',
    paidAmount: num(charge.amount),
  });
  await audit({ userId: user.id, action: 'charge.simulatePayment', entity: 'Charge', entityId: id });
  return getCharge(id);
}

// ---- Lote mensal ----

export async function createBatch(input: CreateBatchInput, user: AuthUser) {
  const existing = await prisma.chargeBatch.findFirst({
    where: { referenceMonth: input.referenceMonth },
    select: { id: true },
  });
  if (existing) throw AppError.conflict(`Já existe lote para ${input.referenceMonth}`);

  const apartments = await prisma.apartment.findMany({ select: { id: true, number: true } });
  if (apartments.length === 0) throw AppError.business('Nenhuma unidade cadastrada para cobrar');

  const batch = await prisma.chargeBatch.create({
    data: {
      referenceMonth: input.referenceMonth,
      dueDate: input.dueDate,
      defaultAmount: dec(input.amount),
    } as Prisma.ChargeBatchUncheckedCreateInput,
  });

  const description = input.description ?? `Taxa condominial ${input.referenceMonth}`;
  let issued = 0;

  for (const apt of apartments) {
    const payer = await resolvePayer(apt.id);
    const charge = await prisma.charge.create({
      data: {
        apartmentId: apt.id,
        residentId: payer?.id ?? null,
        batchId: batch.id,
        kind: 'CONDO_FEE',
        description,
        referenceMonth: input.referenceMonth,
        amount: dec(input.amount),
        dueDate: input.dueDate,
        method: input.method,
      } as Prisma.ChargeUncheckedCreateInput,
    });
    try {
      await issueGatewayCharge(charge, input.method, toCustomer(payer, apt.number));
      issued += 1;
    } catch (err) {
      logger.error({ err, chargeId: charge.id }, 'Falha ao emitir cobrança do lote no gateway');
    }
  }

  await prisma.chargeBatch.update({ where: { id: batch.id }, data: { totalCharges: issued } });
  await audit({
    userId: user.id,
    action: 'charge.batch.create',
    entity: 'ChargeBatch',
    entityId: batch.id,
    metadata: { referenceMonth: input.referenceMonth, total: apartments.length, issued },
  });

  return { batchId: batch.id, referenceMonth: input.referenceMonth, total: apartments.length, issued };
}

// ---- Webhook do gateway (cross-tenant) ----

export async function handleWebhook(headers: Record<string, string | undefined>, body: unknown) {
  if (!paymentGateway.verifyWebhook(headers)) {
    throw AppError.unauthorized('Assinatura de webhook inválida');
  }

  const event = paymentGateway.parseWebhook(body);
  if (!event) return { received: true, ignored: true };

  // Idempotência: registra o evento; se já existir, ignora.
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: paymentGateway.provider,
        eventId: event.eventId,
        type: event.type,
        payload: body as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { received: true, duplicate: true };
    }
    throw err;
  }

  await applyWebhookEvent(event);
  return { received: true };
}

async function applyWebhookEvent(event: GatewayWebhookEvent) {
  // gatewayChargeId é @unique → findUnique não passa pelo scoping de tenant.
  const charge = await prisma.charge.findUnique({
    where: { gatewayChargeId: event.gatewayChargeId },
    select: { id: true },
  });
  if (!charge) {
    logger.warn({ gatewayChargeId: event.gatewayChargeId }, 'Webhook para cobrança desconhecida');
    return;
  }

  const data: Prisma.ChargeUpdateInput = { status: event.status };
  if (event.status === 'PAID') {
    data.paidAt = event.paidAt ?? new Date();
    if (event.paidAmount !== undefined) data.paidAmount = dec(event.paidAmount);
  }
  if (event.status === 'CANCELED') data.canceledAt = new Date();

  await prisma.charge.update({ where: { id: charge.id }, data });
  logger.info({ chargeId: charge.id, status: event.status }, 'Cobrança atualizada via webhook');
}
