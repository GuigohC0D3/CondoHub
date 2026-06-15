import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as controller from './tickets.controller';
import {
  attachmentSchema,
  commentSchema,
  createTicketSchema,
  idParamSchema,
  listTicketsQuerySchema,
  updateTicketSchema,
} from './tickets.schemas';

export const ticketsRouter = Router();

ticketsRouter.use(authenticate);

// Listagem/detalhe: síndico (todos) ou morador (próprios) — escopo no service.
ticketsRouter.get(
  '/',
  requireRole('SINDICO', 'MORADOR'),
  validate({ query: listTicketsQuerySchema }),
  asyncHandler(controller.list),
);
ticketsRouter.get(
  '/:id',
  requireRole('SINDICO', 'MORADOR'),
  validate({ params: idParamSchema }),
  asyncHandler(controller.getOne),
);

// Abrir chamado: morador.
ticketsRouter.post(
  '/',
  requireRole('MORADOR'),
  validate({ body: createTicketSchema }),
  asyncHandler(controller.create),
);

// Gerir (status/prioridade/responsável): síndico.
ticketsRouter.patch(
  '/:id',
  requireRole('SINDICO'),
  validate({ params: idParamSchema, body: updateTicketSchema }),
  asyncHandler(controller.update),
);

// Comentários e anexos: síndico ou morador (dono) — escopo no service.
ticketsRouter.post(
  '/:id/comments',
  requireRole('SINDICO', 'MORADOR'),
  validate({ params: idParamSchema, body: commentSchema }),
  asyncHandler(controller.addComment),
);
ticketsRouter.post(
  '/:id/attachments',
  requireRole('SINDICO', 'MORADOR'),
  validate({ params: idParamSchema, body: attachmentSchema }),
  asyncHandler(controller.addAttachment),
);
