import { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import * as service from './packages.service';

function user(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function list(req: Request, res: Response) {
  res.json(await service.list(req.query as never, user(req)));
}
export async function getOne(req: Request, res: Response) {
  res.json({ package: await service.getById(req.params.id, user(req)) });
}
export async function create(req: Request, res: Response) {
  res.status(201).json({ package: await service.create(req.body, user(req)) });
}
export async function pickup(req: Request, res: Response) {
  res.json({ package: await service.pickup(req.params.id, req.body, user(req)) });
}
