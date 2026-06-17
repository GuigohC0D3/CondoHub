import { Request, Response } from 'express';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/errors';
import * as service from './assemblies.service';
import { buildMinutesPdf } from './assemblies.minutes';

function user(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

// ---- Convocação ----
export async function list(req: Request, res: Response) {
  res.json(await service.listAssemblies(req.query as never));
}
export async function get(req: Request, res: Response) {
  res.json({ assembly: await service.getAssembly(req.params.id, user(req)) });
}
export async function create(req: Request, res: Response) {
  res.status(201).json({ assembly: await service.createAssembly(req.body, user(req)) });
}
export async function update(req: Request, res: Response) {
  res.json({ assembly: await service.updateAssembly(req.params.id, req.body, user(req)) });
}
export async function schedule(req: Request, res: Response) {
  res.json({ assembly: await service.scheduleAssembly(req.params.id, user(req)) });
}
export async function open(req: Request, res: Response) {
  res.json({ assembly: await service.openAssembly(req.params.id, user(req)) });
}
export async function close(req: Request, res: Response) {
  res.json({ assembly: await service.closeAssembly(req.params.id, user(req)) });
}
export async function cancel(req: Request, res: Response) {
  res.json({ assembly: await service.cancelAssembly(req.params.id, user(req)) });
}

// ---- Itens ----
export async function addItem(req: Request, res: Response) {
  res.status(201).json({ item: await service.addItem(req.params.id, req.body, user(req)) });
}
export async function updateItem(req: Request, res: Response) {
  res.json({ item: await service.updateItem(req.params.id, req.params.itemId, req.body, user(req)) });
}
export async function removeItem(req: Request, res: Response) {
  await service.removeItem(req.params.id, req.params.itemId, user(req));
  res.status(204).send();
}
export async function openItem(req: Request, res: Response) {
  res.json({ item: await service.openItem(req.params.id, req.params.itemId, user(req)) });
}
export async function closeItem(req: Request, res: Response) {
  res.json({ result: await service.closeItem(req.params.id, req.params.itemId, user(req)) });
}

// ---- Participação ----
export async function checkin(req: Request, res: Response) {
  res.status(201).json(await service.checkin(req.params.id, user(req), req.body?.apartmentId));
}
export async function vote(req: Request, res: Response) {
  res.status(201).json({ vote: await service.vote(req.params.id, req.params.itemId, req.body, user(req)) });
}
export async function results(req: Request, res: Response) {
  res.json(await service.results(req.params.id, user(req)));
}

// ---- Ata (PDF) ----
export async function minutes(req: Request, res: Response) {
  const u = user(req);
  const condo = await prisma.condominium.findUnique({ where: { id: u.condominiumId! }, select: { name: true } });
  const buf = await buildMinutesPdf(req.params.id, condo?.name ?? 'Condomínio');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ata-${req.params.id}.pdf"`);
  res.send(buf);
}
