import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { asaasGateway } from './asaas.gateway';
import { stubGateway } from './stub.gateway';
import type { PaymentGateway } from './types';

/**
 * Seleciona o gateway de cobrança por env. Sem ASAAS_API_KEY → cai para stub,
 * mesmo que PAYMENT_PROVIDER=asaas (evita derrubar dev sem credencial).
 */
function resolveGateway(): PaymentGateway {
  if (env.PAYMENT_PROVIDER === 'asaas' && env.ASAAS_API_KEY) return asaasGateway;
  if (env.PAYMENT_PROVIDER === 'asaas') {
    logger.warn('PAYMENT_PROVIDER=asaas sem ASAAS_API_KEY → usando gateway stub');
  }
  return stubGateway;
}

export const paymentGateway = resolveGateway();
export * from './types';
