import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/errors';
import type { AuthUser } from '@/types/express';

interface Meta {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Exportação dos dados pessoais do titular (LGPD art. 18, II/V — acesso e
 * portabilidade). Roda no contexto de tenant → tudo já é escopado ao condomínio.
 */
export async function exportMyData(user: AuthUser) {
  const account = await prisma.user.findFirst({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true, lastLoginAt: true },
  });

  const consents = await prisma.consentRecord.findMany({
    where: { userId: user.id },
    select: { document: true, version: true, acceptedAt: true, ipAddress: true },
    orderBy: { acceptedAt: 'desc' },
  });

  const resident = await prisma.resident.findFirst({
    where: { userId: user.id },
    include: {
      apartment: { select: { number: true, block: { select: { name: true } } } },
      vehicles: { select: { plate: true, model: true, color: true } },
      documents: { select: { fileName: true, uploadedAt: true } },
    },
  });

  let residentData: unknown = null;
  if (resident) {
    const [reservations, tickets, visitors, packages, charges, votes, suggestions] = await Promise.all([
      prisma.reservation.findMany({ where: { residentId: resident.id }, select: { startsAt: true, endsAt: true, status: true } }),
      prisma.ticket.findMany({ where: { residentId: resident.id }, select: { title: true, status: true, createdAt: true } }),
      prisma.visitor.findMany({ where: { residentId: resident.id }, select: { fullName: true, status: true, expectedAt: true } }),
      prisma.package.findMany({ where: { residentId: resident.id }, select: { description: true, status: true, receivedAt: true } }),
      prisma.charge.findMany({ where: { residentId: resident.id }, select: { description: true, amount: true, status: true, dueDate: true } }),
      prisma.assemblyVote.findMany({ where: { residentId: resident.id }, select: { choice: true, createdAt: true } }),
      prisma.suggestion.findMany({ where: { residentId: resident.id }, select: { title: true, status: true, createdAt: true } }),
    ]);
    residentData = {
      fullName: resident.fullName,
      cpf: resident.cpf,
      email: resident.email,
      phone: resident.phone,
      occupancy: resident.occupancy,
      apartment: resident.apartment,
      vehicles: resident.vehicles,
      documents: resident.documents,
      reservations,
      tickets,
      visitors,
      packages,
      charges,
      assemblyVotes: votes,
      suggestions,
    };
  }

  await audit({ userId: user.id, action: 'privacy.export', entity: 'User', entityId: user.id });
  return {
    exportedAt: new Date().toISOString(),
    account,
    consents,
    resident: residentData,
  };
}

/**
 * Direito ao esquecimento (LGPD art. 18, VI). Anonimiza os dados pessoais do
 * titular e desativa o acesso, preservando registros de retenção obrigatória
 * (financeiros/auditoria) já desvinculados de PII.
 */
export async function eraseMyData(user: AuthUser, meta: Meta) {
  const resident = await prisma.resident.findFirst({ where: { userId: user.id }, select: { id: true } });
  if (!resident) throw AppError.business('Apenas titulares com cadastro de morador podem solicitar a anonimização por aqui');

  await prisma.$transaction(async (tx) => {
    // Remove PII de coleções diretamente vinculadas ao titular.
    await tx.vehicle.deleteMany({ where: { residentId: resident.id } });
    await tx.residentDocument.deleteMany({ where: { residentId: resident.id } });
    await tx.visitor.deleteMany({ where: { residentId: resident.id } }); // PII de terceiros fornecida pelo titular

    // Anonimiza o cadastro de morador (CPF precisa permanecer único por tenant).
    await tx.resident.update({
      where: { id: resident.id },
      data: {
        fullName: '[Titular removido]',
        cpf: `REMOVIDO-${resident.id}`,
        email: null,
        phone: null,
        photoUrl: null,
        status: 'INACTIVE',
      },
    });

    // Desativa e anonimiza a conta de acesso (email único por tenant).
    await tx.user.update({
      where: { id: user.id },
      data: {
        name: '[Conta removida]',
        email: `removido-${user.id}@deleted.local`,
        phone: null,
        avatarUrl: null,
        isActive: false,
        passwordHash: 'ANONYMIZED',
      },
    });

    // Revoga todas as sessões ativas.
    await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  });

  await audit({
    userId: user.id,
    action: 'privacy.erasure',
    entity: 'Resident',
    entityId: resident.id,
    metadata: { ip: meta.ipAddress } as Prisma.InputJsonValue,
  });
  return { erased: true };
}
