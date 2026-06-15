import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import { AppError } from '@/utils/errors';

/**
 * Webhook do gateway de pagamentos (Asaas/Pagar.me). Público, autenticado por
 * segredo compartilhado (header). Atualiza Subscription/Payment conforme o evento.
 * Roda sem contexto de tenant (cross-tenant) — opera por ids globais.
 */

const webhookSchema = z.object({
  type: z.enum(['PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE', 'SUBSCRIPTION_CANCELED']),
  subscriptionId: z.string().uuid(),
  gatewayChargeId: z.string().max(120).optional(),
  amount: z.number().nonnegative().optional(),
  method: z.enum(['PIX', 'CREDIT_CARD', 'BOLETO']).optional(),
  dueDate: z.coerce.date().optional(),
});

export const billingRouter = Router();

function verifySignature(headerSecret: string | undefined): boolean {
  if (!env.BILLING_WEBHOOK_SECRET) return true; // sem segredo configurado: aceita (dev)
  if (!headerSecret) return false;
  const a = Buffer.from(headerSecret);
  const b = Buffer.from(env.BILLING_WEBHOOK_SECRET);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

billingRouter.post(
  '/webhook',
  validate({ body: webhookSchema }),
  asyncHandler(async (req, res) => {
    if (!verifySignature(req.header('x-webhook-secret') ?? undefined)) {
      throw AppError.unauthorized('Assinatura de webhook inválida');
    }

    const { type, subscriptionId, gatewayChargeId, amount, method, dueDate } = req.body as z.infer<typeof webhookSchema>;
    const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId }, select: { id: true } });
    if (!sub) throw AppError.notFound('Assinatura não encontrada');

    switch (type) {
      case 'PAYMENT_CONFIRMED': {
        if (gatewayChargeId) {
          await prisma.payment.upsert({
            where: { gatewayChargeId },
            update: { status: 'PAID', paidAt: new Date() },
            create: {
              subscriptionId,
              gatewayChargeId,
              amount: new Prisma.Decimal(amount ?? 0),
              method: method ?? 'PIX',
              status: 'PAID',
              paidAt: new Date(),
              dueDate: dueDate ?? new Date(),
            },
          });
        }
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: { status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        });
        break;
      }
      case 'PAYMENT_OVERDUE':
        await prisma.subscription.update({ where: { id: subscriptionId }, data: { status: 'PAST_DUE' } });
        break;
      case 'SUBSCRIPTION_CANCELED':
        await prisma.subscription.update({ where: { id: subscriptionId }, data: { status: 'CANCELED' } });
        break;
    }

    logger.info({ type, subscriptionId }, 'Webhook de billing processado');
    res.json({ received: true });
  }),
);
