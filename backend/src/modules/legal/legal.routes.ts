import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { asyncHandler } from '@/utils/async-handler';
import * as c from './legal.controller';

export const legalRouter = Router();

// Documentos legais são públicos (mostrados antes do login/aceite).
legalRouter.get('/documents', asyncHandler(c.documents));

// Consentimento exige usuário autenticado.
legalRouter.post('/consent', authenticate, asyncHandler(c.consent));
legalRouter.get('/consent/me', authenticate, asyncHandler(c.myConsents));
