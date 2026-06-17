import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { handleWebhook } from '@/modules/charges/charges.service';
import { asTenant, createCondo, prisma, resetDb } from './helpers';

/**
 * Conciliação de cobrança (P0.1) — o webhook do gateway é o que dá baixa no
 * pagamento. Precisa ser idempotente (gateways reenviam eventos) e cross-tenant
 * (roda sem contexto, casando pelo gatewayChargeId único).
 */
describe('Cobrança → webhook → baixa', () => {
  let condo: string;
  let apartmentId: string;

  beforeAll(() => prisma.$connect());
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await resetDb();
    condo = await createCondo('Condo W');
    apartmentId = await asTenant(condo, async () => {
      const apt = await prisma.apartment.create({ data: { number: '101' } as Prisma.ApartmentUncheckedCreateInput });
      return apt.id;
    });
  });

  async function makeCharge(gatewayChargeId: string) {
    return asTenant(condo, () =>
      prisma.charge.create({
        data: {
          apartmentId,
          description: 'Taxa',
          amount: new Prisma.Decimal(450),
          dueDate: new Date(),
          status: 'PENDING',
          gatewayChargeId,
        } as Prisma.ChargeUncheckedCreateInput,
      }),
    );
  }
  const reload = (id: string) => asTenant(condo, () => prisma.charge.findFirst({ where: { id } }));

  it('dá baixa (PENDING → PAID) ao receber PAYMENT_RECEIVED', async () => {
    const charge = await makeCharge('stub_pay_1');

    const res = await handleWebhook({}, { gatewayChargeId: 'stub_pay_1', type: 'PAYMENT_RECEIVED', paidAmount: 450 });
    expect(res).toEqual({ received: true });

    const after = await reload(charge.id);
    expect(after?.status).toBe('PAID');
    expect(after?.paidAt).toBeInstanceOf(Date);
    expect(Number(after?.paidAmount)).toBe(450);
  });

  it('é idempotente: reenvio do mesmo evento não reprocessa', async () => {
    const charge = await makeCharge('stub_pay_2');
    const body = { gatewayChargeId: 'stub_pay_2', type: 'PAYMENT_RECEIVED', paidAmount: 450 };

    expect(await handleWebhook({}, body)).toEqual({ received: true });
    expect(await handleWebhook({}, body)).toEqual({ received: true, duplicate: true });

    // Apenas um WebhookEvent registrado para o evento.
    const events = await prisma.webhookEvent.count({ where: { eventId: 'stub:stub_pay_2:PAYMENT_RECEIVED' } });
    expect(events).toBe(1);
    expect((await reload(charge.id))?.status).toBe('PAID');
  });

  it('ignora com segurança evento de cobrança desconhecida (sem lançar)', async () => {
    const res = await handleWebhook({}, { gatewayChargeId: 'nao_existe', type: 'PAYMENT_RECEIVED' });
    expect(res).toEqual({ received: true });
  });

  it('ignora corpo inválido', async () => {
    expect(await handleWebhook({}, { foo: 'bar' })).toEqual({ received: true, ignored: true });
  });
});
