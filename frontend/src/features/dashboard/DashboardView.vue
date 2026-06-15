<script setup lang="ts">
import { computed } from 'vue';
import { useDashboard } from './api';
import { formatBRL, formatDate } from '@/lib/utils';

const { data, isLoading, isError } = useDashboard();

const kpis = computed(() => {
  const k = data.value?.kpis;
  if (!k) return [];
  return [
    { label: 'Moradores', value: k.residents },
    { label: 'Aprovações pendentes', value: k.pendingResidents },
    { label: 'Chamados abertos', value: k.openTickets },
    { label: 'Encomendas pendentes', value: k.pendingPackages },
    { label: 'Receitas do mês', value: formatBRL(k.monthRevenue) },
    { label: 'Despesas do mês', value: formatBRL(k.monthExpense) },
  ];
});
const maxFlow = computed(() => {
  const m = data.value?.cashflow.months ?? [];
  return Math.max(1, ...m.map((x) => Math.max(x.revenue, x.expense)));
});
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold">Dashboard</h1>

    <p v-if="isLoading" class="text-muted-foreground">Carregando...</p>
    <p v-else-if="isError" class="text-destructive">Erro ao carregar o dashboard.</p>

    <template v-else>
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div v-for="k in kpis" :key="k.label" class="rounded-lg border bg-card p-4">
          <div class="text-sm text-muted-foreground">{{ k.label }}</div>
          <div class="mt-1 text-2xl font-semibold">{{ k.value }}</div>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="rounded-lg border bg-card p-4 lg:col-span-2">
          <h2 class="mb-4 font-medium">Fluxo de caixa {{ data?.cashflow.year }}</h2>
          <div class="flex h-40 items-end gap-1">
            <div v-for="m in data?.cashflow.months" :key="m.month" class="flex flex-1 flex-col items-center gap-1">
              <div class="flex w-full items-end justify-center gap-0.5" style="height: 8rem">
                <div class="w-1.5 rounded-t bg-primary" :style="{ height: `${(m.revenue / maxFlow) * 100}%` }" :title="`Receita: ${formatBRL(m.revenue)}`" />
                <div class="w-1.5 rounded-t bg-destructive/70" :style="{ height: `${(m.expense / maxFlow) * 100}%` }" :title="`Despesa: ${formatBRL(m.expense)}`" />
              </div>
              <span class="text-[10px] text-muted-foreground">{{ m.month }}</span>
            </div>
          </div>
          <div class="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span><span class="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />Receitas</span>
            <span><span class="mr-1 inline-block h-2 w-2 rounded-full bg-destructive/70" />Despesas</span>
          </div>
        </div>

        <div class="rounded-lg border bg-card p-4">
          <h2 class="mb-4 font-medium">Avisos recentes</h2>
          <ul class="space-y-2 text-sm">
            <li v-for="n in data?.recentNotices" :key="n.id" class="flex items-center gap-2">
              <span v-if="n.isPinned" class="text-primary">📌</span>
              <span class="truncate">{{ n.title }}</span>
              <span class="ml-auto text-xs text-muted-foreground">{{ formatDate(n.publishedAt) }}</span>
            </li>
            <li v-if="!data?.recentNotices.length" class="text-muted-foreground">Sem avisos.</li>
          </ul>
        </div>
      </div>

      <div class="rounded-lg border bg-card p-4">
        <h2 class="mb-4 font-medium">Próximas reservas</h2>
        <ul class="space-y-2 text-sm">
          <li v-for="r in data?.upcomingReservations" :key="r.id" class="flex items-center gap-2">
            <span>{{ r.commonArea.name }}</span>
            <span class="text-muted-foreground">— {{ r.resident.fullName }}</span>
            <span class="ml-auto text-xs text-muted-foreground">{{ formatDate(r.startsAt) }}</span>
          </li>
          <li v-if="!data?.upcomingReservations.length" class="text-muted-foreground">Nenhuma reserva futura.</li>
        </ul>
      </div>
    </template>
  </div>
</template>
