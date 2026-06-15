import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '@/utils/errors';

interface Schemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/** Valida e SUBSTITUI req.body/query/params pelos dados parseados (tipados/saneados). */
export const validate =
  (schemas: Schemas) => (req: Request, _res: Response, next: NextFunction) => {
    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        return next(
          new AppError('VALIDATION_ERROR', 'Dados inválidos', result.error.flatten().fieldErrors),
        );
      }
      req[key] = result.data as never;
    }
    next();
  };
