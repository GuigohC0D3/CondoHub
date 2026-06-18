import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { corsOrigins } from '@/config/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
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

  // Liveness: o processo está de pé (não checa dependências).
  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // Readiness: apto a receber tráfego (depende de DB + Redis). 503 se algo cair.
  app.get('/health/ready', async (_req, res) => {
    const checks = { db: false, redis: false };
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = true;
    } catch {
      /* db indisponível */
    }
    try {
      checks.redis = (await redis.ping()) === 'PONG';
    } catch {
      /* redis indisponível */
    }
    const ready = checks.db && checks.redis;
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable', checks });
  });

  // Rate limit global por IP. Autenticação é opt-in por rota (authenticate).
  app.use('/api', globalRateLimit);
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
