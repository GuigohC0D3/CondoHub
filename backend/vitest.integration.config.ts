import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Suíte de integração: exige um Postgres de teste real (exercita a extensão de
 * tenant do Prisma). Use um banco DEDICADO — os testes truncam tabelas.
 *
 * Banco: TEST_DATABASE_URL ou o default abaixo (mesmo Postgres do Docker, db `condohub_test`).
 * Pré-requisito: `prisma migrate deploy` aplicado (o globalSetup garante isso).
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://condohub:condohub@localhost:5544/condohub_test?schema=public';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/integration/global-setup.ts'],
    fileParallelism: false, // compartilham o mesmo banco — evita corrida entre arquivos
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      // Defaults para o env.ts validar sem depender de um .env presente (ex.: CI).
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6380',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-0123456789',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-0123456789',
      QUEUE_ENABLED: 'false',
    },
  },
});
