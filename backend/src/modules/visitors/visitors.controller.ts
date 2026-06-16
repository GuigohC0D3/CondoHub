import { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import * as service from './visitors.service';

function user(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function list(req: Request, res: Response) {
  res.json(await service.list(req.query as never, user(req)));
}
export async function getOne(req: Request, res: Response) {
  res.json({ visitor: await service.getById(req.params.id, user(req)) });
}
export async function create(req: Request, res: Response) {
  res.status(201).json({ visitor: await service.create(req.body, user(req)) });
}
export async function validateQr(req: Request, res: Response) {
  res.json({ visitor: await service.validateQr(req.params.qrCode) });
}
export async function checkIn(req: Request, res: Response) {
  res.json({ visitor: await service.checkIn(req.params.id, user(req), req.body?.photo) });
}
export async function checkOut(req: Request, res: Response) {
  res.json({ visitor: await service.checkOut(req.params.id, user(req)) });
}
export async function deny(req: Request, res: Response) {
  res.json({ visitor: await service.deny(req.params.id, user(req), req.body?.reason) });
}
