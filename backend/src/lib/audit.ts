import { Prisma } from '@/lib/prisma';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface AuditInput {
  userId: string | null;
  action: string; // ex. "resident.approve"
  entity: string; // ex. "Resident"
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

/**
 * Registra trilha de auditoria. condominiumId é injetado pela extensão de tenant.
 * Nunca lança — auditoria não deve derrubar a operação de negócio.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
      },
    });
  } catch (err) {
    logger.warn({ err, action: input.action }, 'Falha ao gravar auditoria');
  }
}
