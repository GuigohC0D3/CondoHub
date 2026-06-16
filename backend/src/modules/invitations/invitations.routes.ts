import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { authRateLimit } from '@/middlewares/rate-limit';
import { asyncHandler } from '@/utils/async-handler';
import * as controller from './invitations.controller';
import {
  acceptInvitationSchema, createInvitationSchema, idParamSchema, tokenParamSchema,
} from './invitations.schemas';

export const invitationsRouter = Router();

// --- Público (aceite do convite) ---
invitationsRouter.get('/accept/:token', validate({ params: tokenParamSchema }), asyncHandler(controller.info));
invitationsRouter.post(
  '/accept/:token',
  authRateLimit,
  validate({ params: tokenParamSchema, body: acceptInvitationSchema }),
  asyncHandler(controller.accept),
);

// --- Gestão (síndico) ---
invitationsRouter.use(authenticate, requireRole('SINDICO'));
invitationsRouter.get('/', asyncHandler(controller.list));
invitationsRouter.post('/', validate({ body: createInvitationSchema }), asyncHandler(controller.create));
invitationsRouter.delete('/:id', validate({ params: idParamSchema }), asyncHandler(controller.revoke));
