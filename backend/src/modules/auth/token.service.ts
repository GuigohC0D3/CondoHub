import crypto from 'node:crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '@/config/env';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  condominiumId: string | null;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

/**
 * Refresh token: valor opaco aleatório. Guardamos apenas o HASH no banco
 * (RefreshToken.tokenHash) — vazamento do banco não expõe tokens utilizáveis.
 */
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshExpiry(): Date {
  return new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}
