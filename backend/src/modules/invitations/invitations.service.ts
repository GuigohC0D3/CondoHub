import crypto from 'node:crypto';
import argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { enqueue } from '@/lib/queue';
import { env } from '@/config/env';
import { baseEmailLayout } from '@/lib/email';
import { AppError } from '@/utils/errors';
import {
  generateRefreshToken, refreshExpiry, signAccessToken,
} from '@/modules/auth/token.service';
import type { AuthUser } from '@/types/express';
import type { CreateInvitationInput } from './invitations.schemas';

const INVITE_TTL_DAYS = 7;

export async function create(input: CreateInvitationInput, actor: AuthUser) {
  // Já existe usuário com este e-mail no condomínio?
  const existingUser = await prisma.user.findFirst({ where: { email: input.email } });
  if (existingUser) throw AppError.conflict('Já existe um usuário com este e-mail');

  if (input.residentId) {
    const resident = await prisma.resident.findFirst({
      where: { id: input.residentId },
      select: { id: true, userId: true },
    });
    if (!resident) throw AppError.business('Morador inexistente neste condomínio');
    if (resident.userId) throw AppError.business('Este morador já possui um login');
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const invitation = await prisma.invitation.create({
    data: {
      email: input.email,
      name: input.name,
      role: input.role,
      residentId: input.residentId,
      token,
      invitedById: actor.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    } as Prisma.InvitationUncheckedCreateInput,
  });

  // E-mail com o link de aceite (enfileirado; Resend ou stub).
  const acceptUrl = `${env.WEB_URL.replace(/\/$/, '')}/convite/${token}`;
  enqueue('email.send', {
    to: input.email,
    subject: 'Você foi convidado para o CondoHub',
    html: baseEmailLayout({
      heading: `Olá, ${input.name}!`,
      body: 'Você foi convidado a acessar o CondoHub. Clique no botão abaixo para criar sua senha e entrar. O convite expira em 7 dias.',
      cta: { label: 'Aceitar convite', url: acceptUrl },
    }),
    text: `Olá ${input.name}, você foi convidado para o CondoHub. Acesse: ${acceptUrl}`,
  }).catch((err) => logger.warn({ err }, 'Falha ao enfileirar e-mail de convite'));

  await audit({ userId: actor.id, action: 'invitation.create', entity: 'Invitation', entityId: invitation.id });
  return invitation;
}

export async function list() {
  return prisma.invitation.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    include: { resident: { select: { fullName: true } } },
  });
}

export async function revoke(id: string, actor: AuthUser) {
  const inv = await prisma.invitation.findFirst({ where: { id }, select: { id: true, status: true } });
  if (!inv) throw AppError.notFound('Convite não encontrado');
  if (inv.status !== 'PENDING') throw AppError.business('Convite não está pendente');
  const updated = await prisma.invitation.update({ where: { id }, data: { status: 'REVOKED' } });
  await audit({ userId: actor.id, action: 'invitation.revoke', entity: 'Invitation', entityId: id });
  return updated;
}

/** Público: dados do convite para a tela de aceite (sem expor o token de volta). */
export async function getByToken(token: string) {
  const inv = await prisma.invitation.findFirst({
    where: { token },
    include: { condominium: { select: { name: true, slug: true } } },
  });
  if (!inv || inv.status !== 'PENDING' || inv.expiresAt < new Date()) {
    throw AppError.notFound('Convite inválido ou expirado');
  }
  return { email: inv.email, name: inv.name, role: inv.role, condominium: inv.condominium };
}

/** Público: cria o login a partir do convite e já autentica. */
export async function accept(token: string, password: string, meta: { userAgent?: string; ipAddress?: string }) {
  const inv = await prisma.invitation.findFirst({ where: { token } });
  if (!inv || inv.status !== 'PENDING' || inv.expiresAt < new Date()) {
    throw AppError.notFound('Convite inválido ou expirado');
  }

  const dup = await prisma.user.findFirst({ where: { email: inv.email, condominiumId: inv.condominiumId } });
  if (dup) throw AppError.conflict('Já existe um usuário com este e-mail');

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.$transaction(async (tx) => {
    // Sem contexto de tenant (rota pública) → condominiumId explícito.
    const created = await tx.user.create({
      data: { name: inv.name, email: inv.email, passwordHash, role: inv.role, condominiumId: inv.condominiumId },
    });
    if (inv.residentId) {
      await tx.resident.updateMany({
        where: { id: inv.residentId, userId: null },
        data: { userId: created.id },
      });
    }
    await tx.invitation.update({ where: { id: inv.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
    return created;
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role, condominiumId: user.condominiumId });
  const { token: refreshToken, tokenHash } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt: refreshExpiry(), userAgent: meta.userAgent, ipAddress: meta.ipAddress },
  });

  await audit({ userId: user.id, action: 'invitation.accept', entity: 'Invitation', entityId: inv.id });
  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, condominiumId: user.condominiumId },
  };
}
