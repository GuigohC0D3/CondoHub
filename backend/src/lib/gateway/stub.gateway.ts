import crypto from 'node:crypto';
import { logger } from '@/lib/logger';
import type {
  CreateChargeInput,
  GatewayChargeResult,
  GatewayWebhookEvent,
  PaymentGateway,
} from './types';

/**
 * Gateway stub para desenvolvimento/teste — não chama API externa.
 * Gera um payload PIX fake (copia-e-cola plausível) e um id determinístico,
 * permitindo exercitar todo o fluxo de cobrança sem credencial real.
 * Espelha a estratégia do webhook B2B, que aceita sem segredo em dev.
 */
function fakePixPayload(ref: string, amount: number): string {
  // Estrutura inspirada no BR Code (não é um PIX válido — apenas para testes).
  const merchant = '5204000053039865802BR5913CondoHub Demo6009Sao Paulo';
  const txid = crypto.createHash('sha1').update(ref).digest('hex').slice(0, 25);
  const value = amount.toFixed(2);
  return `00020126BR.GOV.BCB.PIX${merchant}54${value}62${txid}6304STUB`;
}

export const stubGateway: PaymentGateway = {
  provider: 'stub',

  async createPixCharge(input: CreateChargeInput): Promise<GatewayChargeResult> {
    const gatewayChargeId = `stub_${crypto.createHash('sha1').update(input.externalReference).digest('hex').slice(0, 16)}`;
    logger.info({ ref: input.externalReference, amount: input.amount }, 'stubGateway: PIX criado');
    const pixPayload = fakePixPayload(input.externalReference, input.amount);
    return {
      gatewayChargeId,
      status: 'PENDING',
      pixPayload,
      pixQrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pixPayload)}`,
    };
  },

  async createBoleto(input: CreateChargeInput): Promise<GatewayChargeResult> {
    const gatewayChargeId = `stub_${crypto.createHash('sha1').update(input.externalReference).digest('hex').slice(0, 16)}`;
    logger.info({ ref: input.externalReference, amount: input.amount }, 'stubGateway: boleto criado');
    return {
      gatewayChargeId,
      status: 'PENDING',
      boletoUrl: `https://example.com/boleto/${gatewayChargeId}.pdf`,
    };
  },

  async getCharge(_gatewayChargeId: string) {
    return { status: 'PENDING' as const };
  },

  verifyWebhook(): boolean {
    return true; // dev: aceita sempre
  },

  parseWebhook(body: unknown): GatewayWebhookEvent | null {
    // Aceita um corpo simplificado para simular baixa manual em testes:
    // { gatewayChargeId, type, paidAmount? }
    const b = body as Record<string, unknown> | null;
    if (!b || typeof b.gatewayChargeId !== 'string') return null;
    const type = (b.type as GatewayWebhookEvent['type']) ?? 'PAYMENT_RECEIVED';
    const status = type === 'PAYMENT_REFUNDED' ? 'REFUNDED' : type === 'PAYMENT_OVERDUE' ? 'OVERDUE' : 'PAID';
    return {
      eventId: `stub:${b.gatewayChargeId}:${type}`,
      type,
      gatewayChargeId: b.gatewayChargeId,
      status,
      paidAt: status === 'PAID' ? new Date() : undefined,
      paidAmount: typeof b.paidAmount === 'number' ? b.paidAmount : undefined,
    };
  },
};
