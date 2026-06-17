import { Prisma, PrismaClient } from '@prisma/client';
import { getTenantContext } from '@/lib/tenant-context';

/**
 * Modelos que possuem a coluna `condominiumId` e DEVEM ser escopados por tenant.
 * Mantenha em sincronia com o schema.prisma.
 */
const TENANT_MODELS = new Set<string>([
  'User',
  'Block',
  'Apartment',
  'Resident',
  'Notice',
  'CommonArea',
  'Reservation',
  'Expense',
  'Revenue',
  'Ticket',
  'Visitor',
  'Package',
  'Notification',
  'AuditLog',
  'ExpenseCategory',
  'Subscription',
  'Invitation',
  'Charge',
  'ChargeBatch',
]);

// findUnique/findUniqueOrThrow NÃO entram aqui: o Prisma só aceita campos únicos
// no where. Lookups por id global devem usar findFirst (escopado por esta extensão)
// ou validar o tenant com assertSameTenant() após carregar o recurso.
const READ_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);
const UPDATE_DELETE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

const base = new PrismaClient({
  log: ['warn', 'error'],
});

/**
 * Extensão de tenancy (defesa em profundidade):
 * - Injeta `where.condominiumId` em leituras/updates/deletes.
 * - Injeta `data.condominiumId` em creates.
 * SUPER_ADMIN / jobs usam bypassTenant=true para acesso cross-tenant.
 */
export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const ctx = getTenantContext();

        // Sem contexto, ou bypass explícito, ou modelo não-tenant → segue direto.
        if (!ctx || ctx.bypassTenant || !model || !TENANT_MODELS.has(model)) {
          return query(args);
        }

        const condominiumId = ctx.condominiumId;
        if (!condominiumId) {
          throw new Error(
            `Tenant scope required for ${model}.${operation} but no condominiumId in context`,
          );
        }

        const a = (args ?? {}) as Record<string, unknown>;

        if (READ_OPS.has(operation) || UPDATE_DELETE_OPS.has(operation)) {
          a.where = { ...(a.where as object), condominiumId };
        } else if (operation === 'create') {
          a.data = { ...(a.data as object), condominiumId };
        } else if (operation === 'createMany') {
          const data = a.data as Record<string, unknown> | Record<string, unknown>[];
          a.data = Array.isArray(data)
            ? data.map((d) => ({ ...d, condominiumId }))
            : { ...data, condominiumId };
        } else if (operation === 'upsert') {
          a.where = { ...(a.where as object), condominiumId };
          a.create = { ...(a.create as object), condominiumId };
        }

        return query(a as typeof args);
      },
    },
  },
});

export type ExtendedPrisma = typeof prisma;
export { Prisma };
