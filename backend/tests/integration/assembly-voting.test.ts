import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { asTenant, createCondo, prisma, resetDb } from './helpers';

/**
 * Integridade do voto em assembleia (P0.1) — a regra "uma unidade, um voto por
 * item" precisa ser garantida no banco (não só na aplicação), senão uma corrida
 * permitiria voto em dobro e fraudaria a apuração.
 */
describe('Voto único por unidade na assembleia', () => {
  let condo: string;
  let itemId: string;
  let aptA: string;
  let aptB: string;

  beforeAll(() => prisma.$connect());
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
    condo = await createCondo('Condo V');
    await asTenant(condo, async () => {
      const a = await prisma.apartment.create({ data: { number: '101' } as Prisma.ApartmentUncheckedCreateInput });
      const b = await prisma.apartment.create({ data: { number: '102' } as Prisma.ApartmentUncheckedCreateInput });
      aptA = a.id;
      aptB = b.id;
      const assembly = await prisma.assembly.create({
        data: {
          title: 'AGE',
          notice: 'Edital de teste',
          scheduledFor: new Date(),
          status: 'OPEN',
          items: { create: [{ title: 'Item 1', status: 'OPEN' }] },
        } as Prisma.AssemblyUncheckedCreateInput,
        include: { items: true },
      });
      itemId = assembly.items[0].id;
    });
  });

  const vote = (apartmentId: string, choice: 'YES' | 'NO') =>
    prisma.assemblyVote.create({
      data: { itemId, apartmentId, choice, weight: new Prisma.Decimal(1) } as Prisma.AssemblyVoteUncheckedCreateInput,
    });

  it('rejeita um segundo voto da mesma unidade no mesmo item (P2002)', async () => {
    await vote(aptA, 'YES');
    await expect(vote(aptA, 'NO')).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.assemblyVote.count({ where: { itemId } })).toBe(1);
  });

  it('permite uma unidade diferente votar no mesmo item', async () => {
    await vote(aptA, 'YES');
    await vote(aptB, 'NO');
    expect(await prisma.assemblyVote.count({ where: { itemId } })).toBe(2);
  });

  it('a mesma unidade pode trocar o voto via upsert (mantém um único registro)', async () => {
    await vote(aptA, 'YES');
    await prisma.assemblyVote.upsert({
      where: { itemId_apartmentId: { itemId, apartmentId: aptA } },
      update: { choice: 'NO' },
      create: { itemId, apartmentId: aptA, choice: 'NO', weight: new Prisma.Decimal(1) } as Prisma.AssemblyVoteUncheckedCreateInput,
    });
    const votes = await prisma.assemblyVote.findMany({ where: { itemId } });
    expect(votes).toHaveLength(1);
    expect(votes[0].choice).toBe('NO');
  });
});
