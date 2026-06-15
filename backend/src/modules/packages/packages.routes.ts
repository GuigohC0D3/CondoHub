import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as controller from './packages.controller';
import {
  createPackageSchema,
  idParamSchema,
  listPackagesQuerySchema,
  pickupSchema,
} from './packages.schemas';

export const packagesRouter = Router();

packagesRouter.use(authenticate);

// Registrar encomenda: porteiro (ou síndico).
packagesRouter.post(
  '/',
  requireRole('SINDICO', 'PORTEIRO'),
  validate({ body: createPackageSchema }),
  asyncHandler(controller.create),
);

// Listagem/detalhe: síndico/porteiro (todas) ou morador (do próprio apto).
packagesRouter.get(
  '/',
  requireRole('SINDICO', 'PORTEIRO', 'MORADOR'),
  validate({ query: listPackagesQuerySchema }),
  asyncHandler(controller.list),
);
packagesRouter.get(
  '/:id',
  requireRole('SINDICO', 'PORTEIRO', 'MORADOR'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.getOne),
);

// Confirmar retirada: porteiro (ou síndico).
packagesRouter.patch(
  '/:id/pickup',
  requireRole('SINDICO', 'PORTEIRO'),
  validate({ params: idParamSchema, body: pickupSchema }),
  asyncHandler(controller.pickup),
);
