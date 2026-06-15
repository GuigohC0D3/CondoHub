import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as controller from './reservations.controller';
import {
  approveReservationSchema,
  createReservationSchema,
  idParamSchema,
  listReservationsQuerySchema,
} from './reservations.schemas';

export const reservationsRouter = Router();

reservationsRouter.use(authenticate);

// Listagem/detalhe: síndico (todas) ou morador (próprias) — escopo no service.
reservationsRouter.get(
  '/',
  requireRole('SINDICO', 'MORADOR'),
  validate({ query: listReservationsQuerySchema }),
  asyncHandler(controller.list),
);
reservationsRouter.get(
  '/:id',
  requireRole('SINDICO', 'MORADOR'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.getOne),
);

// Criar: morador (para si).
reservationsRouter.post(
  '/',
  requireRole('MORADOR'),
  validate({ body: createReservationSchema }),
  asyncHandler(controller.create),
);

// Aprovar/rejeitar: síndico.
reservationsRouter.patch(
  '/:id/approve',
  requireRole('SINDICO'),
  validate({ params: idParamSchema, body: approveReservationSchema }),
  asyncHandler(controller.approve),
);

// Cancelar: morador (própria) ou síndico — escopo no service.
reservationsRouter.patch(
  '/:id/cancel',
  requireRole('SINDICO', 'MORADOR'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.cancel),
);
