import { Queue, Worker, type Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { runWithTenant } from '@/lib/tenant-context';
import { sendEmail } from '@/lib/email';

/**
 * Fila de jobs assíncronos (BullMQ sobre Redis). Desacopla trabalho pesado do
 * request: fan-out de avisos, envio de e-mail, geração de relatórios.
 * Em produção o Worker roda em processo dedicado; aqui sobe no mesmo processo
 * (escala pequena). Se QUEUE_ENABLED=false, os jobs executam inline.
 */

export type JobPayload = {
  'notice.fanout': { condominiumId: string; noticeId: string; title: string };
  'email.send': { to: string; subject: string; html: string; text?: string };
};

type JobName = keyof JobPayload;

const connection = { url: env.REDIS_URL };
const QUEUE_NAME = 'condohub';

const queue = env.QUEUE_ENABLED
  ? new Queue(QUEUE_NAME, { connection: { url: env.REDIS_URL } })
  : null;

// ---- Processadores ----

const processors: { [K in JobName]: (data: JobPayload[K]) => Promise<void> } = {
  async 'notice.fanout'({ condominiumId, noticeId, title }) {
    await runWithTenant({ condominiumId, userId: null }, async () => {
      const recipients = await prisma.user.findMany({
        where: { role: 'MORADOR', isActive: true },
        select: { id: true },
      });
      if (!recipients.length) return;
      await prisma.notification.createMany({
        // condominiumId injetado pela extensão de tenant.
        data: recipients.map((u) => ({
          userId: u.id,
          type: 'NOTICE' as const,
          title: 'Novo aviso',
          body: title,
          linkUrl: '/avisos',
        })) as Prisma.NotificationCreateManyInput[],
      });
      logger.info({ noticeId, count: recipients.length }, 'notice.fanout concluído');
    });
  },

  async 'email.send'(data) {
    await sendEmail(data);
  },
};

export async function enqueue<K extends JobName>(name: K, data: JobPayload[K]): Promise<void> {
  if (queue) {
    await queue.add(name, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    return;
  }
  // Fallback inline (sem fila).
  await processors[name](data);
}

let worker: Worker | null = null;

export function startWorker(): void {
  if (!env.QUEUE_ENABLED) return;
  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const handler = processors[job.name as JobName];
      if (!handler) throw new Error(`Job desconhecido: ${job.name}`);
      await handler(job.data);
    },
    { connection: { url: env.REDIS_URL }, concurrency: 5 },
  );
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Job falhou'));
  logger.info('Worker de filas iniciado');
  void connection;
}

export async function closeQueue(): Promise<void> {
  await Promise.allSettled([queue?.close(), worker?.close()]);
}
