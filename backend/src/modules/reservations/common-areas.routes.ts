import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as controller from './common-areas.controller';
import {
  createCommonAreaSchema,
  idParamSchema,
  updateCommonAreaSchema,
} from './common-areas.schemas';

export const commonAreasRouter = Router();

commonAreasRouter.use(authenticate);

// Leitura: qualquer usuário autenticado do tenant (morador precisa ver para reservar).
commonAreasRouter.get('/', asyncHandler(controller.list));
commonAreasRouter.get('/:id', validate({ params: idParamSchema }), asyncHandler(controller.getOne));

// Escrita: síndico.
commonAreasRouter.post(
  '/',
  requireRole('SINDICO'),
  validate({ body: createCommonAreaSchema }),
  asyncHandler(controller.create),
);
commonAreasRouter.patch(
  '/:id',
  requireRole('SINDICO'),
  validate({ params: idParamSchema, body: updateCommonAreaSchema }),
  asyncHandler(controller.update),
);
