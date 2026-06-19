<script setup lang="ts">
import { computed, ref } from 'vue';
import { PackageIcon } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import DataTable, { type Column } from '@/components/common/DataTable.vue';
import Pagination from '@/components/common/Pagination.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { usePackages, type Package, type PackageStatus } from './api';

const page = ref(1);
const { data, isLoading } = usePackages(page);

const STATUS: Record<PackageStatus, { v: 'warning' | 'secondary' | 'success'; t: string }> = {
  RECEIVED: { v: 'warning', t: 'Na portaria' }, NOTIFIED: { v: 'warning', t: 'Aguardando retirada' }, PICKED_UP: { v: 'success', t: 'Retirada' },
};
const columns: Column[] = [
  { key: 'photo', label: '', class: 'w-14' },
  { key: 'description', label: 'Descrição' }, { key: 'carrier', label: 'Transportadora' },
  { key: 'apartment', label: 'Apartamento' }, { key: 'receivedAt', label: 'Recebida' }, { key: 'status', label: 'Status' },
];
const rows = computed(() => (data.value?.data ?? []) as unknown as Record<string, unknown>[]);
const aptLabel = (p: Package) => `${p.apartment.block ? p.apartment.block.name + ' · ' : ''}${p.apartment.number}`;

const selected = ref<Package | null>(null);
const detailOpen = computed({ get: () => !!selected.value, set: (o: boolean) => { if (!o) selected.value = null; } });
</script>

<template>
  <div>
    <PageHeader title="Encomendas" subtitle="Encomendas do seu apartamento" />
    <DataTable :columns="columns" :rows="rows" :loading="isLoading" row-key="id" empty-message="Nenhuma encomenda.">
      <template #cell-photo="{ row }">
        <img v-if="(row as unknown as Package).photoUrl" :src="(row as unknown as Package).photoUrl!" alt="" class="h-9 w-9 rounded-md object-cover" />
        <span v-else class="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground"><PackageIcon class="h-4 w-4" /></span>
      </template>
      <template #cell-description="{ row }">
        <button class="text-left font-medium hover:underline" @click="selected = row as unknown as Package">{{ (row as unknown as Package).description ?? 'Encomenda' }}</button>
      </template>
      <template #cell-carrier="{ value }">{{ value ?? '—' }}</template>
      <template #cell-apartment="{ row }">{{ aptLabel(row as unknown as Package) }}</template>
      <template #cell-receivedAt="{ value }">{{ formatDate(value as string) }}</template>
      <template #cell-status="{ value }"><Badge :variant="STATUS[value as PackageStatus].v">{{ STATUS[value as PackageStatus].t }}</Badge></template>
    </DataTable>
    <Pagination v-if="data" :page="data.meta.page" :total-pages="data.meta.totalPages" :total="data.meta.total" @change="(p) => (page = p)" />

    <Modal v-model:open="detailOpen" :title="selected?.description ?? 'Encomenda'">
      <div v-if="selected" class="space-y-4">
        <img v-if="selected.photoUrl" :src="selected.photoUrl" alt="Foto da encomenda" class="max-h-72 w-full rounded-md border object-contain" />
        <div v-else class="flex h-40 items-center justify-center rounded-md border bg-muted text-muted-foreground">
          <PackageIcon class="h-8 w-8" />
        </div>
        <div class="space-y-1 text-sm">
          <div class="flex justify-between"><span class="text-muted-foreground">Status</span><Badge :variant="STATUS[selected.status].v">{{ STATUS[selected.status].t }}</Badge></div>
          <div class="flex justify-between"><span class="text-muted-foreground">Apartamento</span><span>{{ aptLabel(selected) }}</span></div>
          <div v-if="selected.carrier" class="flex justify-between"><span class="text-muted-foreground">Transportadora</span><span>{{ selected.carrier }}</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">Recebida</span><span>{{ formatDate(selected.receivedAt) }}</span></div>
          <div v-if="selected.pickedUpAt" class="flex justify-between"><span class="text-muted-foreground">Retirada</span><span>{{ formatDate(selected.pickedUpAt) }}</span></div>
          <div v-if="selected.pickedUpBy" class="flex justify-between"><span class="text-muted-foreground">Retirada por</span><span>{{ selected.pickedUpBy }}</span></div>
        </div>
      </div>
      <template #footer><Button @click="selected = null">Fechar</Button></template>
    </Modal>
  </div>
</template>
