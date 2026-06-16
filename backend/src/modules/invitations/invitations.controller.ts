import { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import * as service from './invitations.service';

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ invitation: await service.create(req.body, actor(req)) });
}

export async function list(_req: Request, res: Response) {
  res.json({ invitations: await service.list() });
}

export async function revoke(req: Request, res: Response) {
  await service.revoke(req.params.id, actor(req));
  res.status(204).send();
}

// --- Público ---
export async function info(req: Request, res: Response) {
  res.json({ invitation: await service.getByToken(req.params.token) });
}

export async function accept(req: Request, res: Response) {
  const result = await service.accept(req.params.token, req.body.password, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });
  res.json(result);
}
