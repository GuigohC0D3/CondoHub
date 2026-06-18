import * as Sentry from '@sentry/node';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

let enabled = false;

/** Inicializa o Sentry se houver DSN. Sem DSN, a app opera só com logs estruturados. */
export function initObservability(): void {
  if (!env.SENTRY_DSN) {
    logger.info('Observability: Sentry desabilitado (sem SENTRY_DSN) — usando logs estruturados');
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
  enabled = true;
  logger.info('Observability: Sentry inicializado');
}

/** Reporta um erro ao Sentry (se habilitado) e sempre registra no log. */
export function reportError(err: unknown, context?: Record<string, unknown>): void {
  if (enabled) {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  }
  logger.error({ err, ...context }, 'reportError');
}

/** Garante o envio dos eventos pendentes antes de encerrar o processo. */
export async function flushObservability(timeoutMs = 2000): Promise<void> {
  if (enabled) await Sentry.flush(timeoutMs).catch(() => undefined);
}

export const observabilityEnabled = () => enabled;
