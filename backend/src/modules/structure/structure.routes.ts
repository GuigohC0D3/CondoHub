import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as service from './structure.service';
import {
  createApartmentSchema,
  createBlockSchema,
  idParamSchema,
  listApartmentsQuerySchema,
  updateApartmentSchema,
  updateBlockSchema,
} from './structure.schemas';

export const blocksRouter = Router();
export const apartmentsRouter = Router();

// ---- Blocos ----
blocksRouter.use(authenticate);
blocksRouter.get('/', requireRole('SINDICO', 'MORADOR', 'PORTEIRO'), asyncHandler(async (_req, res) => {
  res.json({ blocks: await service.listBlocks() });
}));
blocksRouter.post('/', requireRole('SINDICO'), validate({ body: createBlockSchema }), asyncHandler(async (req, res) => {
  res.status(201).json({ block: await service.createBlock(req.body) });
}));
blocksRouter.patch('/:id', requireRole('SINDICO'), validate({ params: idParamSchema, body: updateBlockSchema }), asyncHandler(async (req, res) => {
  res.json({ block: await service.updateBlock(req.params.id, req.body.name) });
}));
blocksRouter.delete('/:id', requireRole('SINDICO'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  await service.removeBlock(req.params.id);
  res.status(204).send();
}));

// ---- Apartamentos ----
apartmentsRouter.use(authenticate);
apartmentsRouter.get('/', requireRole('SINDICO', 'MORADOR', 'PORTEIRO'), validate({ query: listApartmentsQuerySchema }), asyncHandler(async (req, res) => {
  res.json(await service.listApartments(req.query as never));
}));
apartmentsRouter.post('/', requireRole('SINDICO'), validate({ body: createApartmentSchema }), asyncHandler(async (req, res) => {
  res.status(201).json({ apartment: await service.createApartment(req.body) });
}));
apartmentsRouter.patch('/:id', requireRole('SINDICO'), validate({ params: idParamSchema, body: updateApartmentSchema }), asyncHandler(async (req, res) => {
  res.json({ apartment: await service.updateApartment(req.params.id, req.body) });
}));
apartmentsRouter.delete('/:id', requireRole('SINDICO'), validate({ params: idParamSchema }), asyncHandler(async (req, res) => {
  await service.removeApartment(req.params.id);
  res.status(204).send();
}));
