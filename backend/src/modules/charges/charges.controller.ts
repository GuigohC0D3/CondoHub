import { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import * as service from './charges.service';

function user(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function listCharges(req: Request, res: Response) {
  res.json(await service.listCharges(req.query as never));
}

export async function listMyCharges(req: Request, res: Response) {
  res.json(await service.listMyCharges(user(req), req.query as never));
}

export async function getCharge(req: Request, res: Response) {
  res.json({ charge: await service.getCharge(req.params.id) });
}

export async function createCharge(req: Request, res: Response) {
  res.status(201).json({ charge: await service.createCharge(req.body, user(req)) });
}

export async function cancelCharge(req: Request, res: Response) {
  res.json({ charge: await service.cancelCharge(req.params.id, user(req)) });
}

export async function createBatch(req: Request, res: Response) {
  res.status(201).json(await service.createBatch(req.body, user(req)));
}

export async function webhook(req: Request, res: Response) {
  const headers = req.headers as Record<string, string | undefined>;
  res.json(await service.handleWebhook(headers, req.body));
}
