import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { closeQueue, startWorker } from '@/lib/queue';

async function main() {
  const app = createApp();
  startWorker();
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 CondoHub API on :${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    server.close();
    await Promise.allSettled([closeQueue(), prisma.$disconnect(), redis.quit()]);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
