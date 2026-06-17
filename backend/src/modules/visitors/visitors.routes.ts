import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as controller from './visitors.controller';
import {
  checkInSchema,
  createVisitorSchema,
  denySchema,
  idParamSchema,
  listVisitorsQuerySchema,
  qrParamSchema,
} from './visitors.schemas';

export const visitorsRouter = Router();

visitorsRouter.use(authenticate);

// Pré-cadastro pelo morador (gera QR).
visitorsRouter.post(
  '/',
  requireRole('MORADOR'),
  validate({ body: createVisitorSchema }),
  asyncHandler(controller.create),
);

// Listagem/detalhe: síndico/porteiro (todos) ou morador (próprios).
visitorsRouter.get(
  '/',
  requireRole('SINDICO', 'PORTEIRO', 'MORADOR'),
  validate({ query: listVisitorsQuerySchema }),
  asyncHandler(controller.list),
);

// Validação de QR na portaria (antes do :id para não colidir).
visitorsRouter.get(
  '/validate/:qrCode',
  requireRole('SINDICO', 'PORTEIRO'),
  validate({ params: qrParamSchema }),
  asyncHandler(controller.validateQr),
);

// Pacote de compartilhamento do QR (morador envia ao visitante).
visitorsRouter.get(
  '/:id/share',
  requireRole('SINDICO', 'PORTEIRO', 'MORADOR'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.share),
);

visitorsRouter.get(
  '/:id',
  requireRole('SINDICO', 'PORTEIRO', 'MORADOR'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.getOne),
);

// Entrada (com foto opcional) / saída / negar: porteiro (ou síndico).
visitorsRouter.post(
  '/:id/checkin',
  requireRole('SINDICO', 'PORTEIRO'),
  validate({ params: idParamSchema, body: checkInSchema }),
  asyncHandler(controller.checkIn),
);
visitorsRouter.post(
  '/:id/checkout',
  requireRole('SINDICO', 'PORTEIRO'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.checkOut),
);
visitorsRouter.post(
  '/:id/deny',
  requireRole('SINDICO', 'PORTEIRO'),
  validate({ params: idParamSchema, body: denySchema }),
  asyncHandler(controller.deny),
);
