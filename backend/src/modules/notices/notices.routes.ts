import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as controller from './notices.controller';
import {
  createNoticeSchema,
  idParamSchema,
  listNoticesQuerySchema,
  updateNoticeSchema,
} from './notices.schemas';

export const noticesRouter = Router();

noticesRouter.use(authenticate);

// Leitura: qualquer usuário do tenant.
noticesRouter.get(
  '/',
  requireRole('SINDICO', 'MORADOR', 'PORTEIRO'),
  validate({ query: listNoticesQuerySchema }),
  asyncHandler(controller.list),
);
noticesRouter.get(
  '/:id',
  requireRole('SINDICO', 'MORADOR', 'PORTEIRO'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.getOne),
);

// Confirmar leitura.
noticesRouter.post(
  '/:id/read',
  requireRole('SINDICO', 'MORADOR', 'PORTEIRO'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.markRead),
);

// Gestão: síndico.
noticesRouter.post(
  '/',
  requireRole('SINDICO'),
  validate({ body: createNoticeSchema }),
  asyncHandler(controller.create),
);
noticesRouter.patch(
  '/:id',
  requireRole('SINDICO'),
  validate({ params: idParamSchema, body: updateNoticeSchema }),
  asyncHandler(controller.update),
);
noticesRouter.delete(
  '/:id',
  requireRole('SINDICO'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.remove),
);
