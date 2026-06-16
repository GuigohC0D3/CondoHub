<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Plus, FileDown } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import DataTable, { type Column } from '@/components/common/DataTable.vue';
import Pagination from '@/components/common/Pagination.vue';
import Card from '@/components/ui/Card.vue';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Label from '@/components/ui/Label.vue';
import { formatBRL, formatDate } from '@/lib/utils';
import { toast, apiError } from '@/lib/toast';
import {
  useExpenses, useRevenues, useCashflow, useCategories, useCreateExpense, useCreateRevenue, downloadReport,
  type Expense,
} from './api';

type Tab = 'expenses' | 'revenues' | 'cashflow';
const tab = ref<Tab>('expenses');
const tabs: { key: Tab; label: string }[] = [
  { key: 'expenses', label: 'Despesas' }, { key: 'revenues', label: 'Receitas' }, { key: 'cashflow', label: 'Fluxo de caixa' },
];

const ePage = ref(1); const rPage = ref(1);
const year = ref(new Date().getFullYear());
const { data: expenses, isLoading: le } = useExpenses(ePage);
const { data: revenues, isLoading: lr } = useRevenues(rPage);
const { data: cashflow } = useCashflow(year);
const { data: categories } = useCategories();

const eCols: Column[] = [{ key: 'description', label: 'Descrição' }, { key: 'category', label: 'Categoria' }, { key: 'dueDate', label: 'Vencimento' }, { key: 'amount', label: 'Valor' }];
const rCols: Column[] = [{ key: 'description', label: 'Descrição' }, { key: 'receivedAt', label: 'Recebida' }, { key: 'amount', label: 'Valor' }];
const eRows = computed(() => (expenses.value?.data ?? []) as unknown as Record<string, unknown>[]);
const rRows = computed(() => (revenues.value?.data ?? []) as unknown as Record<string, unknown>[]);
const catOptions = computed(() => (categories.value ?? []).map((c) => ({ value: c.id, label: c.name })));
const maxFlow = computed(() => Math.max(1, ...(cashflow.value?.months ?? []).map((m) => Math.max(m.revenue, m.expense))));

// Criar despesa/receita
const showExp = ref(false); const showRev = ref(false);
const expForm = reactive({ description: '', amount: '', dueDate: '', categoryId: '' });
const revForm = reactive({ description: '', amount: '', receivedAt: '' });
const createExp = useCreateExpense(); const createRev = useCreateRevenue();
async function submitExp() {
  try {
    await createExp.mutateAsync({ description: expForm.description, amount: Number(expForm.amount), dueDate: expForm.dueDate, categoryId: expForm.categoryId || undefined });
    toast.success('Despesa registrada'); showExp.value = false; Object.assign(expForm, { description: '', amount: '', dueDate: '', categoryId: '' });
  } catch (e) { toast.error(apiError(e)); }
}
async function submitRev() {
  try {
    await createRev.mutateAsync({ description: revForm.description, amount: Number(revForm.amount), receivedAt: revForm.receivedAt });
    toast.success('Receita registrada'); showRev.value = false; Object.assign(revForm, { description: '', amount: '', receivedAt: '' });
  } catch (e) { toast.error(apiError(e)); }
}

// Relatório
const reportMonth = ref(new Date().toISOString().slice(0, 7));
async function report(fmt: 'pdf' | 'xlsx') {
  try { await downloadReport(reportMonth.value, fmt); } catch (e) { toast.error(apiError(e, 'Falha ao gerar relatório')); }
}
</script>

