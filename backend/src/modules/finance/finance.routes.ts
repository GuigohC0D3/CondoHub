import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { requireRole } from '@/middlewares/rbac';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/async-handler';
import * as c from './finance.controller';
import {
  cashflowQuerySchema,
  createCategorySchema,
  createExpenseSchema,
  createRevenueSchema,
  idParamSchema,
  listExpensesQuerySchema,
  listRevenuesQuerySchema,
  reportQuerySchema,
  updateExpenseSchema,
} from './finance.schemas';

export const financeRouter = Router();

// Financeiro é exclusivo do síndico.
financeRouter.use(authenticate, requireRole('SINDICO'));

financeRouter.get('/categories', asyncHandler(c.listCategories));
financeRouter.post('/categories', validate({ body: createCategorySchema }), asyncHandler(c.createCategory));

financeRouter.get('/expenses', validate({ query: listExpensesQuerySchema }), asyncHandler(c.listExpenses));
financeRouter.post('/expenses', validate({ body: createExpenseSchema }), asyncHandler(c.createExpense));
financeRouter.patch('/expenses/:id', validate({ params: idParamSchema, body: updateExpenseSchema }), asyncHandler(c.updateExpense));
financeRouter.delete('/expenses/:id', validate({ params: idParamSchema }), asyncHandler(c.removeExpense));

financeRouter.get('/revenues', validate({ query: listRevenuesQuerySchema }), asyncHandler(c.listRevenues));
financeRouter.post('/revenues', validate({ body: createRevenueSchema }), asyncHandler(c.createRevenue));
financeRouter.delete('/revenues/:id', validate({ params: idParamSchema }), asyncHandler(c.removeRevenue));

financeRouter.get('/cashflow', validate({ query: cashflowQuerySchema }), asyncHandler(c.cashflow));
financeRouter.get('/report', validate({ query: reportQuerySchema }), asyncHandler(c.report));
