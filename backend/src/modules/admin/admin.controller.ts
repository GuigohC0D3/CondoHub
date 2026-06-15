import { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import * as service from './admin.service';

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function createCondominium(req: Request, res: Response) {
  res.status(201).json({ condominium: await service.createCondominium(req.body, actor(req)) });
}
export async function listCondominiums(req: Request, res: Response) {
  res.json(await service.listCondominiums(req.query as never));
}
export async function getCondominium(req: Request, res: Response) {
  res.json({ condominium: await service.getCondominium(req.params.id) });
}
export async function block(req: Request, res: Response) {
  res.json({ condominium: await service.setBlocked(req.params.id, true, actor(req), req.body?.reason) });
}
export async function unblock(req: Request, res: Response) {
  res.json({ condominium: await service.setBlocked(req.params.id, false, actor(req)) });
}
export async function updateSubscription(req: Request, res: Response) {
  res.json({ subscription: await service.updateSubscription(req.params.id, req.body, actor(req)) });
}
export async function metrics(_req: Request, res: Response) {
  res.json(await service.globalMetrics());
}
