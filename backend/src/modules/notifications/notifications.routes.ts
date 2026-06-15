import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import { AppError } from '@/utils/errors';
import { prisma } from '@/lib/prisma';
import { paginate, toSkipTake } from '@/utils/pagination';

const listQuery = z.object({
  unread: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const idParam = z.object({ id: z.string().uuid() });

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

// Lista as notificações do usuário atual (+ total não lidas).
notificationsRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { unread, page, limit } = req.query as never as z.infer<typeof listQuery>;
    const where = { userId, ...(unread === 'true' && { isRead: false }) };

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake({ page, limit }) }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    res.json({ ...paginate(data, total, { page, limit }), unreadCount });
  }),
);

// Marca uma notificação como lida (só do próprio usuário).
notificationsRouter.patch(
  '/:id/read',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: { isRead: true },
    });
    if (result.count === 0) throw AppError.notFound('Notificação não encontrada');
    res.json({ isRead: true });
  }),
);

// Marca todas como lidas.
notificationsRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ updated: result.count });
  }),
);
