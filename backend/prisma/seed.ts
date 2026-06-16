import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

// Seed usa o client BASE (sem extensão de tenant) — bootstrap cross-tenant.
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('changeme123', { type: argon2.argon2id });

  // 1. SUPER_ADMIN da plataforma (sem tenant).
  // condominiumId null não é endereçável pelo unique composto → findFirst + create.
  const adminExists = await prisma.user.findFirst({
    where: { email: 'admin@condohub.com.br', condominiumId: null },
  });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        name: 'Platform Admin',
        email: 'admin@condohub.com.br',
        passwordHash,
        role: 'SUPER_ADMIN',
        condominiumId: null,
      },
    });
  }

  // 2. Condomínio demo + assinatura + síndico
  const condo = await prisma.condominium.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Condomínio Demo',
      slug: 'demo',
      city: 'São Paulo',
      state: 'SP',
      subscription: {
        create: {
          plan: 'PROFISSIONAL',
          status: 'TRIALING',
          maxUnits: 100,
          pricePerMonth: 249,
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  // Helper idempotente para usuários do tenant.
  const ensureUser = async (email: string, name: string, role: 'SINDICO' | 'MORADOR' | 'PORTEIRO') => {
    const found = await prisma.user.findFirst({ where: { email, condominiumId: condo.id } });
    if (found) return found;
    return prisma.user.create({ data: { name, email, passwordHash, role, condominiumId: condo.id } });
  };

  await ensureUser('sindico@demo.com.br', 'Síndico Demo', 'SINDICO');
  const morador = await ensureUser('morador@demo.com.br', 'João Morador', 'MORADOR');
  await ensureUser('porteiro@demo.com.br', 'Carlos Porteiro', 'PORTEIRO');

  // 3. Dados de exemplo (estrutura, morador, área comum, aviso, financeiro)
  const block = await prisma.block.upsert({
    where: { condominiumId_name: { condominiumId: condo.id, name: 'Bloco A' } },
    update: {},
    create: { condominiumId: condo.id, name: 'Bloco A' },
  });
  const apt = await prisma.apartment.upsert({
    where: { condominiumId_blockId_number: { condominiumId: condo.id, blockId: block.id, number: '101' } },
    update: {},
    create: { condominiumId: condo.id, blockId: block.id, number: '101', floor: 1 },
  });
  await prisma.apartment.upsert({
    where: { condominiumId_blockId_number: { condominiumId: condo.id, blockId: block.id, number: '102' } },
    update: {},
    create: { condominiumId: condo.id, blockId: block.id, number: '102', floor: 1 },
  });

  await prisma.resident.upsert({
    where: { condominiumId_cpf: { condominiumId: condo.id, cpf: '39053344705' } },
    update: { status: 'APPROVED', userId: morador.id, apartmentId: apt.id },
    create: {
      condominiumId: condo.id, apartmentId: apt.id, userId: morador.id,
      fullName: 'João Morador', cpf: '39053344705', status: 'APPROVED', occupancy: 'OWNER',
    },
  });

  const areaCount = await prisma.commonArea.count({ where: { condominiumId: condo.id } });
  if (areaCount === 0) {
    await prisma.commonArea.createMany({
      data: [
        { condominiumId: condo.id, name: 'Salão de Festas', approvalMode: 'MANUAL', maxPerMonthPerResident: 2 },
        { condominiumId: condo.id, name: 'Churrasqueira', approvalMode: 'AUTOMATIC', maxPerMonthPerResident: 4 },
      ],
    });
  }

  const noticeCount = await prisma.notice.count({ where: { condominiumId: condo.id } });
  if (noticeCount === 0) {
    const sindico = await prisma.user.findFirstOrThrow({ where: { email: 'sindico@demo.com.br', condominiumId: condo.id } });
    await prisma.notice.create({
      data: { condominiumId: condo.id, authorId: sindico.id, title: 'Bem-vindo ao CondoHub', body: 'Este é um aviso de exemplo.', isPinned: true },
    });
  }

  const revenueCount = await prisma.revenue.count({ where: { condominiumId: condo.id } });
  if (revenueCount === 0) {
    const now = new Date();
    const m = (d: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), d));
    await prisma.revenue.createMany({
      data: [{ condominiumId: condo.id, description: 'Taxa condominial', amount: 5000, receivedAt: m(5) }],
    });
    await prisma.expense.createMany({
      data: [
        { condominiumId: condo.id, description: 'Energia elétrica', amount: 1200, dueDate: m(10) },
        { condominiumId: condo.id, description: 'Limpeza', amount: 800, dueDate: m(15) },
      ],
    });
  }

  // eslint-disable-next-line no-console
  console.log('✅ Seed concluído.');
  console.log('   SUPER_ADMIN: admin@condohub.com.br / changeme123 (sem slug)');
  console.log('   SÍNDICO:     sindico@demo.com.br / changeme123 (slug: demo)');
  console.log('   MORADOR:     morador@demo.com.br / changeme123 (slug: demo)');
  console.log('   PORTEIRO:    porteiro@demo.com.br / changeme123 (slug: demo)');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
