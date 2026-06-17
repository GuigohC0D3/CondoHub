import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as c from './assemblies.controller';
import {
  checkinSchema,
  createAssemblySchema,
  createItemSchema,
  idParamSchema,
  itemParamSchema,
  listAssembliesQuerySchema,
  updateAssemblySchema,
  updateItemSchema,
  voteSchema,
} from './assemblies.schemas';

export const assembliesRouter = Router();

assembliesRouter.use(authenticate);

// ---- Leitura e participação (qualquer papel autenticado do condomínio) ----
assembliesRouter.get('/', validate({ query: listAssembliesQuerySchema }), asyncHandler(c.list));
assembliesRouter.get('/:id', validate({ params: idParamSchema }), asyncHandler(c.get));
assembliesRouter.get('/:id/results', validate({ params: idParamSchema }), asyncHandler(c.results));
assembliesRouter.get('/:id/minutes', validate({ params: idParamSchema }), asyncHandler(c.minutes));
assembliesRouter.post('/:id/checkin', validate({ params: idParamSchema, body: checkinSchema }), asyncHandler(c.checkin));
assembliesRouter.post(
  '/:id/items/:itemId/vote',
  validate({ params: itemParamSchema, body: voteSchema }),
  asyncHandler(c.vote),
);

// ---- Gestão (somente síndico) ----
assembliesRouter.use(requireRole('SINDICO'));

assembliesRouter.post('/', validate({ body: createAssemblySchema }), asyncHandler(c.create));
assembliesRouter.patch('/:id', validate({ params: idParamSchema, body: updateAssemblySchema }), asyncHandler(c.update));
assembliesRouter.post('/:id/schedule', validate({ params: idParamSchema }), asyncHandler(c.schedule));
assembliesRouter.post('/:id/open', validate({ params: idParamSchema }), asyncHandler(c.open));
assembliesRouter.post('/:id/close', validate({ params: idParamSchema }), asyncHandler(c.close));
assembliesRouter.post('/:id/cancel', validate({ params: idParamSchema }), asyncHandler(c.cancel));

assembliesRouter.post('/:id/items', validate({ params: idParamSchema, body: createItemSchema }), asyncHandler(c.addItem));
assembliesRouter.patch(
  '/:id/items/:itemId',
  validate({ params: itemParamSchema, body: updateItemSchema }),
  asyncHandler(c.updateItem),
);
assembliesRouter.delete('/:id/items/:itemId', validate({ params: itemParamSchema }), asyncHandler(c.removeItem));
assembliesRouter.post('/:id/items/:itemId/open', validate({ params: itemParamSchema }), asyncHandler(c.openItem));
assembliesRouter.post('/:id/items/:itemId/close', validate({ params: itemParamSchema }), asyncHandler(c.closeItem));
