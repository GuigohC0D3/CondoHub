import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import { AppError } from '@/utils/errors';
import { presignUpload, storageEnabled } from '@/lib/storage';

const SCOPES = ['residents', 'tickets', 'notices', 'packages', 'visitors', 'avatars'] as const;

const presignSchema = z.object({
  scope: z.enum(SCOPES),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(100),
});

export const uploadsRouter = Router();

uploadsRouter.use(authenticate);

// Gera URL de upload direto ao bucket (isolado por tenant).
uploadsRouter.post(
  '/presign',
  validate({ body: presignSchema }),
  asyncHandler(async (req, res) => {
    if (!storageEnabled()) throw AppError.business('Storage não configurado neste ambiente');
    if (!req.user?.condominiumId) throw AppError.forbidden('Sem condomínio no contexto');

    const result = await presignUpload({
      condominiumId: req.user.condominiumId,
      scope: req.body.scope,
      fileName: req.body.fileName,
      mimeType: req.body.mimeType,
    });
    res.json(result);
  }),
);