<template>
  <div>
    <PageHeader title="Financeiro" subtitle="Receitas, despesas e relatórios">
      <template #actions>
        <Button v-if="tab === 'expenses'" @click="showExp = true"><Plus class="h-4 w-4" /> Despesa</Button>
        <Button v-if="tab === 'revenues'" @click="showRev = true"><Plus class="h-4 w-4" /> Receita</Button>
      </template>
    </PageHeader>

    <div class="mb-4 flex gap-1 border-b">
      <button
        v-for="t in tabs" :key="t.key"
        class="border-b-2 px-4 py-2 text-sm font-medium transition-colors"
        :class="tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <!-- Despesas -->
    <template v-if="tab === 'expenses'">
      <DataTable :columns="eCols" :rows="eRows" :loading="le" row-key="id" empty-message="Sem despesas.">
        <template #cell-category="{ row }">{{ (row as unknown as Expense).category?.name ?? '—' }}</template>
        <template #cell-dueDate="{ value }">{{ formatDate(value as string) }}</template>
        <template #cell-amount="{ value }">{{ formatBRL(Number(value)) }}</template>
      </DataTable>
      <Pagination v-if="expenses" :page="expenses.meta.page" :total-pages="expenses.meta.totalPages" :total="expenses.meta.total" @change="(p) => (ePage = p)" />
    </template>

    <!-- Receitas -->
    <template v-else-if="tab === 'revenues'">
      <DataTable :columns="rCols" :rows="rRows" :loading="lr" row-key="id" empty-message="Sem receitas.">
        <template #cell-receivedAt="{ value }">{{ formatDate(value as string) }}</template>
        <template #cell-amount="{ value }">{{ formatBRL(Number(value)) }}</template>
      </DataTable>
      <Pagination v-if="revenues" :page="revenues.meta.page" :total-pages="revenues.meta.totalPages" :total="revenues.meta.total" @change="(p) => (rPage = p)" />
    </template>

    <!-- Fluxo de caixa -->
    <template v-else>
      <Card class="p-4">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-medium">Fluxo de caixa {{ year }}</h2>
          <div class="flex items-end gap-2">
            <div>
              <Label>Relatório (mês)</Label>
              <Input v-model="reportMonth" type="month" class="w-40" />
            </div>
            <Button variant="outline" @click="report('pdf')"><FileDown class="h-4 w-4" /> PDF</Button>
            <Button variant="outline" @click="report('xlsx')"><FileDown class="h-4 w-4" /> Excel</Button>
          </div>
        </div>
        <div class="flex h-48 items-end gap-1">
          <div v-for="m in cashflow?.months" :key="m.month" class="flex flex-1 flex-col items-center gap-1">
            <div class="flex w-full items-end justify-center gap-0.5" style="height: 10rem">
              <div class="w-2 rounded-t bg-primary" :style="{ height: `${(m.revenue / maxFlow) * 100}%` }" :title="`Receita: ${formatBRL(m.revenue)}`" />
              <div class="w-2 rounded-t bg-destructive/70" :style="{ height: `${(m.expense / maxFlow) * 100}%` }" :title="`Despesa: ${formatBRL(m.expense)}`" />
            </div>
            <span class="text-[10px] text-muted-foreground">{{ m.month }}</span>
          </div>
        </div>
        <div v-if="cashflow" class="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>Receitas: <strong class="text-emerald-600">{{ formatBRL(cashflow.totals.revenue) }}</strong></div>
          <div>Despesas: <strong class="text-destructive">{{ formatBRL(cashflow.totals.expense) }}</strong></div>
          <div>Saldo: <strong>{{ formatBRL(cashflow.totals.balance) }}</strong></div>
        </div>
      </Card>
    </template>

    <Modal v-model:open="showExp" title="Nova despesa">
      <div class="space-y-3">
        <div><Label>Descrição</Label><Input v-model="expForm.description" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>Valor (R$)</Label><Input v-model="expForm.amount" type="number" step="0.01" /></div>
          <div><Label>Vencimento</Label><Input v-model="expForm.dueDate" type="date" /></div>
        </div>
        <div><Label>Categoria</Label><Select v-model="expForm.categoryId" :options="catOptions" placeholder="Sem categoria" /></div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showExp = false">Cancelar</Button>
        <Button :disabled="!expForm.description || !expForm.amount || !expForm.dueDate" @click="submitExp">Salvar</Button>
      </template>
    </Modal>

    <Modal v-model:open="showRev" title="Nova receita">
      <div class="space-y-3">
        <div><Label>Descrição</Label><Input v-model="revForm.description" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>Valor (R$)</Label><Input v-model="revForm.amount" type="number" step="0.01" /></div>
          <div><Label>Recebida em</Label><Input v-model="revForm.receivedAt" type="date" /></div>
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showRev = false">Cancelar</Button>
        <Button :disabled="!revForm.description || !revForm.amount || !revForm.receivedAt" @click="submitRev">Salvar</Button>
      </template>
    </Modal>
  </div>
</template>
