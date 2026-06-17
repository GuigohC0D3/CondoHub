import { Prisma, PrismaClient } from '@prisma/client';
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

// Quantidades — ~300 por tabela principal. blocks (nomes A–Z) e commonAreas
// (4 defs fixas) têm limite estrutural e não escalam. Ver log final.
const N = {
  residentUsers: 300, // deve ser >= residents (residents[i] usa residentUsers[i])
  blocks: 10,
  apartments: 300,
  residents: 300,
  vehicles: 300,
  commonAreas: 4,
  reservations: 300,
  notices: 300,
  expenses: 300,
  revenues: 300,
  tickets: 300,
  ticketComments: 300,
  visitors: 300,
  packages: 300,
  notifications: 300,
  payments: 300,
  charges: 300,
};

// Fração ideal sintética por unidade (soma ≈ 1.0) — base do voto ponderado em assembleia.
const FRACTION = Number((1 / N.apartments).toFixed(6));

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
  await prisma.charge.deleteMany({ where: cid }); // antes de apartment (FK Restrict)
  await prisma.chargeBatch.deleteMany({ where: cid });
  await prisma.assembly.deleteMany({ where: cid }); // cascade: items, options, votes, attendances
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
      return prisma.apartment.create({ data: { condominiumId: condo.id, blockId: block.id, number, floor, idealFraction: FRACTION } });
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
  // 4b. Cobranças do morador (Charge) + lotes mensais (ChargeBatch)
  //     Gateway é "simulado" inline (o que o stub gravaria) — seed roda offline.
  // ---------------------------------------------------------------------------
  const now = new Date();
  const ymKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthDates = [2, 1, 0].map((back) => new Date(now.getFullYear(), now.getMonth() - back, 1));
  const CHG_STATUS = ['PAID', 'PAID', 'PENDING', 'OVERDUE', 'CANCELED'] as const;

  const chargeBatches = await Promise.all(
    monthDates.map((d) =>
      prisma.chargeBatch.create({
        data: { condominiumId: condo.id, referenceMonth: ymKey(d), dueDate: new Date(d.getFullYear(), d.getMonth(), 10), defaultAmount: 450, totalCharges: 0 },
      }),
    ),
  );

  const perBatch = [0, 0, 0];
  await Promise.all(
    Array.from({ length: N.charges }, (_, i) => {
      const m = i % 3;
      perBatch[m] += 1;
      const resident = residents[i % residents.length];
      const status = pick(CHG_STATUS, i);
      const method = i % 5 === 0 ? 'BOLETO' : 'PIX';
      const amount = 450 + (i % 6) * 25;
      const d = monthDates[m];
      const dueDate = new Date(d.getFullYear(), d.getMonth(), 10);
      const paid = status === 'PAID';
      const overdue = status === 'OVERDUE';
      return prisma.charge.create({
        data: {
          condominiumId: condo.id,
          apartmentId: resident.apartmentId,
          residentId: resident.id,
          batchId: chargeBatches[m].id,
          kind: 'CONDO_FEE',
          description: `Taxa condominial ${ymKey(d)}`,
          referenceMonth: ymKey(d),
          amount,
          fineAmount: overdue ? Number((amount * 0.02).toFixed(2)) : undefined,
          interestAmount: overdue ? Number((amount * 0.01).toFixed(2)) : undefined,
          paidAmount: paid ? amount : undefined,
          dueDate,
          status,
          method,
          gatewayChargeId: `seed-chg-${i}`,
          pixPayload: method === 'PIX' ? `00020126seed-pix-${i}` : undefined,
          boletoUrl: method === 'BOLETO' ? `https://pay.demo/boleto/seed-${i}` : undefined,
          paidAt: paid ? new Date(dueDate.getTime() - 2 * 86_400_000) : undefined,
          canceledAt: status === 'CANCELED' ? new Date() : undefined,
        },
      });
    }),
  );
  await Promise.all(
    chargeBatches.map((b, m) => prisma.chargeBatch.update({ where: { id: b.id }, data: { totalCharges: perBatch[m] } })),
  );

  // ---------------------------------------------------------------------------
  // 4c. Assembleias (Assembly) + itens, presença e votos ponderados
  // ---------------------------------------------------------------------------
  const totalWeight = Number((N.apartments * FRACTION).toFixed(6));
  const present = residents.slice(0, 200); // unidades presentes (quórum > 50%)

  type Rule = 'SIMPLE_MAJORITY' | 'ABSOLUTE_MAJORITY' | 'TWO_THIRDS' | 'UNANIMITY';
  type Status = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED';
  const assemblyDefs: {
    title: string;
    type: 'ORDINARIA' | 'EXTRAORDINARIA';
    mode: 'PRESENCIAL' | 'VIRTUAL' | 'HIBRIDA';
    status: Status;
    items: { title: string; quorumRule: Rule; options?: string[] }[];
  }[] = [
    { title: 'AGO 2026 — Prestação de Contas', type: 'ORDINARIA', mode: 'HIBRIDA', status: 'CLOSED', items: [
      { title: 'Aprovação das contas do exercício', quorumRule: 'ABSOLUTE_MAJORITY' },
      { title: 'Aprovação da previsão orçamentária', quorumRule: 'SIMPLE_MAJORITY' },
    ] },
    { title: 'AGE — Reforma da Fachada', type: 'EXTRAORDINARIA', mode: 'VIRTUAL', status: 'CLOSED', items: [
      { title: 'Aprovação da obra de fachada (rateio extra)', quorumRule: 'TWO_THIRDS' },
    ] },
    { title: 'AGE — Eleição de Síndico', type: 'EXTRAORDINARIA', mode: 'PRESENCIAL', status: 'OPEN', items: [
      { title: 'Eleição do síndico (biênio 2026-2028)', quorumRule: 'SIMPLE_MAJORITY', options: ['Chapa 1 — Renovação', 'Chapa 2 — Continuidade', 'Voto em branco'] },
    ] },
    { title: 'AGO — Orçamento Anual', type: 'ORDINARIA', mode: 'VIRTUAL', status: 'OPEN', items: [
      { title: 'Reajuste da taxa condominial', quorumRule: 'ABSOLUTE_MAJORITY' },
    ] },
    { title: 'AGE — Novo Regimento Interno', type: 'EXTRAORDINARIA', mode: 'HIBRIDA', status: 'SCHEDULED', items: [
      { title: 'Aprovação do novo regimento interno', quorumRule: 'TWO_THIRDS' },
    ] },
    { title: 'AGE — Instalação de Câmeras', type: 'EXTRAORDINARIA', mode: 'VIRTUAL', status: 'DRAFT', items: [
      { title: 'Instalação de CFTV nas áreas comuns', quorumRule: 'SIMPLE_MAJORITY' },
    ] },
  ];

  for (const [ai, def] of assemblyDefs.entries()) {
    const isClosed = def.status === 'CLOSED';
    const isOpen = def.status === 'OPEN';
    const openedAt = isClosed ? daysFromNow(-(ai * 30 + 15)) : isOpen ? daysFromNow(0) : undefined;
    const closedAt = isClosed ? daysFromNow(-(ai * 30 + 14)) : undefined;
    const itemStatus = isClosed ? 'CLOSED' : isOpen ? 'OPEN' : 'PENDING';

    const assembly = await prisma.assembly.create({
      data: {
        condominiumId: condo.id,
        title: def.title,
        notice: `Ficam convocados os condôminos para a ${def.title}, nos termos da Lei 14.309/2022. Ordem do dia conforme itens registrados.`,
        type: def.type,
        mode: def.mode,
        status: def.status,
        scheduledFor: openedAt ?? daysFromNow((ai + 1) * 7),
        openedAt,
        closedAt,
        items: {
          create: def.items.map((it, idx) => ({
            order: idx,
            title: it.title,
            quorumRule: it.quorumRule,
            status: itemStatus,
            openedAt,
            closedAt,
            options: it.options ? { create: it.options.map((label, oi) => ({ label, order: oi })) } : undefined,
          })),
        },
      },
      include: { items: { include: { options: true } } },
    });

    if (def.status === 'DRAFT' || def.status === 'SCHEDULED') continue;

    // Presença de todas as unidades presentes.
    await prisma.assemblyAttendance.createMany({
      data: present.map((r) => ({ assemblyId: assembly.id, apartmentId: r.apartmentId, residentId: r.id, weight: FRACTION })),
    });

    // OPEN: votação em andamento (parte das unidades já votou). CLOSED: todas votaram.
    const voters = isOpen ? present.slice(0, 120) : present;

    for (const item of assembly.items) {
      const opts = item.options;
      const votesData = voters.map((r, vi) => {
        if (opts.length > 0) {
          return { itemId: item.id, apartmentId: r.apartmentId, residentId: r.id, optionId: opts[vi % opts.length].id, choice: 'OPTION' as const, weight: FRACTION };
        }
        const mod = vi % 20; // ~65% SIM, 25% NÃO, 10% ABSTENÇÃO
        const choice = (mod < 13 ? 'YES' : mod < 18 ? 'NO' : 'ABSTAIN') as 'YES' | 'NO' | 'ABSTAIN';
        return { itemId: item.id, apartmentId: r.apartmentId, residentId: r.id, optionId: null as string | null, choice, weight: FRACTION };
      });
      await prisma.assemblyVote.createMany({ data: votesData });

      if (!isClosed) continue;

      // Apuração (peso = FRACTION por unidade).
      let yes = 0, no = 0, abstain = 0;
      const optTally = new Map<string, number>();
      for (const v of votesData) {
        if (v.choice === 'OPTION' && v.optionId) optTally.set(v.optionId, (optTally.get(v.optionId) ?? 0) + FRACTION);
        else if (v.choice === 'YES') yes += FRACTION;
        else if (v.choice === 'NO') no += FRACTION;
        else if (v.choice === 'ABSTAIN') abstain += FRACTION;
      }
      const r6 = (n: number) => Number(n.toFixed(6));
      let approved: boolean | null = null;
      let resultJson: Prisma.InputJsonValue;
      if (opts.length > 0) {
        const options = opts
          .map((o) => ({ optionId: o.id, label: o.label, weight: r6(optTally.get(o.id) ?? 0) }))
          .sort((a, b) => b.weight - a.weight);
        resultJson = { itemId: item.id, rule: item.quorumRule, totalWeight, options, winnerOptionId: options[0]?.optionId ?? null, votingUnits: votesData.length };
      } else {
        approved =
          item.quorumRule === 'TWO_THIRDS' ? yes >= (totalWeight * 2) / 3
          : item.quorumRule === 'ABSOLUTE_MAJORITY' ? yes > totalWeight / 2
          : item.quorumRule === 'UNANIMITY' ? no === 0 && abstain === 0 && yes >= totalWeight
          : yes > no;
        resultJson = { itemId: item.id, rule: item.quorumRule, totalWeight, yes: r6(yes), no: r6(no), abstain: r6(abstain), votingUnits: votesData.length, approved };
      }
      await prisma.assemblyItem.update({ where: { id: item.id }, data: { approved, resultJson } });
    }
  }

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
    (await prisma.notification.count()) +
    (await prisma.charge.count()) +
    (await prisma.chargeBatch.count()) +
    (await prisma.assembly.count()) +
    (await prisma.assemblyItem.count()) +
    (await prisma.assemblyVote.count()) +
    (await prisma.assemblyAttendance.count());

  /* eslint-disable no-console */
  console.log('✅ Seed concluído. Total de registros:', total);
  console.log('───────────────────────────────────────────────');
  console.log('CREDENCIAIS DE TESTE (senha: changeme123)');
  console.log('  SUPER_ADMIN : admin@condohub.com.br      (sem slug)');
  console.log('  SÍNDICO     : sindico@demo.com.br        (slug: demo)');
  console.log('  PORTEIRO    : porteiro@demo.com.br       (slug: demo)');
  console.log('  MORADOR     : morador@demo.com.br        (slug: demo)');
  console.log(`  +${N.residentUsers - 1} moradores: morador2@demo.com.br ... morador${N.residentUsers}@demo.com.br`);
  /* eslint-enable no-console */
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
