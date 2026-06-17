import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { hashPassword, login, logout, refresh } from '@/modules/auth/auth.service';
import { hashToken, verifyAccessToken } from '@/modules/auth/token.service';
import { asTenant, prisma, resetDb } from './helpers';

/**
 * Fluxo de autenticação (P0.1) — login com tenant por slug, emissão de access
 * (JWT) + refresh opaco (só hash no banco) e rotação do refresh com detecção de
 * reuso (token revogado não pode ser reaproveitado).
 */
describe('Auth flow', () => {
  const slug = 'auth-co';
  const email = 'sindico@auth.test';
  const password = 'segredo-super-123';
  let condoId: string;

  beforeAll(() => prisma.$connect());
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
    const condo = await prisma.condominium.create({ data: { name: 'Auth Co', slug } });
    condoId = condo.id;
    const passwordHash = await hashPassword(password);
    await asTenant(condoId, () =>
      prisma.user.create({
        data: { name: 'Síndico', email, passwordHash, role: 'SINDICO' } as Prisma.UserUncheckedCreateInput,
      }),
    );
  });

  it('faz login com credenciais válidas e emite access + refresh', async () => {
    const res = await login({ email, password, condominiumSlug: slug }, {});
    expect(res.user).toMatchObject({ email, role: 'SINDICO', condominiumId: condoId });

    const payload = verifyAccessToken(res.accessToken);
    expect(payload).toMatchObject({ role: 'SINDICO', condominiumId: condoId });
    expect(res.refreshToken).toBeTruthy();

    // Só o HASH do refresh é persistido — nunca o token cru.
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(res.refreshToken) } });
    expect(stored).not.toBeNull();
  });

  it('rejeita senha incorreta e email inexistente (401 genérico)', async () => {
    await expect(login({ email, password: 'errada', condominiumSlug: slug }, {})).rejects.toMatchObject({ statusCode: 401 });
    await expect(login({ email: 'nao@existe.test', password, condominiumSlug: slug }, {})).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rotaciona o refresh: revoga o antigo e emite um novo', async () => {
    const first = await login({ email, password, condominiumSlug: slug }, {});
    const rotated = await refresh(first.refreshToken, {});

    expect(rotated.refreshToken).not.toBe(first.refreshToken);

    const oldRow = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(first.refreshToken) } });
    expect(oldRow?.revokedAt).toBeInstanceOf(Date); // antigo revogado

    const newRow = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rotated.refreshToken) } });
    expect(newRow?.revokedAt).toBeNull(); // novo ativo
  });

  it('detecta reuso: refresh já revogado é rejeitado', async () => {
    const first = await login({ email, password, condominiumSlug: slug }, {});
    await refresh(first.refreshToken, {}); // rotaciona (revoga o first)
    await expect(refresh(first.refreshToken, {})).rejects.toMatchObject({ statusCode: 401 });
  });

  it('logout revoga o refresh corrente', async () => {
    const res = await login({ email, password, condominiumSlug: slug }, {});
    await logout(res.refreshToken);
    await expect(refresh(res.refreshToken, {})).rejects.toMatchObject({ statusCode: 401 });
  });
});
