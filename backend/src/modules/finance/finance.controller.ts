import { Request, Response } from 'express';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/errors';
import * as service from './finance.service';
import { buildReportPdf, buildReportXlsx } from './finance.reports';
import type { ReportQuery } from './finance.schemas';

function user(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function listCategories(_req: Request, res: Response) {
  res.json({ categories: await service.listCategories() });
}
export async function createCategory(req: Request, res: Response) {
  res.status(201).json({ category: await service.createCategory(req.body.name, user(req)) });
}

export async function listExpenses(req: Request, res: Response) {
  res.json(await service.listExpenses(req.query as never));
}
export async function createExpense(req: Request, res: Response) {
  res.status(201).json({ expense: await service.createExpense(req.body, user(req)) });
}
export async function updateExpense(req: Request, res: Response) {
  res.json({ expense: await service.updateExpense(req.params.id, req.body, user(req)) });
}
export async function removeExpense(req: Request, res: Response) {
  await service.removeExpense(req.params.id, user(req));
  res.status(204).send();
}

export async function listRevenues(req: Request, res: Response) {
  res.json(await service.listRevenues(req.query as never));
}
export async function createRevenue(req: Request, res: Response) {
  res.status(201).json({ revenue: await service.createRevenue(req.body, user(req)) });
}
export async function removeRevenue(req: Request, res: Response) {
  await service.removeRevenue(req.params.id, user(req));
  res.status(204).send();
}

export async function cashflow(req: Request, res: Response) {
  const year = Number((req.query as never as { year: number }).year);
  res.json(await service.cashflow(year));
}

export async function report(req: Request, res: Response) {
  const q = req.query as never as ReportQuery;
  const range = service.resolveReportRange(q);
  const data = await service.reportData(range);

  if (q.format === 'json') {
    res.json({ report: data });
    return;
  }

  const condo = await prisma.condominium.findUnique({
    where: { id: user(req).condominiumId! },
    select: { name: true },
  });
  const condoName = condo?.name ?? 'Condomínio';

  if (q.format === 'pdf') {
    const buf = await buildReportPdf(data, condoName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${data.period}.pdf"`);
    res.send(buf);
    return;
  }

  const buf = await buildReportXlsx(data, condoName);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-${data.period}.xlsx"`);
  res.send(buf);
}
