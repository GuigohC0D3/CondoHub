import argon2 from 'argon2';
import { prisma } from '@/lib/prisma';
import { runWithTenant } from '@/lib/tenant-context';
import { AppError } from '@/utils/errors';
import {
  generateRefreshToken,
  hashToken,
  refreshExpiry,
  signAccessToken,
} from './token.service';
import type { LoginInput } from './auth.schemas';

interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string; role: string; condominiumId: string | null };
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

/**
 * Login: resolve o tenant pelo slug (subdomínio), valida credenciais e emite
 * access + refresh. Mensagem de erro genérica para não revelar se o email existe.
 * As escritas em RefreshToken rodam dentro do contexto de tenant do usuário.
 */
export async function login(input: LoginInput, meta: SessionMeta): Promise<AuthResult> {
  const { email, password, condominiumSlug } = input;

  let condominiumId: string | null = null;
  if (condominiumSlug) {
    const condo = await prisma.condominium.findUnique({ where: { slug: condominiumSlug } });
    if (!condo || !condo.isActive) throw AppError.unauthorized('Credenciais inválidas');
    condominiumId = condo.id;
  }

  // Sem contexto de tenant ainda → a extensão passa direto. Busca explícita por (tenant, email).
  const user = await prisma.user.findFirst({
    where: { email, condominiumId },
  });
  if (!user || !user.isActive) throw AppError.unauthorized('Credenciais inválidas');

  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) throw AppError.unauthorized('Credenciais inválidas');

  return issueSession(user, meta);
}

/** Rotação de refresh token: invalida o antigo e emite um novo (detecção de reuso). */
export async function refresh(rawToken: string, meta: SessionMeta): Promise<AuthResult> {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw AppError.unauthorized('Sessão inválida');
  }

  return runWithTenant(
    {
      condominiumId: existing.user.condominiumId,
      userId: existing.user.id,
      bypassTenant: existing.user.role === 'SUPER_ADMIN',
    },
    async () => {
      await prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      return issueSession(existing.user, meta);
    },
  );
}

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken
    .updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } })
    .catch(() => undefined);
}

async function issueSession(
  user: { id: string; name: string; email: string; role: string; condominiumId: string | null; passwordHash?: string },
  meta: SessionMeta,
): Promise<AuthResult> {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role as never,
    condominiumId: user.condominiumId,
  });

  const { token, tokenHash } = generateRefreshToken();

  await runWithTenant(
    {
      condominiumId: user.condominiumId,
      userId: user.id,
      bypassTenant: user.role === 'SUPER_ADMIN',
    },
    () =>
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: refreshExpiry(),
          userAgent: meta.userAgent,
          ipAddress: meta.ipAddress,
        },
      }),
  );

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);

  return {
    accessToken,
    refreshToken: token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      condominiumId: user.condominiumId,
    },
  };
}
