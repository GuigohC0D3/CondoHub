/**
 * Abstração do gateway de cobrança do morador (PIX/Boleto).
 * Mantém o domínio desacoplado do provedor (Asaas/Pagar.me/Mercado Pago).
 * Valores monetários trafegam como número em reais (BRL).
 */

// Alinhado aos valores do enum ChargeStatus (Prisma) — o service pode reusar direto.
export type GatewayChargeStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED' | 'REFUNDED';

export interface GatewayCustomer {
  name: string;
  cpf?: string;
  email?: string;
  phone?: string;
}

export interface CreateChargeInput {
  /** Referência externa = id da Charge no nosso banco (idempotência/conciliação). */
  externalReference: string;
  amount: number; // reais
  dueDate: Date;
  description: string;
  customer: GatewayCustomer;
}

export interface GatewayChargeResult {
  gatewayChargeId: string;
  status: GatewayChargeStatus;
  pixPayload?: string; // copia-e-cola
  pixQrCodeUrl?: string; // data URL ou URL da imagem do QR
  boletoUrl?: string;
}

/** Evento de webhook já normalizado para o nosso domínio. */
export interface GatewayWebhookEvent {
  /** Id único do evento (idempotência via WebhookEvent). */
  eventId: string;
  type: 'PAYMENT_RECEIVED' | 'PAYMENT_OVERDUE' | 'PAYMENT_REFUNDED' | 'UNKNOWN';
  gatewayChargeId: string;
  status: GatewayChargeStatus;
  paidAt?: Date;
  paidAmount?: number;
}

export interface PaymentGateway {
  readonly provider: string;
  createPixCharge(input: CreateChargeInput): Promise<GatewayChargeResult>;
  createBoleto(input: CreateChargeInput): Promise<GatewayChargeResult>;
  getCharge(gatewayChargeId: string): Promise<{ status: GatewayChargeStatus; paidAt?: Date }>;
  /** Valida a autenticidade do webhook (header secreto / assinatura). */
  verifyWebhook(headers: Record<string, string | undefined>): boolean;
  /** Normaliza o corpo do webhook; retorna null se irrelevante. */
  parseWebhook(body: unknown): GatewayWebhookEvent | null;
}
