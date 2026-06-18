import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import { reportError } from '@/lib/observability';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
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

  // Erro não previsto (5xx): reporta ao Sentry com contexto e registra no log.
  reportError(err, {
    requestId: (req as Request & { id?: string }).id,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
    condominiumId: req.user?.condominiumId,
  });
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Erro interno' } });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } });
}
