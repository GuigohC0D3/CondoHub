import { execSync } from 'node:child_process';

/**
 * Garante o schema do banco de teste antes da suíte de integração.
 * `migrate deploy` é idempotente — só aplica migrações pendentes.
 */
export default function setup() {
  // globalSetup roda no processo principal (sem o test.env dos workers) → resolve a mesma URL.
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgresql://condohub:condohub@localhost:5544/condohub_test?schema=public';
  if (!url || !/test/i.test(url)) {
    throw new Error(
      `DATABASE_URL de teste suspeita ("${url}"). Aponte para um banco DEDICADO de teste — a suíte trunca tabelas.`,
    );
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
