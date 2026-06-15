import { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import * as service from './common-areas.service';

function actorId(req: Request): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.id;
}

export async function list(req: Request, res: Response) {
  // Síndico pode ver inativas; morador só ativas.
  const includeInactive = req.user?.role === 'SINDICO' && req.query.all === 'true';
  res.json({ commonAreas: await service.list(includeInactive) });
}

export async function getOne(req: Request, res: Response) {
  res.json({ commonArea: await service.getById(req.params.id) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ commonArea: await service.create(req.body, actorId(req)) });
}

export async function update(req: Request, res: Response) {
  res.json({ commonArea: await service.update(req.params.id, req.body, actorId(req)) });
}
