import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import type { AuthUser } from '@/types/express';
import type {
  CreateAssemblyInput,
  CreateItemInput,
  ListAssembliesQuery,
  UpdateAssemblyInput,
  UpdateItemInput,
  VoteInput,
} from './assemblies.schemas';

const dec = (n: number) => new Prisma.Decimal(n);
const num = (d: Prisma.Decimal | null) => (d == null ? 0 : Number(d));
const EPS = 1e-9;

/** Peso de voto de uma unidade: fração ideal, ou 1 quando não cadastrada. */
const unitWeight = (idealFraction: Prisma.Decimal | null) =>
  idealFraction == null ? 1 : Number(idealFraction);

/** Soma dos pesos de todas as unidades do condomínio (base do quórum). */
async function totalCondoWeight(): Promise<number> {
  const apts = await prisma.apartment.findMany({ select: { idealFraction: true } });
  return apts.reduce((s, a) => s + unitWeight(a.idealFraction), 0);
}

const itemInclude = {
  options: { orderBy: { order: 'asc' } },
  _count: { select: { votes: true } },
} satisfies Prisma.AssemblyItemInclude;

const detailInclude = {
  items: { include: itemInclude, orderBy: { order: 'asc' } },
  _count: { select: { attendances: true } },
} satisfies Prisma.AssemblyInclude;

async function loadAssembly(id: string, include?: Prisma.AssemblyInclude) {
  const assembly = await prisma.assembly.findFirst({ where: { id }, include });
  if (!assembly) throw AppError.notFound('Assembleia não encontrada');
  return assembly;
}

// ============================================================
// CRUD / convocação
// ============================================================

export async function listAssemblies(q: ListAssembliesQuery) {
  const where: Prisma.AssemblyWhereInput = { ...(q.status && { status: q.status }) };
  const [data, total] = await Promise.all([
    prisma.assembly.findMany({
      where,
      include: { _count: { select: { items: true, attendances: true } } },
      orderBy: { scheduledFor: 'desc' },
      ...toSkipTake(q),
    }),
    prisma.assembly.count({ where }),
  ]);
  return paginate(data, total, q);
}

export async function getAssembly(id: string, user: AuthUser) {
  const assembly = await loadAssembly(id, detailInclude);
  const quorum = await quorumStatus(id);
  // Moradores não enxergam rascunhos.
  if (user.role !== 'SINDICO' && user.role !== 'SUPER_ADMIN' && assembly.status === 'DRAFT') {
    throw AppError.notFound('Assembleia não encontrada');
  }
  return { ...assembly, quorum };
}

export async function createAssembly(input: CreateAssemblyInput, user: AuthUser) {
  const { items, quorumSecond, ...rest } = input;
  const assembly = await prisma.assembly.create({
    data: {
      ...rest,
      quorumFirst: dec(input.quorumFirst),
      quorumSecond: quorumSecond == null ? null : dec(quorumSecond),
      items: items?.length
        ? {
            create: items.map((it, idx) => ({
              title: it.title,
              description: it.description ?? null,
              quorumRule: it.quorumRule,
              order: it.order ?? idx,
              options: it.options?.length
                ? { create: it.options.map((label, i) => ({ label, order: i })) }
                : undefined,
            })),
          }
        : undefined,
    } as Prisma.AssemblyUncheckedCreateInput,
    include: detailInclude,
  });
  await audit({ userId: user.id, action: 'assembly.create', entity: 'Assembly', entityId: assembly.id });
  return assembly;
}

export async function updateAssembly(id: string, input: UpdateAssemblyInput, user: AuthUser) {
  const current = await loadAssembly(id);
  if (current.status !== 'DRAFT') throw AppError.business('Só é possível editar assembleia em rascunho');
  const { quorumFirst, quorumSecond, ...rest } = input;
  const assembly = await prisma.assembly.update({
    where: { id },
    data: {
      ...rest,
      ...(quorumFirst !== undefined && { quorumFirst: dec(quorumFirst) }),
      ...(quorumSecond !== undefined && { quorumSecond: quorumSecond == null ? null : dec(quorumSecond) }),
    },
    include: detailInclude,
  });
  await audit({ userId: user.id, action: 'assembly.update', entity: 'Assembly', entityId: id });
  return assembly;
}

