import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as controller from './residents.controller';
import {
  approveResidentSchema,
  createResidentSchema,
  idParamSchema,
  listResidentsQuerySchema,
  updateResidentSchema,
} from './residents.schemas';

export const residentsRouter = Router();

residentsRouter.use(authenticate);

// Morador consulta o próprio cadastro.
residentsRouter.get('/me', requireRole('MORADOR'), asyncHandler(controller.getMe));

// Gestão (síndico).
residentsRouter.get(
  '/',
  requireRole('SINDICO'),
  validate({ query: listResidentsQuerySchema }),
  asyncHandler(controller.list),
);

residentsRouter.post(
  '/',
  requireRole('SINDICO'),
  validate({ body: createResidentSchema }),
  asyncHandler(controller.create),
);

residentsRouter.get(
  '/:id',
  requireRole('SINDICO'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.getOne),
);

residentsRouter.patch(
  '/:id',
  requireRole('SINDICO'),
  validate({ params: idParamSchema, body: updateResidentSchema }),
  asyncHandler(controller.update),
);

residentsRouter.patch(
  '/:id/approve',
  requireRole('SINDICO'),
  validate({ params: idParamSchema, body: approveResidentSchema }),
  asyncHandler(controller.approve),
);
