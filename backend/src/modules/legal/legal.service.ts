import type { ConsentDocument } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { CURRENT_VERSIONS, LEGAL_DOCUMENTS } from './legal.content';

export interface ConsentMeta {
  ipAddress?: string;
  userAgent?: string;
}

// Aceita tanto o client estendido quanto um client de transação ($transaction).
type Db = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/** Documentos legais correntes (texto + versão) — público. */
export function getDocuments() {
  return Object.values(LEGAL_DOCUMENTS);
}

/**
 * Registra o aceite dos documentos legais nas versões correntes.
 * Idempotente por (usuário, documento, versão) — reaceitar a mesma versão não duplica.
 * Pode rodar dentro de uma transação (passe `client`).
 */
export async function recordConsent(
  userId: string,
  documents: ConsentDocument[],
  meta: ConsentMeta = {},
  client: Db = prisma,
): Promise<void> {
  for (const document of documents) {
    const version = CURRENT_VERSIONS[document];
    const already = await client.consentRecord.findFirst({ where: { userId, document, version }, select: { id: true } });
    if (already) continue;
    await client.consentRecord.create({
      data: { userId, document, version, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
    });
  }
}

/** Consentimentos registrados do usuário (mais recentes primeiro). */
export function getUserConsents(userId: string) {
  return prisma.consentRecord.findMany({ where: { userId }, orderBy: { acceptedAt: 'desc' } });
}

/** Indica se o usuário aceitou as versões correntes de termos e privacidade. */
export async function hasCurrentConsent(userId: string): Promise<boolean> {
  const count = await prisma.consentRecord.count({
    where: {
      userId,
      OR: [
        { document: 'TERMS_OF_USE', version: CURRENT_VERSIONS.TERMS_OF_USE },
        { document: 'PRIVACY_POLICY', version: CURRENT_VERSIONS.PRIVACY_POLICY },
      ],
    },
  });
  return count >= 2;
}
