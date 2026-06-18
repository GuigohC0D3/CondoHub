import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { cancelAssembly, vote } from '@/modules/assemblies/assemblies.service';
import { asTenant, createCondo, prisma, resetDb } from './helpers';
import type { AuthUser } from '@/types/express';

/**
 * Regressão (code review): votos só podem ser registrados com a assembleia em
 * andamento. Cancelar/encerrar a assembleia deixava itens OPEN e o vote() só
 * checava o status do item — permitindo voto em assembleia cancelada.
 */
describe('Guarda de status no voto da assembleia', () => {
  let condo: string;
  let itemId: string;
  let assemblyId: string;
  let voter: AuthUser;
  let sindico: AuthUser;

  beforeAll(() => prisma.$connect());
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
    condo = await createCondo('Condo Vote');
    await asTenant(condo, async () => {
      const u = await prisma.user.create({
        data: { name: 'Votante', email: 'v@vote.test', passwordHash: 'x', role: 'MORADOR' } as Prisma.UserUncheckedCreateInput,
      });
      const s = await prisma.user.create({
        data: { name: 'Síndico', email: 's@vote.test', passwordHash: 'x', role: 'SINDICO' } as Prisma.UserUncheckedCreateInput,
      });
      const apt = await prisma.apartment.create({ data: { number: '101', idealFraction: new Prisma.Decimal(1) } as Prisma.ApartmentUncheckedCreateInput });
      await prisma.resident.create({
        data: { apartmentId: apt.id, userId: u.id, fullName: 'Votante', cpf: '39053344705' } as Prisma.ResidentUncheckedCreateInput,
      });
      const assembly = await prisma.assembly.create({
        data: {
          title: 'AGE', notice: 'Edital', scheduledFor: new Date(), status: 'OPEN',
          items: { create: [{ title: 'Item 1', status: 'OPEN' }] },
        } as Prisma.AssemblyUncheckedCreateInput,
        include: { items: true },
      });
      assemblyId = assembly.id;
      itemId = assembly.items[0].id;
      voter = { id: u.id, role: 'MORADOR', condominiumId: condo };
      sindico = { id: s.id, role: 'SINDICO', condominiumId: condo };
    });
  });

  it('aceita voto com a assembleia em andamento', async () => {
    const v = await asTenant(condo, () => vote(assemblyId, itemId, { choice: 'YES' }, voter));
    expect(v.choice).toBe('YES');
  });

  it('rejeita voto após a assembleia ser cancelada', async () => {
    await asTenant(condo, () => cancelAssembly(assemblyId, sindico));
    await expect(
      asTenant(condo, () => vote(assemblyId, itemId, { choice: 'YES' }, voter)),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(await prisma.assemblyVote.count({ where: { itemId } })).toBe(0);
  });
});
