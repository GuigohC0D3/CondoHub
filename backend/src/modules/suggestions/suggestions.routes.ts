import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as c from './suggestions.controller';
import {
  createSuggestionSchema,
  idParamSchema,
  listSuggestionsQuerySchema,
  setStatusSchema,
  updateSuggestionSchema,
} from './suggestions.schemas';

export const suggestionsRouter = Router();

suggestionsRouter.use(authenticate);

// Leitura: qualquer papel do condomínio.
suggestionsRouter.get('/', validate({ query: listSuggestionsQuerySchema }), asyncHandler(c.list));
suggestionsRouter.get('/:id', validate({ params: idParamSchema }), asyncHandler(c.getOne));

// Morador: cria, edita a própria, vota.
suggestionsRouter.post('/', requireRole('MORADOR'), validate({ body: createSuggestionSchema }), asyncHandler(c.create));
suggestionsRouter.patch('/:id', requireRole('MORADOR'), validate({ params: idParamSchema, body: updateSuggestionSchema }), asyncHandler(c.update));
suggestionsRouter.post('/:id/vote', requireRole('MORADOR'), validate({ params: idParamSchema }), asyncHandler(c.vote));

// Remover: autor (própria) ou síndico — escopo no service.
suggestionsRouter.delete('/:id', requireRole('MORADOR', 'SINDICO'), validate({ params: idParamSchema }), asyncHandler(c.remove));

// Síndico: muda status + resposta oficial.
suggestionsRouter.patch('/:id/status', requireRole('SINDICO'), validate({ params: idParamSchema, body: setStatusSchema }), asyncHandler(c.setStatus));
