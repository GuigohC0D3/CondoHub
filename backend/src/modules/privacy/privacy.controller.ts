import { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import * as service from './privacy.service';

function user(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

/** Exporta os dados pessoais do titular como JSON para download. */
export async function exportData(req: Request, res: Response) {
  const data = await service.exportMyData(user(req));
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="meus-dados-condohub.json"');
  res.send(JSON.stringify(data, null, 2));
}

/** Anonimiza os dados do titular (direito ao esquecimento). */
export async function erasure(req: Request, res: Response) {
  const result = await service.eraseMyData(user(req), {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  });
  res.json(result);
}