/** Publica o edital: DRAFT → SCHEDULED. */
export async function scheduleAssembly(id: string, user: AuthUser) {
  const current = await prisma.assembly.findFirst({ where: { id }, select: { status: true, items: { select: { id: true } } } });
  if (!current) throw AppError.notFound('Assembleia não encontrada');
  if (current.status !== 'DRAFT') throw AppError.business('Assembleia já foi convocada');
  if (current.items.length === 0) throw AppError.business('Adicione ao menos um item de pauta antes de convocar');
  const assembly = await prisma.assembly.update({ where: { id }, data: { status: 'SCHEDULED' }, include: detailInclude });
  await audit({ userId: user.id, action: 'assembly.schedule', entity: 'Assembly', entityId: id });
  return assembly;
}

/** Instala a assembleia: SCHEDULED → OPEN. */
export async function openAssembly(id: string, user: AuthUser) {
  const current = await loadAssembly(id);
  if (current.status !== 'SCHEDULED') throw AppError.business('Assembleia precisa estar convocada para ser aberta');
  const assembly = await prisma.assembly.update({
    where: { id },
    data: { status: 'OPEN', openedAt: new Date() },
    include: detailInclude,
  });
  await audit({ userId: user.id, action: 'assembly.open', entity: 'Assembly', entityId: id });
  return assembly;
}

/** Encerra a assembleia: apura itens abertos e fecha. */
export async function closeAssembly(id: string, user: AuthUser) {
  const current = await prisma.assembly.findFirst({
    where: { id },
    select: { status: true, items: { where: { status: 'OPEN' }, select: { id: true } } },
  });
  if (!current) throw AppError.notFound('Assembleia não encontrada');
  if (current.status !== 'OPEN') throw AppError.business('Apenas assembleias em andamento podem ser encerradas');

  const totalWeight = await totalCondoWeight();
  for (const item of current.items) await tallyAndCloseItem(item.id, totalWeight);

  const assembly = await prisma.assembly.update({
    where: { id },
    data: { status: 'CLOSED', closedAt: new Date() },
    include: detailInclude,
  });
  await audit({ userId: user.id, action: 'assembly.close', entity: 'Assembly', entityId: id });
  return assembly;
}

export async function cancelAssembly(id: string, user: AuthUser) {
  const current = await loadAssembly(id);
  if (current.status === 'CLOSED' || current.status === 'CANCELED') {
    throw AppError.business('Assembleia encerrada/cancelada não pode ser cancelada');
  }
  const assembly = await prisma.assembly.update({ where: { id }, data: { status: 'CANCELED' }, include: detailInclude });
  await audit({ userId: user.id, action: 'assembly.cancel', entity: 'Assembly', entityId: id });
  return assembly;
}

// ============================================================
// Itens de pauta
// ============================================================

async function assertEditableAssembly(assemblyId: string) {
  const a = await prisma.assembly.findFirst({ where: { id: assemblyId }, select: { status: true } });
  if (!a) throw AppError.notFound('Assembleia não encontrada');
  if (a.status !== 'DRAFT' && a.status !== 'SCHEDULED') {
    throw AppError.business('Itens só podem ser alterados antes da abertura da assembleia');
  }
}

