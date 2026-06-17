import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { asSuperAdmin, asTenant, createCondo, prisma, resetDb } from './helpers';

/**
 * Isolamento multi-tenant (P0.1) — o risco mais grave de um SaaS multi-tenant é
 * um condomínio enxergar/alterar dados de outro. Estes testes exercitam a
 * extensão de tenant do Prisma (scoping por condominiumId via AsyncLocalStorage).
 */
describe('Isolamento multi-tenant', () => {
  let condoA: string;
  let condoB: string;

  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
    condoA = await createCondo('Condo A');
    condoB = await createCondo('Condo B');
  });

  it('leitura (findMany/count) é escopada ao tenant do contexto', async () => {
    await asTenant(condoA, async () => {
      await prisma.block.create({ data: { name: 'A-1' } as Prisma.BlockUncheckedCreateInput });
      await prisma.block.create({ data: { name: 'A-2' } as Prisma.BlockUncheckedCreateInput });
    });
    await asTenant(condoB, async () => {
      await prisma.block.create({ data: { name: 'B-1' } as Prisma.BlockUncheckedCreateInput });
    });

    const aBlocks = await asTenant(condoA, () => prisma.block.findMany());
    const bBlocks = await asTenant(condoB, () => prisma.block.findMany());

    expect(aBlocks.map((b) => b.name).sort()).toEqual(['A-1', 'A-2']);
    expect(bBlocks.map((b) => b.name)).toEqual(['B-1']);
    expect(await asTenant(condoA, () => prisma.block.count())).toBe(2);
    expect(await asTenant(condoB, () => prisma.block.count())).toBe(1);
  });

  it('não lê recurso de outro tenant nem pelo id global (findFirst)', async () => {
    const blockA = await asTenant(condoA, () =>
      prisma.block.create({ data: { name: 'A-secreto' } as Prisma.BlockUncheckedCreateInput }),
    );

    const fromB = await asTenant(condoB, () => prisma.block.findFirst({ where: { id: blockA.id } }));
    const fromA = await asTenant(condoA, () => prisma.block.findFirst({ where: { id: blockA.id } }));

    expect(fromB).toBeNull(); // tenant B não enxerga o recurso de A
    expect(fromA?.id).toBe(blockA.id);
  });

  it('update cross-tenant não afeta o recurso de outro tenant', async () => {
    const blockA = await asTenant(condoA, () =>
      prisma.block.create({ data: { name: 'original' } as Prisma.BlockUncheckedCreateInput }),
    );

    // updateMany a partir de B mirando o id de A → 0 linhas afetadas.
    const res = await asTenant(condoB, () =>
      prisma.block.updateMany({ where: { id: blockA.id }, data: { name: 'hackeado' } }),
    );
    expect(res.count).toBe(0);

    // update single a partir de B → não encontra (where recebe condominiumId=B).
    await expect(
      asTenant(condoB, () => prisma.block.update({ where: { id: blockA.id }, data: { name: 'hackeado' } })),
    ).rejects.toMatchObject({ code: 'P2025' });

    const after = await asTenant(condoA, () => prisma.block.findFirst({ where: { id: blockA.id } }));
    expect(after?.name).toBe('original'); // intacto
  });

  it('delete cross-tenant não remove o recurso de outro tenant', async () => {
    const blockA = await asTenant(condoA, () =>
      prisma.block.create({ data: { name: 'A-1' } as Prisma.BlockUncheckedCreateInput }),
    );

    const res = await asTenant(condoB, () => prisma.block.deleteMany({ where: { id: blockA.id } }));
    expect(res.count).toBe(0);

    expect(await asTenant(condoA, () => prisma.block.count())).toBe(1);
  });

  it('create injeta o tenant do contexto e ignora condominiumId forjado no payload', async () => {
    // Mesmo tentando forjar o condomínio de B, a extensão sobrescreve com o contexto (A).
    const created = await asTenant(condoA, () =>
      prisma.block.create({ data: { name: 'forjado', condominiumId: condoB } as Prisma.BlockUncheckedCreateInput }),
    );
    expect(created.condominiumId).toBe(condoA);

    expect(await asTenant(condoB, () => prisma.block.count())).toBe(0);
    expect(await asTenant(condoA, () => prisma.block.count())).toBe(1);
  });

  it('a mesma chave única coexiste em tenants diferentes (unicidade é por tenant)', async () => {
    // Apartment @@unique([condominiumId, blockId, number]) — "101" deve existir nos dois.
    const aptA = asTenant(condoA, () =>
      prisma.apartment.create({ data: { number: '101' } as Prisma.ApartmentUncheckedCreateInput }),
    );
    const aptB = asTenant(condoB, () =>
      prisma.apartment.create({ data: { number: '101' } as Prisma.ApartmentUncheckedCreateInput }),
    );
    await expect(Promise.all([aptA, aptB])).resolves.toHaveLength(2);

    expect(await asTenant(condoA, () => prisma.apartment.count())).toBe(1);
    expect(await asTenant(condoB, () => prisma.apartment.count())).toBe(1);
  });

  it('cadeia de relações (apartamento → morador) permanece isolada por tenant', async () => {
    await asTenant(condoA, async () => {
      const apt = await prisma.apartment.create({ data: { number: '10' } as Prisma.ApartmentUncheckedCreateInput });
      await prisma.resident.create({
        data: { apartmentId: apt.id, fullName: 'Morador A', cpf: '11111111111' } as Prisma.ResidentUncheckedCreateInput,
      });
    });
    await asTenant(condoB, async () => {
      const apt = await prisma.apartment.create({ data: { number: '20' } as Prisma.ApartmentUncheckedCreateInput });
      await prisma.resident.create({
        data: { apartmentId: apt.id, fullName: 'Morador B', cpf: '22222222222' } as Prisma.ResidentUncheckedCreateInput,
      });
    });

    const residentsB = await asTenant(condoB, () => prisma.resident.findMany());
    expect(residentsB.map((r) => r.fullName)).toEqual(['Morador B']);
    // CPF idêntico forjado de A não vaza para B.
    expect(await asTenant(condoB, () => prisma.resident.findFirst({ where: { fullName: 'Morador A' } }))).toBeNull();
  });

  it('SUPER_ADMIN (bypassTenant) enxerga todos os tenants', async () => {
    await asTenant(condoA, () => prisma.block.create({ data: { name: 'A-1' } as Prisma.BlockUncheckedCreateInput }));
    await asTenant(condoB, () => prisma.block.create({ data: { name: 'B-1' } as Prisma.BlockUncheckedCreateInput }));

    const all = await asSuperAdmin(() => prisma.block.findMany());
    expect(all).toHaveLength(2);
  });
});
