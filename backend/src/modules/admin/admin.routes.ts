import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as c from './admin.controller';
import {
  blockSchema,
  createCondominiumSchema,
  idParamSchema,
  listQuerySchema,
  updateSubscriptionSchema,
} from './admin.schemas';

export const adminRouter = Router();

// Plataforma: exclusivo do administrador do sistema.
adminRouter.use(authenticate, requireRole('SUPER_ADMIN'));

adminRouter.get('/metrics', asyncHandler(c.metrics));

adminRouter.post('/condominiums', validate({ body: createCondominiumSchema }), asyncHandler(c.createCondominium));
adminRouter.get('/condominiums', validate({ query: listQuerySchema }), asyncHandler(c.listCondominiums));
adminRouter.get('/condominiums/:id', validate({ params: idParamSchema }), asyncHandler(c.getCondominium));
adminRouter.patch('/condominiums/:id/block', validate({ params: idParamSchema, body: blockSchema }), asyncHandler(c.block));
adminRouter.patch('/condominiums/:id/unblock', validate({ params: idParamSchema }), asyncHandler(c.unblock));

adminRouter.patch('/subscriptions/:id', validate({ params: idParamSchema, body: updateSubscriptionSchema }), asyncHandler(c.updateSubscription));
