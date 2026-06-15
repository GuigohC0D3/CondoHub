import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { asyncHandler } from '@/utils/async-handler';
import { AppError } from '@/utils/errors';
import { getDashboard } from './dashboard.service';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, requireRole('SINDICO'));

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user?.condominiumId) throw AppError.forbidden('Sem condomínio no contexto');
    res.json(await getDashboard(req.user.condominiumId));
  }),
);
