import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { closeQueue, startWorker } from '@/lib/queue';
import { flushObservability, initObservability, reportError } from '@/lib/observability';

async function main() {
  initObservability();

  // Falhas não tratadas: reporta antes de seguir (evita morte silenciosa).
  process.on('unhandledRejection', (reason) => reportError(reason, { kind: 'unhandledRejection' }));
  process.on('uncaughtException', (err) => {
    reportError(err, { kind: 'uncaughtException' });
    void flushObservability().finally(() => process.exit(1));
  });

  const app = createApp();
  startWorker();
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 CondoHub API on :${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    server.close();
    await Promise.allSettled([closeQueue(), prisma.$disconnect(), redis.quit(), flushObservability()]);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
