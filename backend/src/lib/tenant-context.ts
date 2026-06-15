import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  /** Tenant atual. null = contexto de plataforma (SUPER_ADMIN). */
  condominiumId: string | null;
  userId: string | null;
  /** Bypass do scoping de tenant — apenas para SUPER_ADMIN / jobs internos. */
  bypassTenant?: boolean;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

export function currentCondominiumId(): string | null {
  return storage.getStore()?.condominiumId ?? null;
}
