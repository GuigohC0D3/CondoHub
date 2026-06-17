import { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import * as service from './suggestions.service';

function user(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function list(req: Request, res: Response) {
  res.json(await service.list(req.query as never, user(req)));
}
export async function getOne(req: Request, res: Response) {
  res.json({ suggestion: await service.getById(req.params.id, user(req)) });
}
export async function create(req: Request, res: Response) {
  res.status(201).json({ suggestion: await service.create(req.body, user(req)) });
}
export async function update(req: Request, res: Response) {
  res.json({ suggestion: await service.update(req.params.id, req.body, user(req)) });
}
export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id, user(req));
  res.status(204).send();
}
export async function vote(req: Request, res: Response) {
  res.json(await service.toggleVote(req.params.id, user(req)));
}
export async function setStatus(req: Request, res: Response) {
  res.json({ suggestion: await service.setStatus(req.params.id, req.body, user(req)) });
}
