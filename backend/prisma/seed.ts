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

  const sindicoExists = await prisma.user.findFirst({
    where: { email: 'sindico@demo.com.br', condominiumId: condo.id },
  });
  if (!sindicoExists) {
    await prisma.user.create({
      data: {
        name: 'Síndico Demo',
        email: 'sindico@demo.com.br',
        passwordHash,
        role: 'SINDICO',
        condominiumId: condo.id,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('✅ Seed concluído.');
  console.log('   SUPER_ADMIN: admin@condohub.com.br / changeme123 (sem slug)');
  console.log('   SÍNDICO:     sindico@demo.com.br / changeme123 (slug: demo)');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
