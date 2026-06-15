import { Request, Response } from 'express';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/errors';
import * as authService from './auth.service';

function sessionMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body, sessionMeta(req));
  res.json(result);
}

export async function refresh(req: Request, res: Response) {
  const result = await authService.refresh(req.body.refreshToken, sessionMeta(req));
  res.json(result);
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body.refreshToken);
  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      condominiumId: true,
      avatarUrl: true,
      phone: true,
    },
  });
  res.json({ user });
}
