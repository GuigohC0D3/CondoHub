import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { corsOrigins } from '@/config/env';
import { logger } from '@/lib/logger';
import { apiRouter } from '@/routes';
import { globalRateLimit } from '@/middlewares/rate-limit';
import { errorHandler, notFoundHandler } from '@/middlewares/error';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // atrás de LB/reverse proxy (IP real p/ rate limit)
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // Rate limit global por IP. Autenticação é opt-in por rota (authenticate).
  app.use('/api', globalRateLimit);
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
