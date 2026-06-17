import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

// Seed usa o client BASE (sem extensão de tenant) — bootstrap cross-tenant.
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Gera um CPF válido (com dígitos verificadores) a partir de um índice. */
function makeCpf(seed: number): string {
  const base = String(seed % 1_000_000_000).padStart(9, '0').split('').map(Number);
  const digit = (digits: number[], startWeight: number) => {
    const sum = digits.reduce((acc, d, i) => acc + d * (startWeight - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = digit(base, 10);
  const d2 = digit([...base, d1], 11);
  return [...base, d1, d2].join('');
}

function makePlate(i: number): string {
  const L = (n: number) => String.fromCharCode(65 + (n % 26));
  return `${L(i)}${L(i + 7)}${L(i + 14)}${(i % 10)}${L(i + 3)}${(i % 100).toString().padStart(2, '0')}`;
}

const pick = <T>(arr: readonly T[], i: number): T => arr[i % arr.length];
const daysFromNow = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);

const FIRST = ['Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nelson', 'Olívia', 'Paulo', 'Rafaela', 'Sérgio', 'Tatiane', 'Vinícius'] as const;
const LAST = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Lima', 'Costa', 'Almeida', 'Gomes', 'Ribeiro'] as const;
const CARMODELS = ['Honda Civic', 'Toyota Corolla', 'VW Gol', 'Fiat Argo', 'Hyundai HB20', 'Jeep Renegade', 'Chevrolet Onix'] as const;
const COLORS = ['Preto', 'Branco', 'Prata', 'Cinza', 'Vermelho', 'Azul'] as const;
const CARRIERS = ['Correios', 'Mercado Livre', 'Amazon', 'Shopee', 'Jadlog', 'Total Express'] as const;

const TICKET_CATEGORIES = ['LEAK', 'CLEANING', 'NOISE', 'SECURITY', 'MAINTENANCE', 'OTHER'] as const;
const TICKET_STATUS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const TICKET_PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const TICKET_TITLES = ['Vazamento na garagem', 'Lâmpada queimada no hall', 'Barulho após 22h', 'Portão não abre', 'Infiltração no teto', 'Elevador parado', 'Vazamento de gás', 'Limpeza da escada'] as const;
const NOTIF_TYPES = ['NOTICE', 'RESERVATION', 'TICKET', 'PACKAGE', 'VISITOR', 'BILLING', 'SYSTEM'] as const;

// Quantidades — somam exatamente 300 registros (base + bulk). Ver log final.
const N = {
  residentUsers: 30,
  blocks: 4,
  apartments: 30,
  residents: 30,
  vehicles: 20,
  commonAreas: 4,
  reservations: 25,
  notices: 8,
  expenses: 20,
  revenues: 20,
  tickets: 25,
  ticketComments: 12,
  visitors: 20,
  packages: 20,
  notifications: 21,
  payments: 6,
};

async function main() {
  const passwordHash = await argon2.hash('changeme123', { type: argon2.argon2id });

  // 1. SUPER_ADMIN da plataforma (sem tenant) — idempotente.
  const adminExists = await prisma.user.findFirst({
    where: { email: 'admin@condohub.com.br', condominiumId: null },
  });
  if (!adminExists) {
    await prisma.user.create({
      data: { name: 'Platform Admin', email: 'admin@condohub.com.br', passwordHash, role: 'SUPER_ADMIN', condominiumId: null },
    });
  }

  // 2. Condomínio demo + assinatura — idempotente.
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
          trialEndsAt: daysFromNow(30),
        },
      },
    },
  });
  const subscription = await prisma.subscription.findUniqueOrThrow({ where: { condominiumId: condo.id } });

  // Usuários de staff (síndico/porteiro) — idempotente.
  const ensureUser = async (email: string, name: string, role: 'SINDICO' | 'PORTEIRO') => {
    const found = await prisma.user.findFirst({ where: { email, condominiumId: condo.id } });
    if (found) return found;
    return prisma.user.create({ data: { name, email, passwordHash, role, condominiumId: condo.id } });
  };
  const sindico = await ensureUser('sindico@demo.com.br', 'Síndico Demo', 'SINDICO');
  const porteiro = await ensureUser('porteiro@demo.com.br', 'Carlos Porteiro', 'PORTEIRO');

  // ---------------------------------------------------------------------------
  // 3. Limpa dados de domínio do tenant demo (recriação determinística).
  //    Ordem respeita FKs (filhos primeiro).
  // ---------------------------------------------------------------------------
  const cid = { condominiumId: condo.id };
  await prisma.notification.deleteMany({ where: cid });
  await prisma.package.deleteMany({ where: cid });
  await prisma.visitor.deleteMany({ where: cid });
  await prisma.reservation.deleteMany({ where: cid });
  await prisma.ticket.deleteMany({ where: cid }); // cascade: comments, attachments
  await prisma.notice.deleteMany({ where: cid }); // cascade: reads, attachments
  await prisma.resident.deleteMany({ where: cid }); // cascade: vehicles, docs, history
  await prisma.apartment.deleteMany({ where: cid });
  await prisma.block.deleteMany({ where: cid });
  await prisma.commonArea.deleteMany({ where: cid });
  await prisma.expense.deleteMany({ where: cid });
  await prisma.revenue.deleteMany({ where: cid });
  await prisma.payment.deleteMany({ where: { subscription: { condominiumId: condo.id } } });
  await prisma.user.deleteMany({ where: { condominiumId: condo.id, role: 'MORADOR' } });

  // ---------------------------------------------------------------------------
  // 4. Recria dados em massa.
  // ---------------------------------------------------------------------------

  // Blocks
  const blocks = await Promise.all(
    Array.from({ length: N.blocks }, (_, i) =>
      prisma.block.create({ data: { condominiumId: condo.id, name: `Bloco ${String.fromCharCode(65 + i)}` } }),
    ),
  );

  // Apartments (distribuídos pelos blocos)
  const apartments = await Promise.all(
    Array.from({ length: N.apartments }, (_, i) => {
      const block = blocks[i % blocks.length];
      const floor = Math.floor(i / blocks.length) + 1;
      const number = `${floor}0${(i % blocks.length) + 1}`;
      return prisma.apartment.create({ data: { condominiumId: condo.id, blockId: block.id, number, floor } });
    }),
  );

  // Resident users (logins de morador). morador@demo.com.br = morador #1.
  const residentUsers = await Promise.all(
    Array.from({ length: N.residentUsers }, (_, i) => {
      const name = `${pick(FIRST, i)} ${pick(LAST, i)}`;
      const email = i === 0 ? 'morador@demo.com.br' : `morador${i + 1}@demo.com.br`;
      return prisma.user.create({
        data: { name, email, passwordHash, role: 'MORADOR', condominiumId: condo.id, phone: `1199${String(i).padStart(4, '0')}1234` },
      });
    }),
  );

  // Residents (1:1 com user e apartamento)
  const residents = await Promise.all(
    Array.from({ length: N.residents }, (_, i) => {
      const user = residentUsers[i];
      const apt = apartments[i % apartments.length];
      const status = i % 7 === 0 ? 'PENDING' : 'APPROVED';
      return prisma.resident.create({
        data: {
          condominiumId: condo.id,
          apartmentId: apt.id,
          userId: user.id,
          fullName: user.name,
          cpf: makeCpf(10_000_000 + i * 137),
          email: user.email,
          phone: user.phone,
          occupancy: i % 3 === 0 ? 'TENANT' : 'OWNER',
          status: status as 'PENDING' | 'APPROVED',
          movedInAt: daysFromNow(-(i * 11 + 30)),
        },
      });
    }),
  );

  // Vehicles
  await Promise.all(
    Array.from({ length: N.vehicles }, (_, i) =>
      prisma.vehicle.create({
        data: { residentId: pick(residents, i).id, plate: makePlate(i), model: pick(CARMODELS, i), color: pick(COLORS, i) },
      }),
    ),
  );

  // Common areas
  const areaDefs = [
    { name: 'Salão de Festas', approvalMode: 'MANUAL', maxPerMonthPerResident: 2, capacity: 80, feeAmount: 150 },
    { name: 'Churrasqueira', approvalMode: 'AUTOMATIC', maxPerMonthPerResident: 4, capacity: 20, feeAmount: 50 },
    { name: 'Quadra Poliesportiva', approvalMode: 'AUTOMATIC', maxPerMonthPerResident: 8, capacity: 30, feeAmount: null },
    { name: 'Piscina', approvalMode: 'MANUAL', maxPerMonthPerResident: 6, capacity: 40, feeAmount: null },
  ] as const;
  const commonAreas = await Promise.all(
    areaDefs.slice(0, N.commonAreas).map((a) =>
      prisma.commonArea.create({
        data: {
          condominiumId: condo.id,
          name: a.name,
          approvalMode: a.approvalMode as 'MANUAL' | 'AUTOMATIC',
          maxPerMonthPerResident: a.maxPerMonthPerResident,
          capacity: a.capacity,
          feeAmount: a.feeAmount ?? undefined,
        },
      }),
    ),
  );

  // Reservations
  const RES_STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELED'] as const;
  await Promise.all(
    Array.from({ length: N.reservations }, (_, i) => {
      const startsAt = new Date(daysFromNow(i - 5).setHours(18, 0, 0, 0));
      const endsAt = new Date(new Date(startsAt).setHours(22, 0, 0, 0));
      return prisma.reservation.create({
        data: {
          condominiumId: condo.id,
          commonAreaId: pick(commonAreas, i).id,
          residentId: pick(residents, i).id,
          startsAt,
          endsAt,
          status: pick(RES_STATUS, i),
          notes: i % 4 === 0 ? 'Aniversário' : undefined,
        },
      });
    }),
  );

  // Notices
  await Promise.all(
    Array.from({ length: N.notices }, (_, i) =>
      prisma.notice.create({
        data: {
          condominiumId: condo.id,
          authorId: sindico.id,
          title: i === 0 ? 'Bem-vindo ao CondoHub' : `Comunicado ${i + 1}`,
          body: 'Este é um aviso de exemplo gerado pelo seed para fins de teste.',
          isPinned: i === 0,
          publishedAt: daysFromNow(-i),
        },
      }),
    ),
  );

  // Expenses
  await Promise.all(
    Array.from({ length: N.expenses }, (_, i) => {
      const descs = ['Energia elétrica', 'Água', 'Limpeza', 'Manutenção elevador', 'Jardinagem', 'Segurança', 'Internet portaria'];
      const due = daysFromNow(i - 10);
      return prisma.expense.create({
        data: {
          condominiumId: condo.id,
          description: pick(descs, i),
          amount: 500 + (i % 10) * 137,
          dueDate: due,
          paidAt: i % 3 === 0 ? due : undefined,
        },
      });
    }),
  );

  // Revenues
  await Promise.all(
    Array.from({ length: N.revenues }, (_, i) =>
      prisma.revenue.create({
        data: {
          condominiumId: condo.id,
          description: i % 2 === 0 ? 'Taxa condominial' : 'Fundo de reserva',
          amount: 300 + (i % 8) * 95,
          receivedAt: daysFromNow(-(i * 3)),
          category: i % 2 === 0 ? 'Condomínio' : 'Reserva',
        },
      }),
    ),
  );

  // Tickets
  const tickets = await Promise.all(
    Array.from({ length: N.tickets }, (_, i) => {
      const status = pick(TICKET_STATUS, i);
      return prisma.ticket.create({
        data: {
          condominiumId: condo.id,
          residentId: pick(residents, i).id,
          assigneeId: i % 2 === 0 ? sindico.id : porteiro.id,
          category: pick(TICKET_CATEGORIES, i),
          priority: pick(TICKET_PRIORITY, i),
          status,
          title: pick(TICKET_TITLES, i),
          description: 'Descrição do chamado gerada pelo seed para testes.',
          resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? daysFromNow(-i) : undefined,
          createdAt: daysFromNow(-(i + 1)),
        },
      });
    }),
  );

  // Ticket comments
  await Promise.all(
    Array.from({ length: N.ticketComments }, (_, i) =>
      prisma.ticketComment.create({
        data: {
          ticketId: pick(tickets, i).id,
          authorId: i % 2 === 0 ? sindico.id : porteiro.id,
          body: i % 2 === 0 ? 'Chamado em análise, equipe acionada.' : 'Atualização: serviço agendado.',
        },
      }),
    ),
  );

  // Visitors
  const VIS_STATUS = ['EXPECTED', 'CHECKED_IN', 'CHECKED_OUT', 'DENIED'] as const;
  await Promise.all(
    Array.from({ length: N.visitors }, (_, i) => {
      const status = pick(VIS_STATUS, i);
      return prisma.visitor.create({
        data: {
          condominiumId: condo.id,
          residentId: pick(residents, i).id,
          fullName: `${pick(FIRST, i + 3)} ${pick(LAST, i + 1)}`,
          document: makeCpf(20_000_000 + i * 211),
          qrCode: `qr-demo-${i}-${Math.random().toString(36).slice(2, 10)}`,
          status,
          expectedAt: daysFromNow(i % 5),
          expiresAt: daysFromNow((i % 5) + 1),
          checkedInAt: status === 'CHECKED_IN' || status === 'CHECKED_OUT' ? daysFromNow(0) : undefined,
          checkedOutAt: status === 'CHECKED_OUT' ? daysFromNow(0) : undefined,
          registeredBy: status !== 'EXPECTED' ? porteiro.id : undefined,
        },
      });
    }),
  );

  // Packages
  const PKG_STATUS = ['RECEIVED', 'NOTIFIED', 'PICKED_UP'] as const;
  await Promise.all(
    Array.from({ length: N.packages }, (_, i) => {
      const resident = pick(residents, i);
      const status = pick(PKG_STATUS, i);
      return prisma.package.create({
        data: {
          condominiumId: condo.id,
          apartmentId: resident.apartmentId,
          residentId: resident.id,
          description: `Encomenda ${pick(CARRIERS, i)}`,
          carrier: pick(CARRIERS, i),
          status,
          receivedBy: porteiro.id,
          pickedUpAt: status === 'PICKED_UP' ? daysFromNow(0) : undefined,
          pickedUpBy: status === 'PICKED_UP' ? resident.fullName : undefined,
        },
      });
    }),
  );

  // Notifications
  await Promise.all(
    Array.from({ length: N.notifications }, (_, i) =>
      prisma.notification.create({
        data: {
          condominiumId: condo.id,
          userId: pick(residentUsers, i).id,
          type: pick(NOTIF_TYPES, i),
          title: `Notificação ${i + 1}`,
          body: 'Você tem uma nova atualização no CondoHub.',
          isRead: i % 3 === 0,
        },
      }),
    ),
  );

  // Payments (cobrança B2B da plataforma ao condomínio)
  const PAY_METHOD = ['PIX', 'CREDIT_CARD', 'BOLETO'] as const;
  const PAY_STATUS = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
  await Promise.all(
    Array.from({ length: N.payments }, (_, i) => {
      const status = pick(PAY_STATUS, i);
      return prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          amount: 249,
          method: pick(PAY_METHOD, i),
          status,
          dueDate: daysFromNow(-(i * 30)),
          paidAt: status === 'PAID' ? daysFromNow(-(i * 30) + 2) : undefined,
        },
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // 5. Relatório
  // ---------------------------------------------------------------------------
  const total =
    (await prisma.condominium.count()) +
    (await prisma.subscription.count()) +
    (await prisma.payment.count()) +
    (await prisma.user.count()) +
    (await prisma.block.count()) +
    (await prisma.apartment.count()) +
    (await prisma.resident.count()) +
    (await prisma.vehicle.count()) +
    (await prisma.commonArea.count()) +
    (await prisma.reservation.count()) +
    (await prisma.notice.count()) +
    (await prisma.expense.count()) +
    (await prisma.revenue.count()) +
    (await prisma.ticket.count()) +
    (await prisma.ticketComment.count()) +
    (await prisma.visitor.count()) +
    (await prisma.package.count()) +
    (await prisma.notification.count());

  /* eslint-disable no-console */
  console.log('✅ Seed concluído. Total de registros:', total);
  console.log('───────────────────────────────────────────────');
  console.log('CREDENCIAIS DE TESTE (senha: changeme123)');
  console.log('  SUPER_ADMIN : admin@condohub.com.br      (sem slug)');
  console.log('  SÍNDICO     : sindico@demo.com.br        (slug: demo)');
  console.log('  PORTEIRO    : porteiro@demo.com.br       (slug: demo)');
  console.log('  MORADOR     : morador@demo.com.br        (slug: demo)');
  console.log('  +29 moradores: morador2@demo.com.br ... morador30@demo.com.br');
  /* eslint-enable no-console */
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
