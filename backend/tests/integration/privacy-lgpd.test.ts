import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { eraseMyData, exportMyData } from '@/modules/privacy/privacy.service';
import { accept } from '@/modules/invitations/invitations.service';
import { asTenant, createCondo, prisma, resetDb } from './helpers';
import type { AuthUser } from '@/types/express';

/**
 * LGPD (P0.3) — direitos do titular: acesso/portabilidade (export) e
 * eliminação/anonimização (esquecimento), além do registro de consentimento
 * no onboarding.
 */
describe('LGPD — dados do titular', () => {
  let condo: string;
  let userId: string;
  let residentId: string;
  let auth: AuthUser;

  beforeAll(() => prisma.$connect());
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
    condo = await createCondo('Condo LGPD');
    await asTenant(condo, async () => {
      const user = await prisma.user.create({
        data: { name: 'Maria', email: 'maria@lgpd.test', passwordHash: 'x', role: 'MORADOR' } as Prisma.UserUncheckedCreateInput,
      });
      const apt = await prisma.apartment.create({ data: { number: '101' } as Prisma.ApartmentUncheckedCreateInput });
      const resident = await prisma.resident.create({
        data: {
          apartmentId: apt.id,
          userId: user.id,
          fullName: 'Maria Silva',
          cpf: '39053344705',
          email: 'maria@lgpd.test',
          phone: '11999990000',
        } as Prisma.ResidentUncheckedCreateInput,
      });
      await prisma.vehicle.create({ data: { residentId: resident.id, plate: 'ABC1D23' } as Prisma.VehicleUncheckedCreateInput });
      await prisma.charge.create({
        data: { apartmentId: apt.id, residentId: resident.id, description: 'Taxa', amount: new Prisma.Decimal(450), dueDate: new Date() } as Prisma.ChargeUncheckedCreateInput,
      });
      await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: 'hash-' + user.id, expiresAt: new Date(Date.now() + 1e9) } });
      userId = user.id;
      residentId = resident.id;
    });
    auth = { id: userId, role: 'MORADOR', condominiumId: condo };
  });

  it('exporta os dados pessoais do titular', async () => {
    const data = await asTenant(condo, () => exportMyData(auth));
    expect(data.account).toMatchObject({ email: 'maria@lgpd.test', role: 'MORADOR' });
    expect((data.resident as { fullName: string; cpf: string }).fullName).toBe('Maria Silva');
    expect((data.resident as { vehicles: unknown[] }).vehicles).toHaveLength(1);
    expect((data.resident as { charges: unknown[] }).charges).toHaveLength(1);
  });

  it('anonimiza o titular e revoga o acesso (direito ao esquecimento)', async () => {
    await asTenant(condo, () => eraseMyData(auth, {}));

    const resident = await asTenant(condo, () => prisma.resident.findFirst({ where: { id: residentId } }));
    expect(resident?.fullName).toBe('[Titular removido]');
    expect(resident?.cpf).toBe(`REMOVIDO-${residentId}`);
    expect(resident?.email).toBeNull();
    expect(resident?.status).toBe('INACTIVE');

    const user = await asTenant(condo, () => prisma.user.findFirst({ where: { id: userId } }));
    expect(user?.isActive).toBe(false);
    expect(user?.email).toBe(`removido-${userId}@deleted.local`);

    // PII direta removida; sessões revogadas.
    expect(await prisma.vehicle.count({ where: { residentId } })).toBe(0);
    const tokens = await prisma.refreshToken.findMany({ where: { userId } });
    expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
  });

  it('preserva registros financeiros (retenção legal) após a anonimização', async () => {
    await asTenant(condo, () => eraseMyData(auth, {}));
    // A cobrança permanece (desvinculada de PII), atendendo à retenção obrigatória.
    expect(await asTenant(condo, () => prisma.charge.count({ where: { residentId } }))).toBe(1);
  });
});

describe('LGPD — consentimento no onboarding', () => {
  beforeAll(() => prisma.$connect());
  afterAll(() => resetDb());

  beforeEach(() => resetDb());

  it('registra aceite de Termos e Privacidade ao aceitar o convite', async () => {
    const condo = await createCondo('Condo Consent');
    await asTenant(condo, () =>
      prisma.invitation.create({
        data: {
          condominiumId: condo,
          email: 'novo@consent.test',
          name: 'Novo Morador',
          role: 'MORADOR',
          token: 'tok-consent-123456',
          expiresAt: new Date(Date.now() + 1e9),
        } as Prisma.InvitationUncheckedCreateInput,
      }),
    );

    const res = await accept('tok-consent-123456', 'senhaSegura1', { ipAddress: '127.0.0.1' });

    const consents = await prisma.consentRecord.findMany({ where: { userId: res.user.id } });
    expect(consents.map((c) => c.document).sort()).toEqual(['PRIVACY_POLICY', 'TERMS_OF_USE']);
    expect(consents.every((c) => c.ipAddress === '127.0.0.1')).toBe(true);
  });
});
