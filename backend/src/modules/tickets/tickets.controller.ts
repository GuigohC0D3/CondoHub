import { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import * as service from './tickets.service';

function user(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function list(req: Request, res: Response) {
  res.json(await service.list(req.query as never, user(req)));
}

export async function getOne(req: Request, res: Response) {
  res.json({ ticket: await service.getById(req.params.id, user(req)) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ ticket: await service.create(req.body, user(req)) });
}

export async function update(req: Request, res: Response) {
  res.json({ ticket: await service.update(req.params.id, req.body, user(req)) });
}

export async function addComment(req: Request, res: Response) {
  res.status(201).json({ comment: await service.addComment(req.params.id, req.body, user(req)) });
}

export async function addAttachment(req: Request, res: Response) {
  res.status(201).json({ attachment: await service.addAttachment(req.params.id, req.body, user(req)) });
}
