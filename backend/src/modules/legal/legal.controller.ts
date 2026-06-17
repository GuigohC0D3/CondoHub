import { Request, Response } from 'express';
import { AppError } from '@/utils/errors';
import * as service from './legal.service';

function user(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

/** Documentos legais correntes — público (exibidos antes do aceite). */
export async function documents(_req: Request, res: Response) {
  res.json({ documents: service.getDocuments() });
}

/** Registra o aceite das versões correntes (re-consentimento dentro do app). */
export async function consent(req: Request, res: Response) {
  const u = user(req);
  await service.recordConsent(u.id, ['TERMS_OF_USE', 'PRIVACY_POLICY'], {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  });
  res.status(201).json({ consents: await service.getUserConsents(u.id) });
}

export async function myConsents(req: Request, res: Response) {
  res.json({ consents: await service.getUserConsents(user(req).id) });
}
