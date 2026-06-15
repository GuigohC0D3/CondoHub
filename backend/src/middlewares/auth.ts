import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '@/modules/auth/token.service';
import { runWithTenant } from '@/lib/tenant-context';
import { AppError } from '@/utils/errors';

/**
 * Autentica via Bearer token e estabelece o contexto de tenant para o restante
 * da request (AsyncLocalStorage). NUNCA confiar em condominiumId do cliente —
 * sempre derivado do token.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Token ausente'));
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = {
      id: payload.sub,
      role: payload.role,
      condominiumId: payload.condominiumId,
    };

    runWithTenant(
      {
        condominiumId: payload.condominiumId,
        userId: payload.sub,
        bypassTenant: payload.role === 'SUPER_ADMIN',
      },
      () => next(),
    );
  } catch {
    next(AppError.unauthorized('Token inválido ou expirado'));
  }
}