export async function addItem(assemblyId: string, input: CreateItemInput, user: AuthUser) {
  await assertEditableAssembly(assemblyId);
  const last = await prisma.assemblyItem.findFirst({
    where: { assemblyId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const item = await prisma.assemblyItem.create({
    data: {
      assemblyId,
      title: input.title,
      description: input.description ?? null,
      quorumRule: input.quorumRule,
      order: input.order ?? (last ? last.order + 1 : 0),
      options: input.options?.length ? { create: input.options.map((label, i) => ({ label, order: i })) } : undefined,
    },
    include: itemInclude,
  });
  await audit({ userId: user.id, action: 'assembly.item.add', entity: 'AssemblyItem', entityId: item.id });
  return item;
}

export async function updateItem(assemblyId: string, itemId: string, input: UpdateItemInput, user: AuthUser) {
  await assertEditableAssembly(assemblyId);
  const existing = await prisma.assemblyItem.findFirst({ where: { id: itemId, assemblyId }, select: { id: true } });
  if (!existing) throw AppError.notFound('Item não encontrado');
  const item = await prisma.assemblyItem.update({ where: { id: itemId }, data: input, include: itemInclude });
  await audit({ userId: user.id, action: 'assembly.item.update', entity: 'AssemblyItem', entityId: itemId });
  return item;
}

export async function removeItem(assemblyId: string, itemId: string, user: AuthUser) {
  await assertEditableAssembly(assemblyId);
  const existing = await prisma.assemblyItem.findFirst({ where: { id: itemId, assemblyId }, select: { id: true } });
  if (!existing) throw AppError.notFound('Item não encontrado');
  await prisma.assemblyItem.delete({ where: { id: itemId } });
  await audit({ userId: user.id, action: 'assembly.item.remove', entity: 'AssemblyItem', entityId: itemId });
}

async function loadOpenAssemblyItem(assemblyId: string, itemId: string) {
  const assembly = await prisma.assembly.findFirst({ where: { id: assemblyId }, select: { status: true } });
  if (!assembly) throw AppError.notFound('Assembleia não encontrada');
  const item = await prisma.assemblyItem.findFirst({ where: { id: itemId, assemblyId } });
  if (!item) throw AppError.notFound('Item não encontrado');
  return { assembly, item };
}

export async function openItem(assemblyId: string, itemId: string, user: AuthUser) {
  const { assembly, item } = await loadOpenAssemblyItem(assemblyId, itemId);
  if (assembly.status !== 'OPEN') throw AppError.business('Abra a assembleia antes de iniciar a votação do item');
  if (item.status !== 'PENDING') throw AppError.business('Item já está em votação ou encerrado');
  const updated = await prisma.assemblyItem.update({
    where: { id: itemId },
    data: { status: 'OPEN', openedAt: new Date() },
    include: itemInclude,
  });
  await audit({ userId: user.id, action: 'assembly.item.open', entity: 'AssemblyItem', entityId: itemId });
  return updated;
}

export async function closeItem(assemblyId: string, itemId: string, user: AuthUser) {
  const { item } = await loadOpenAssemblyItem(assemblyId, itemId);
  if (item.status !== 'OPEN') throw AppError.business('Item não está em votação');
  const totalWeight = await totalCondoWeight();
  const result = await tallyAndCloseItem(itemId, totalWeight);
  await audit({ userId: user.id, action: 'assembly.item.close', entity: 'AssemblyItem', entityId: itemId });
  return result;
}

// ============================================================
// Quórum, presença e votação
// ============================================================

export interface QuorumStatus {
  totalWeight: number;
  presentWeight: number;
  presentUnits: number;
  ratio: number; // presentWeight / totalWeight (0..1)
  requiredFirst: number;
  requiredSecond: number | null;
  reachedFirstCall: boolean;
  installable: boolean; // atingiu 1ª OU (2ª chamada sem mínimo)
}

export async function quorumStatus(assemblyId: string): Promise<QuorumStatus> {
  const assembly = await prisma.assembly.findFirst({
    where: { id: assemblyId },
    select: { quorumFirst: true, quorumSecond: true },
  });
  if (!assembly) throw AppError.notFound('Assembleia não encontrada');

  const [totalWeight, attendances] = await Promise.all([
    totalCondoWeight(),
    prisma.assemblyAttendance.findMany({ where: { assemblyId }, select: { weight: true } }),
  ]);
  const presentWeight = attendances.reduce((s, a) => s + num(a.weight), 0);
  const ratio = totalWeight > 0 ? presentWeight / totalWeight : 0;
  const requiredFirst = num(assembly.quorumFirst);
  const requiredSecond = assembly.quorumSecond == null ? null : num(assembly.quorumSecond);
  const reachedFirstCall = ratio + EPS >= requiredFirst;

  return {
    totalWeight: round(totalWeight),
    presentWeight: round(presentWeight),
    presentUnits: attendances.length,
    ratio: round(ratio),
    requiredFirst,
    requiredSecond,
    reachedFirstCall,
    installable: reachedFirstCall || requiredSecond === null || ratio + EPS >= requiredSecond,
  };
}

/** Resolve a unidade do votante a partir do usuário autenticado (vínculo Resident). */
async function resolveVoterUnit(user: AuthUser, apartmentId?: string) {
  if (apartmentId) {
    // Caminho do síndico (presença manual): valida a unidade no tenant.
    const apt = await prisma.apartment.findFirst({ where: { id: apartmentId }, select: { id: true, idealFraction: true } });
    if (!apt) throw AppError.notFound('Unidade não encontrada');
    return { apartmentId: apt.id, residentId: null as string | null, weight: unitWeight(apt.idealFraction) };
  }
  const resident = await prisma.resident.findFirst({
    where: { userId: user.id },
    select: { id: true, apartmentId: true, apartment: { select: { idealFraction: true } } },
  });
  if (!resident) throw AppError.forbidden('Apenas moradores vinculados a uma unidade podem participar');
  return {
    apartmentId: resident.apartmentId,
    residentId: resident.id,
    weight: unitWeight(resident.apartment.idealFraction),
  };
}

export async function checkin(assemblyId: string, user: AuthUser, apartmentId?: string) {
  const assembly = await prisma.assembly.findFirst({ where: { id: assemblyId }, select: { status: true } });
  if (!assembly) throw AppError.notFound('Assembleia não encontrada');
  if (assembly.status !== 'OPEN' && assembly.status !== 'SCHEDULED') {
    throw AppError.business('Check-in disponível apenas em assembleia convocada ou em andamento');
  }
  // Apartamento informado só é permitido ao síndico.
  const target = apartmentId && user.role === 'SINDICO' ? apartmentId : undefined;
  const unit = await resolveVoterUnit(user, target);

  const attendance = await prisma.assemblyAttendance.upsert({
    where: { assemblyId_apartmentId: { assemblyId, apartmentId: unit.apartmentId } },
    update: {},
    create: { assemblyId, apartmentId: unit.apartmentId, residentId: unit.residentId, weight: dec(unit.weight) },
  });
  return { attendance, quorum: await quorumStatus(assemblyId) };
}

export async function vote(assemblyId: string, itemId: string, input: VoteInput, user: AuthUser) {
  const item = await prisma.assemblyItem.findFirst({
    where: { id: itemId, assemblyId },
    select: { id: true, status: true, options: { select: { id: true } } },
  });
  if (!item) throw AppError.notFound('Item não encontrado');
  if (item.status !== 'OPEN') throw AppError.business('A votação deste item não está aberta');

  const hasOptions = item.options.length > 0;
  if (hasOptions && !input.optionId) throw AppError.business('Este item exige a escolha de uma opção');
  if (!hasOptions && input.optionId) throw AppError.business('Este item é de voto SIM/NÃO/ABSTENÇÃO');
  if (input.optionId && !item.options.some((o) => o.id === input.optionId)) {
    throw AppError.business('Opção inválida para este item');
  }

  const unit = await resolveVoterUnit(user);
  const choice = input.optionId ? 'OPTION' : input.choice!;

  // Presença implícita: votar registra check-in da unidade.
  await prisma.assemblyAttendance.upsert({
    where: { assemblyId_apartmentId: { assemblyId, apartmentId: unit.apartmentId } },
    update: {},
    create: { assemblyId, apartmentId: unit.apartmentId, residentId: unit.residentId, weight: dec(unit.weight) },
  });

  const vote = await prisma.assemblyVote.upsert({
    where: { itemId_apartmentId: { itemId, apartmentId: unit.apartmentId } },
    update: { choice, optionId: input.optionId ?? null, residentId: unit.residentId },
    create: {
      itemId,
      apartmentId: unit.apartmentId,
      residentId: unit.residentId,
      optionId: input.optionId ?? null,
      choice,
      weight: dec(unit.weight),
    },
  });
  return vote;
}

// ---- Apuração ----

export interface ItemResult {
  itemId: string;
  rule: string;
  totalWeight: number;
  yes: number;
  no: number;
  abstain: number;
  votingUnits: number;
  options?: { optionId: string; label: string; weight: number }[];
  winnerOptionId?: string | null;
  approved: boolean | null;
}

export async function tally(itemId: string, totalWeight?: number): Promise<ItemResult> {
  const item = await prisma.assemblyItem.findUnique({
    where: { id: itemId },
    include: { options: true, votes: true },
  });
  if (!item) throw AppError.notFound('Item não encontrado');
  const total = totalWeight ?? (await totalCondoWeight());

  let yes = 0,
    no = 0,
    abstain = 0;
  const optionTally = new Map<string, number>();
  for (const v of item.votes) {
    const w = num(v.weight);
    if (v.choice === 'YES') yes += w;
    else if (v.choice === 'NO') no += w;
    else if (v.choice === 'ABSTAIN') abstain += w;
    else if (v.choice === 'OPTION' && v.optionId) optionTally.set(v.optionId, (optionTally.get(v.optionId) ?? 0) + w);
  }

  const base: ItemResult = {
    itemId,
    rule: item.quorumRule,
    totalWeight: round(total),
    yes: round(yes),
    no: round(no),
    abstain: round(abstain),
    votingUnits: item.votes.length,
    approved: null,
  };

  if (item.options.length > 0) {
    const options = item.options
      .map((o) => ({ optionId: o.id, label: o.label, weight: round(optionTally.get(o.id) ?? 0) }))
      .sort((a, b) => b.weight - a.weight);
    base.options = options;
    base.winnerOptionId = options.length > 0 && options[0].weight > 0 ? options[0].optionId : null;
    return base;
  }

  switch (item.quorumRule) {
    case 'SIMPLE_MAJORITY':
      base.approved = yes > no + EPS;
      break;
    case 'ABSOLUTE_MAJORITY':
      base.approved = yes > total / 2 + EPS;
      break;
    case 'TWO_THIRDS':
      base.approved = yes + EPS >= (total * 2) / 3;
      break;
    case 'UNANIMITY':
      base.approved = no < EPS && abstain < EPS && yes + EPS >= total;
      break;
  }
  return base;
}

async function tallyAndCloseItem(itemId: string, totalWeight: number): Promise<ItemResult> {
  const result = await tally(itemId, totalWeight);
  await prisma.assemblyItem.update({
    where: { id: itemId },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      approved: result.approved,
      resultJson: result as unknown as Prisma.InputJsonValue,
    },
  });
  return result;
}

/** Resultados da assembleia. Moradores só veem itens já encerrados. */
export async function results(assemblyId: string, user: AuthUser) {
  const assembly = await prisma.assembly.findFirst({
    where: { id: assemblyId },
    include: { items: { include: itemInclude, orderBy: { order: 'asc' } } },
  });
  if (!assembly) throw AppError.notFound('Assembleia não encontrada');
  const isManager = user.role === 'SINDICO' || user.role === 'SUPER_ADMIN';
  const totalWeight = await totalCondoWeight();

  const items = await Promise.all(
    assembly.items
      .filter((it) => isManager || it.status === 'CLOSED')
      .map(async (it) => ({
        id: it.id,
        title: it.title,
        status: it.status,
        result: it.status === 'CLOSED' && it.resultJson ? (it.resultJson as unknown as ItemResult) : await tally(it.id, totalWeight),
      })),
  );

  return { assemblyId, status: assembly.status, quorum: await quorumStatus(assemblyId), items };
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}
