import { UserRole } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '@/utils/errors';

/** Exige que o usuário autenticado possua um dos papéis informados (deny-by-default). */
export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('Papel sem permissão para esta ação'));
    }
    next();
  };

/**
 * Garante que um recurso carregado pertence ao tenant do usuário.
 * Use em handlers após buscar o recurso por id global.
 */
export function assertSameTenant(
  resource: { condominiumId: string | null } | null,
  user: { condominiumId: string | null; role: UserRole },
): void {
  if (!resource) throw AppError.notFound();
  if (user.role === 'SUPER_ADMIN') return;
  if (resource.condominiumId !== user.condominiumId) {
    throw AppError.notFound(); // 404 em vez de 403 para não revelar existência cross-tenant
  }
}
