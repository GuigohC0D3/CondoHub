import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    // Unitários (sem banco). A suíte de integração roda em vitest.integration.config.ts.
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Valores dummy para o env.ts validar ao importar módulos da app (não há conexão real).
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test?schema=public',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
      PAYMENTS_WEBHOOK_SECRET: 'sandbox-webhook-secret',
    },
  },
});
