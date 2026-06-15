import { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import * as service from './residents.service';

function actorId(req: Request): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.id;
}

export async function list(req: Request, res: Response) {
  res.json(await service.list(req.query as never));
}

export async function getOne(req: Request, res: Response) {
  res.json({ resident: await service.getById(req.params.id) });
}

export async function getMe(req: Request, res: Response) {
  res.json({ resident: await service.getByUserId(actorId(req)) });
}

export async function create(req: Request, res: Response) {
  const resident = await service.create(req.body, actorId(req));
  res.status(201).json({ resident });
}

export async function update(req: Request, res: Response) {
  const resident = await service.update(req.params.id, req.body, actorId(req));
  res.json({ resident });
}

export async function approve(req: Request, res: Response) {
  const resident = await service.setApproval(req.params.id, req.body, actorId(req));
  res.json({ resident });
}
