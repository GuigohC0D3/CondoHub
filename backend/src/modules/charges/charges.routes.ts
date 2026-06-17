import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as c from './charges.controller';
import {
  createBatchSchema,
  createChargeSchema,
  idParamSchema,
  listChargesQuerySchema,
} from './charges.schemas';

export const chargesRouter = Router();

// Webhook do gateway: público (autenticado por assinatura), cross-tenant. Antes do authenticate.
chargesRouter.post('/webhook', asyncHandler(c.webhook));

chargesRouter.use(authenticate);

// Morador consulta as próprias cobranças.
chargesRouter.get(
  '/mine',
  requireRole('MORADOR', 'SINDICO'),
  validate({ query: listChargesQuerySchema }),
  asyncHandler(c.listMyCharges),
);

// Gestão de cobranças é exclusiva do síndico.
chargesRouter.use(requireRole('SINDICO'));

chargesRouter.get('/', validate({ query: listChargesQuerySchema }), asyncHandler(c.listCharges));
chargesRouter.post('/', validate({ body: createChargeSchema }), asyncHandler(c.createCharge));
chargesRouter.post('/batch', validate({ body: createBatchSchema }), asyncHandler(c.createBatch));
chargesRouter.get('/:id', validate({ params: idParamSchema }), asyncHandler(c.getCharge));
chargesRouter.post('/:id/cancel', validate({ params: idParamSchema }), asyncHandler(c.cancelCharge));
