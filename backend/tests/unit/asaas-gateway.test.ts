import { describe, expect, it } from 'vitest';
import { asaasGateway } from '@/lib/gateway/asaas.gateway';

/**
 * Lógica do gateway Asaas que NÃO depende de rede: normalização de webhook,
 * mapeamento de status e verificação de assinatura. O fluxo HTTP real é validado
 * no sandbox via `npm run asaas:smoke`.
 */
describe('asaasGateway.parseWebhook', () => {
  const payment = (status: string, extra = {}) => ({ payment: { id: 'pay_1', status, ...extra } });

  it('normaliza PAYMENT_RECEIVED → PAID com data e valor', () => {
    const ev = asaasGateway.parseWebhook({
      id: 'evt_1',
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_1', status: 'RECEIVED', value: 123.45, paymentDate: '2026-06-17' },
    });
    expect(ev).toMatchObject({ eventId: 'evt_1', type: 'PAYMENT_RECEIVED', gatewayChargeId: 'pay_1', status: 'PAID', paidAmount: 123.45 });
    expect(ev?.paidAt).toBeInstanceOf(Date);
  });

  it('trata PAYMENT_CONFIRMED como recebimento (PAID)', () => {
    expect(asaasGateway.parseWebhook({ event: 'PAYMENT_CONFIRMED', ...payment('CONFIRMED') })?.type).toBe('PAYMENT_RECEIVED');
  });

  it('mapeia OVERDUE e REFUNDED', () => {
    expect(asaasGateway.parseWebhook({ event: 'PAYMENT_OVERDUE', ...payment('OVERDUE') })?.status).toBe('OVERDUE');
    expect(asaasGateway.parseWebhook({ event: 'PAYMENT_REFUNDED', ...payment('REFUNDED') })?.status).toBe('REFUNDED');
  });

  it('sintetiza eventId quando o Asaas não envia id do evento', () => {
    expect(asaasGateway.parseWebhook({ event: 'PAYMENT_RECEIVED', ...payment('RECEIVED') })?.eventId).toBe('PAYMENT_RECEIVED:pay_1');
  });

  it('retorna null para corpos inválidos', () => {
    expect(asaasGateway.parseWebhook(null)).toBeNull();
    expect(asaasGateway.parseWebhook({ event: 'PAYMENT_RECEIVED' })).toBeNull(); // sem payment.id
    expect(asaasGateway.parseWebhook({ payment: { id: 'x', status: 'RECEIVED' } })).toBeNull(); // sem event
  });
});

describe('asaasGateway.verifyWebhook', () => {
  // PAYMENTS_WEBHOOK_SECRET = 'sandbox-webhook-secret' (vitest.config.ts)
  it('aceita o token correto', () => {
    expect(asaasGateway.verifyWebhook({ 'asaas-access-token': 'sandbox-webhook-secret' })).toBe(true);
  });
  it('rejeita token errado ou ausente', () => {
    expect(asaasGateway.verifyWebhook({ 'asaas-access-token': 'errado' })).toBe(false);
    expect(asaasGateway.verifyWebhook({})).toBe(false);
  });
});
