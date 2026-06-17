import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireRole } from '@/middlewares/rbac';
import { AppError } from '@/utils/errors';

function run(role: string | null, allowed: Parameters<typeof requireRole>) {
  const req = (role ? { user: { id: 'u1', role, condominiumId: 'c1' } } : {}) as unknown as Request;
  const next = vi.fn();
  requireRole(...allowed)(req, {} as Response, next);
  return next;
}

describe('requireRole (RBAC deny-by-default)', () => {
  it('bloqueia requisição sem usuário autenticado (401)', () => {
    const next = run(null, ['SINDICO']);
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });

  it('bloqueia papel não autorizado (403)', () => {
    const next = run('MORADOR', ['SINDICO']);
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });

  it('permite papel autorizado (next sem erro)', () => {
    const next = run('SINDICO', ['SINDICO']);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('permite quando o papel está entre os múltiplos aceitos', () => {
    const next = run('PORTEIRO', ['SINDICO', 'PORTEIRO']);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('bloqueia papel fora da lista de múltiplos aceitos (403)', () => {
    const next = run('MORADOR', ['SINDICO', 'PORTEIRO']);
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(403);
  });
});
