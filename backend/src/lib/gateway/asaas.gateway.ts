import crypto from 'node:crypto';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { AppError } from '@/utils/errors';
import type {
  CreateChargeInput,
  GatewayChargeResult,
  GatewayChargeStatus,
  GatewayWebhookEvent,
  PaymentGateway,
} from './types';

/**
 * Implementação Asaas (PIX dinâmico + boleto registrado).
 * Auth via header `access_token`. Webhook autenticado por `asaas-access-token`.
 * Docs: https://docs.asaas.com
 */

type AsaasPayment = {
  id: string;
  status: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
};

function mapStatus(asaas: string): GatewayChargeStatus {
  switch (asaas) {
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'RECEIVED_IN_CASH':
      return 'PAID';
    case 'OVERDUE':
      return 'OVERDUE';
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
    case 'CHARGEBACK_REQUESTED':
      return 'REFUNDED';
    default:
      return 'PENDING';
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.ASAAS_API_KEY) throw AppError.business('Gateway Asaas não configurado (ASAAS_API_KEY ausente)');
  const res = await fetch(`${env.ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: env.ASAAS_API_KEY,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error({ path, status: res.status, body: text.slice(0, 500) }, 'Asaas API error');
    throw AppError.business(`Falha no gateway Asaas (${res.status})`);
  }
  return (await res.json()) as T;
}

/** Cria (ou reusa) o cliente Asaas pelo CPF. TODO: cachear o id no Resident. */
async function ensureCustomer(input: CreateChargeInput): Promise<string> {
  const cpf = input.customer.cpf?.replace(/\D/g, '');
  if (cpf) {
    const found = await api<{ data: Array<{ id: string }> }>(`/customers?cpfCnpj=${cpf}`);
    if (found.data?.[0]?.id) return found.data[0].id;
  }
  const created = await api<{ id: string }>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.customer.name,
      cpfCnpj: cpf,
      email: input.customer.email,
      mobilePhone: input.customer.phone?.replace(/\D/g, ''),
    }),
  });
  return created.id;
}

async function createPayment(
  input: CreateChargeInput,
  billingType: 'PIX' | 'BOLETO',
): Promise<AsaasPayment> {
  const customer = await ensureCustomer(input);
  return api<AsaasPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer,
      billingType,
      value: input.amount,
      dueDate: input.dueDate.toISOString().slice(0, 10), // YYYY-MM-DD
      description: input.description,
      externalReference: input.externalReference,
    }),
  });
}

export const asaasGateway: PaymentGateway = {
  provider: 'asaas',

  async createPixCharge(input: CreateChargeInput): Promise<GatewayChargeResult> {
    const payment = await createPayment(input, 'PIX');
    const qr = await api<{ encodedImage: string; payload: string }>(`/payments/${payment.id}/pixQrCode`);
    return {
      gatewayChargeId: payment.id,
      status: mapStatus(payment.status),
      pixPayload: qr.payload,
      pixQrCodeUrl: qr.encodedImage ? `data:image/png;base64,${qr.encodedImage}` : undefined,
    };
  },

  async createBoleto(input: CreateChargeInput): Promise<GatewayChargeResult> {
    const payment = await createPayment(input, 'BOLETO');
    return {
      gatewayChargeId: payment.id,
      status: mapStatus(payment.status),
      boletoUrl: payment.bankSlipUrl ?? payment.invoiceUrl,
    };
  },

  async getCharge(gatewayChargeId: string) {
    const payment = await api<AsaasPayment>(`/payments/${gatewayChargeId}`);
    return { status: mapStatus(payment.status) };
  },

  verifyWebhook(headers: Record<string, string | undefined>): boolean {
    if (!env.PAYMENTS_WEBHOOK_SECRET) return false; // produção exige segredo configurado
    const received = headers['asaas-access-token'];
    if (!received) return false;
    const a = Buffer.from(received);
    const b = Buffer.from(env.PAYMENTS_WEBHOOK_SECRET);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },

  parseWebhook(body: unknown): GatewayWebhookEvent | null {
    const b = body as { id?: string; event?: string; payment?: AsaasPayment & { value?: number; paymentDate?: string } } | null;
    if (!b?.event || !b.payment?.id) return null;

    let type: GatewayWebhookEvent['type'] = 'UNKNOWN';
    if (b.event === 'PAYMENT_RECEIVED' || b.event === 'PAYMENT_CONFIRMED') type = 'PAYMENT_RECEIVED';
    else if (b.event === 'PAYMENT_OVERDUE') type = 'PAYMENT_OVERDUE';
    else if (b.event === 'PAYMENT_REFUNDED') type = 'PAYMENT_REFUNDED';

    return {
      // Asaas pode não enviar id de evento → sintetiza por (evento + pagamento).
      eventId: b.id ?? `${b.event}:${b.payment.id}`,
      type,
      gatewayChargeId: b.payment.id,
      status: type === 'PAYMENT_REFUNDED' ? 'REFUNDED' : type === 'PAYMENT_OVERDUE' ? 'OVERDUE' : mapStatus(b.payment.status),
      paidAt: type === 'PAYMENT_RECEIVED' ? (b.payment.paymentDate ? new Date(b.payment.paymentDate) : new Date()) : undefined,
      paidAmount: typeof b.payment.value === 'number' ? b.payment.value : undefined,
    };
  },
};
