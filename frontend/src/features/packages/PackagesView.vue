<script setup lang="ts">
import { computed, ref } from 'vue';
import PageHeader from '@/components/common/PageHeader.vue';
import DataTable, { type Column } from '@/components/common/DataTable.vue';
import Pagination from '@/components/common/Pagination.vue';
import Badge from '@/components/ui/Badge.vue';
import { formatDate } from '@/lib/utils';
import { usePackages, type Package, type PackageStatus } from './api';

const page = ref(1);
const { data, isLoading } = usePackages(page);

const STATUS: Record<PackageStatus, { v: 'warning' | 'secondary' | 'success'; t: string }> = {
  RECEIVED: { v: 'warning', t: 'Na portaria' }, NOTIFIED: { v: 'warning', t: 'Aguardando retirada' }, PICKED_UP: { v: 'success', t: 'Retirada' },
};
const columns: Column[] = [
  { key: 'description', label: 'Descrição' }, { key: 'carrier', label: 'Transportadora' },
  { key: 'apartment', label: 'Apartamento' }, { key: 'receivedAt', label: 'Recebida' }, { key: 'status', label: 'Status' },
];
const rows = computed(() => (data.value?.data ?? []) as unknown as Record<string, unknown>[]);
</script>

<template>
  <div>
    <PageHeader title="Encomendas" subtitle="Encomendas do seu apartamento" />
    <DataTable :columns="columns" :rows="rows" :loading="isLoading" row-key="id" empty-message="Nenhuma encomenda.">
      <template #cell-description="{ value }">{{ value ?? 'Encomenda' }}</template>
      <template #cell-carrier="{ value }">{{ value ?? '—' }}</template>
      <template #cell-apartment="{ row }">{{ (row as unknown as Package).apartment.block ? (row as unknown as Package).apartment.block!.name + ' · ' : '' }}{{ (row as unknown as Package).apartment.number }}</template>
      <template #cell-receivedAt="{ value }">{{ formatDate(value as string) }}</template>
      <template #cell-status="{ value }"><Badge :variant="STATUS[value as PackageStatus].v">{{ STATUS[value as PackageStatus].t }}</Badge></template>
    </DataTable>
    <Pagination v-if="data" :page="data.meta.page" :total-pages="data.meta.totalPages" :total="data.meta.total" @change="(p) => (page = p)" />
  </div>
</template>
