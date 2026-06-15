import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { AppError } from '@/utils/errors';
import { paginate, toSkipTake } from '@/utils/pagination';
import type { AuthUser } from '@/types/express';
import type {
  CreateExpenseInput,
  CreateRevenueInput,
  ListExpensesQuery,
  ListRevenuesQuery,
  UpdateExpenseInput,
} from './finance.schemas';

const dec = (n: number) => new Prisma.Decimal(n);
const num = (d: Prisma.Decimal) => Number(d);

// ---- Categorias ----
export async function listCategories() {
  return prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } });
}
export async function createCategory(name: string, user: AuthUser) {
  const cat = await prisma.expenseCategory.create({ data: { name } as Prisma.ExpenseCategoryUncheckedCreateInput });
  await audit({ userId: user.id, action: 'finance.category.create', entity: 'ExpenseCategory', entityId: cat.id });
  return cat;
}

// ---- Despesas ----
export async function listExpenses(q: ListExpensesQuery) {
  const where: Prisma.ExpenseWhereInput = {
    ...(q.categoryId && { categoryId: q.categoryId }),
    ...((q.from || q.to) && { dueDate: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }),
  };
  const [data, total] = await Promise.all([
    prisma.expense.findMany({ where, include: { category: true }, orderBy: { dueDate: 'desc' }, ...toSkipTake(q) }),
    prisma.expense.count({ where }),
  ]);
  return paginate(data, total, q);
}

export async function createExpense(input: CreateExpenseInput, user: AuthUser) {
  const expense = await prisma.expense.create({
    data: { ...input, amount: dec(input.amount) } as Prisma.ExpenseUncheckedCreateInput,
    include: { category: true },
  });
  await audit({ userId: user.id, action: 'finance.expense.create', entity: 'Expense', entityId: expense.id });
  return expense;
}

export async function updateExpense(id: string, input: UpdateExpenseInput, user: AuthUser) {
  const existing = await prisma.expense.findFirst({ where: { id }, select: { id: true } });
  if (!existing) throw AppError.notFound('Despesa não encontrada');
  const { amount, ...rest } = input;
  const expense = await prisma.expense.update({
    where: { id },
    data: { ...rest, ...(amount !== undefined && { amount: dec(amount) }) },
    include: { category: true },
  });
  await audit({ userId: user.id, action: 'finance.expense.update', entity: 'Expense', entityId: id });
  return expense;
}

export async function removeExpense(id: string, user: AuthUser) {
  const existing = await prisma.expense.findFirst({ where: { id }, select: { id: true } });
  if (!existing) throw AppError.notFound('Despesa não encontrada');
  await prisma.expense.delete({ where: { id } });
  await audit({ userId: user.id, action: 'finance.expense.delete', entity: 'Expense', entityId: id });
}

// ---- Receitas ----
export async function listRevenues(q: ListRevenuesQuery) {
  const where: Prisma.RevenueWhereInput = {
    ...((q.from || q.to) && { receivedAt: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }),
  };
  const [data, total] = await Promise.all([
    prisma.revenue.findMany({ where, orderBy: { receivedAt: 'desc' }, ...toSkipTake(q) }),
    prisma.revenue.count({ where }),
  ]);
  return paginate(data, total, q);
}

export async function createRevenue(input: CreateRevenueInput, user: AuthUser) {
  const revenue = await prisma.revenue.create({
    data: { ...input, amount: dec(input.amount) } as Prisma.RevenueUncheckedCreateInput,
  });
  await audit({ userId: user.id, action: 'finance.revenue.create', entity: 'Revenue', entityId: revenue.id });
  return revenue;
}

export async function removeRevenue(id: string, user: AuthUser) {
  const existing = await prisma.revenue.findFirst({ where: { id }, select: { id: true } });
  if (!existing) throw AppError.notFound('Receita não encontrada');
  await prisma.revenue.delete({ where: { id } });
  await audit({ userId: user.id, action: 'finance.revenue.delete', entity: 'Revenue', entityId: id });
}

// ---- Fluxo de caixa (12 meses do ano) ----
export interface MonthFlow {
  month: number;
  revenue: number;
  expense: number;
  balance: number;
}

export async function cashflow(year: number): Promise<{ year: number; months: MonthFlow[]; totals: Omit<MonthFlow, 'month'> }> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const [revenues, expenses] = await Promise.all([
    prisma.revenue.findMany({ where: { receivedAt: { gte: start, lt: end } }, select: { amount: true, receivedAt: true } }),
    prisma.expense.findMany({ where: { dueDate: { gte: start, lt: end } }, select: { amount: true, dueDate: true } }),
  ]);

  const months: MonthFlow[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, revenue: 0, expense: 0, balance: 0 }));
  for (const r of revenues) months[r.receivedAt.getUTCMonth()].revenue += num(r.amount);
  for (const e of expenses) months[e.dueDate.getUTCMonth()].expense += num(e.amount);
  for (const m of months) m.balance = Number((m.revenue - m.expense).toFixed(2));

  const totals = months.reduce(
    (acc, m) => ({ revenue: acc.revenue + m.revenue, expense: acc.expense + m.expense, balance: acc.balance + m.balance }),
    { revenue: 0, expense: 0, balance: 0 },
  );
  totals.revenue = Number(totals.revenue.toFixed(2));
  totals.expense = Number(totals.expense.toFixed(2));
  totals.balance = Number(totals.balance.toFixed(2));

  return { year, months, totals };
}

// ---- Dados de relatório (mensal/anual) ----
export interface ReportData {
  period: string;
  start: Date;
  end: Date;
  revenues: { description: string; amount: number; date: Date; category: string | null }[];
  expenses: { description: string; amount: number; date: Date; category: string | null }[];
  totalRevenue: number;
  totalExpense: number;
  balance: number;
}

export async function reportData(range: { start: Date; end: Date; label: string }): Promise<ReportData> {
  const { start, end, label } = range;
  const [revenues, expenses] = await Promise.all([
    prisma.revenue.findMany({ where: { receivedAt: { gte: start, lt: end } }, orderBy: { receivedAt: 'asc' } }),
    prisma.expense.findMany({ where: { dueDate: { gte: start, lt: end } }, include: { category: true }, orderBy: { dueDate: 'asc' } }),
  ]);

  const rev = revenues.map((r) => ({ description: r.description, amount: num(r.amount), date: r.receivedAt, category: r.category }));
  const exp = expenses.map((e) => ({ description: e.description, amount: num(e.amount), date: e.dueDate, category: e.category?.name ?? null }));
  const totalRevenue = Number(rev.reduce((s, r) => s + r.amount, 0).toFixed(2));
  const totalExpense = Number(exp.reduce((s, e) => s + e.amount, 0).toFixed(2));

  return {
    period: label,
    start,
    end,
    revenues: rev,
    expenses: exp,
    totalRevenue,
    totalExpense,
    balance: Number((totalRevenue - totalExpense).toFixed(2)),
  };
}

/** Resolve o intervalo do relatório a partir dos parâmetros validados. */
export function resolveReportRange(params: { period: 'monthly' | 'annual'; month?: string; year?: number }) {
  if (params.period === 'monthly') {
    const [y, m] = params.month!.split('-').map(Number);
    return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)), label: params.month! };
  }
  const y = params.year!;
  return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)), label: String(y) };
}
