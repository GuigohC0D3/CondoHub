import { prisma } from '@/lib/prisma';
import { runWithTenant } from '@/lib/tenant-context';

/**
 * Executa uma função sob o contexto de tenant de um condomínio (como faria o
 * middleware de auth). O `await` interno garante que a query do Prisma (lazy)
 * seja executada DENTRO do contexto — igual ao fluxo real de uma requisição.
 */
export function asTenant<T>(condominiumId: string, fn: () => Promise<T>): Promise<T> {
  return runWithTenant({ condominiumId, userId: null }, async () => await fn());
}

/** Executa com bypass de tenant (SUPER_ADMIN / jobs internos). */
export function asSuperAdmin<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant({ condominiumId: null, userId: null, bypassTenant: true }, async () => await fn());
}

let slugSeq = 0;
/** Cria um condomínio (raiz de tenant, não escopado) e devolve o id. */
export async function createCondo(name: string): Promise<string> {
  const condo = await prisma.condominium.create({
    data: { name, slug: `${name.toLowerCase()}-${Date.now()}-${slugSeq++}` },
    select: { id: true },
  });
  return condo.id;
}

/**
 * Limpa o banco de teste. Trunca a raiz (cascateia para todas as tabelas de
 * tenant) e as tabelas cross-tenant (sem condominiumId, que não são cascateadas).
 */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Condominium", "WebhookEvent" RESTART IDENTITY CASCADE');
}

export { prisma };
