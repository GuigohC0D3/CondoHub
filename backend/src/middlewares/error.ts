import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import { logger } from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: 'Registro duplicado', details: err.meta?.target },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso não encontrado' } });
    }
  }

  logger.error({ err }, 'Unhandled error');
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Erro interno' } });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } });
}
