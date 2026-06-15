import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { authRateLimit } from '@/middlewares/rate-limit';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as controller from './auth.controller';
import { loginSchema, refreshSchema } from './auth.schemas';

export const authRouter = Router();

authRouter.post('/login', authRateLimit, validate({ body: loginSchema }), asyncHandler(controller.login));
authRouter.post('/refresh', validate({ body: refreshSchema }), asyncHandler(controller.refresh));
authRouter.post('/logout', validate({ body: refreshSchema }), asyncHandler(controller.logout));
authRouter.get('/me', authenticate, asyncHandler(controller.me));
