import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { asyncHandler } from '@/utils/async-handler';
import * as c from './privacy.controller';

export const privacyRouter = Router();

privacyRouter.use(authenticate);

// Acesso/portabilidade: qualquer titular autenticado exporta os próprios dados.
privacyRouter.get('/me/export', asyncHandler(c.exportData));

// Direito ao esquecimento: self-service para moradores (titulares).
privacyRouter.post('/me/erasure', requireRole('MORADOR'), asyncHandler(c.erasure));
