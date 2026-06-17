import { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import * as service from './reservations.service';

function user(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function list(req: Request, res: Response) {
  res.json(await service.list(req.query as never, user(req)));
}

export async function getOne(req: Request, res: Response) {
  res.json({ reservation: await service.getById(req.params.id, user(req)) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ reservation: await service.create(req.body, user(req)) });
}

export async function approve(req: Request, res: Response) {
  res.json({ reservation: await service.setApproval(req.params.id, req.body, user(req)) });
}

export async function cancel(req: Request, res: Response) {
  res.json({ reservation: await service.cancel(req.params.id, user(req), req.body) });
}
