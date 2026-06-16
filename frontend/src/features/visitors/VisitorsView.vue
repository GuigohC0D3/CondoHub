<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Plus, UserRound } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import DataTable, { type Column } from '@/components/common/DataTable.vue';
import Pagination from '@/components/common/Pagination.vue';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import { toast, apiError } from '@/lib/toast';
import { useVisitors, useCreateVisitor, type Visitor, type VisitorStatus } from './api';

const page = ref(1);
const { data, isLoading } = useVisitors(page);

const STATUS: Record<VisitorStatus, { v: 'warning' | 'success' | 'secondary' | 'destructive'; t: string }> = {
  EXPECTED: { v: 'warning', t: 'Esperado' }, CHECKED_IN: { v: 'success', t: 'Entrou' },
  CHECKED_OUT: { v: 'secondary', t: 'Saiu' }, DENIED: { v: 'destructive', t: 'Negado' },
};
const columns: Column[] = [
  { key: 'photo', label: '', class: 'w-14' },
  { key: 'fullName', label: 'Visitante' },
  { key: 'when', label: 'Quando' },
  { key: 'status', label: 'Status' },
];
const rows = computed(() => (data.value?.data ?? []) as unknown as Record<string, unknown>[]);

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null);
/** Data mais relevante por status para a coluna "Quando". */
function whenOf(v: Visitor): string {
  return fmt(v.checkedOutAt) ?? fmt(v.checkedInAt) ?? fmt(v.expectedAt) ?? '—';
}

// Detalhe / histórico
const selected = ref<Visitor | null>(null);
const detailOpen = computed({ get: () => !!selected.value, set: (o: boolean) => { if (!o) selected.value = null; } });

// Criação + QR
const showCreate = ref(false);
const form = reactive({ fullName: '', document: '' });
const create = useCreateVisitor();
const qrVisitor = ref<Visitor | null>(null);
const showQr = computed({ get: () => !!qrVisitor.value, set: (v: boolean) => { if (!v) qrVisitor.value = null; } });
const validUntil = computed(() => fmt(qrVisitor.value?.expiresAt ?? null));

async function submit() {
  try {
    const v = await create.mutateAsync({ fullName: form.fullName, document: form.document || undefined });
    showCreate.value = false;
    Object.assign(form, { fullName: '', document: '' });
    qrVisitor.value = v;
    toast.success('Visitante pré-cadastrado');
  } catch (e) { toast.error(apiError(e)); }
}
</script>

<template>
  <div>
    <PageHeader title="Visitantes" subtitle="Pré-cadastre visitantes e acompanhe o histórico">
      <template #actions><Button @click="showCreate = true"><Plus class="h-4 w-4" /> Novo visitante</Button></template>
    </PageHeader>

    <DataTable :columns="columns" :rows="rows" :loading="isLoading" row-key="id" empty-message="Nenhum visitante.">
      <template #cell-photo="{ row }">
        <img v-if="(row as unknown as Visitor).photoUrl" :src="(row as unknown as Visitor).photoUrl!" alt="" class="h-9 w-9 rounded-full object-cover" />
        <span v-else class="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"><UserRound class="h-4 w-4" /></span>
      </template>
      <template #cell-fullName="{ row }">
        <button class="text-left font-medium hover:underline" @click="selected = row as unknown as Visitor">{{ (row as unknown as Visitor).fullName }}</button>
      </template>
      <template #cell-when="{ row }">{{ whenOf(row as unknown as Visitor) }}</template>
      <template #cell-status="{ value }"><Badge :variant="STATUS[value as VisitorStatus].v">{{ STATUS[value as VisitorStatus].t }}</Badge></template>
    </DataTable>
    <Pagination v-if="data" :page="data.meta.page" :total-pages="data.meta.totalPages" :total="data.meta.total" @change="(p) => (page = p)" />

    <!-- Detalhe / histórico -->
    <Modal v-model:open="detailOpen" :title="selected?.fullName">
      <div v-if="selected" class="space-y-4">
        <div class="flex items-center gap-4">
          <img v-if="selected.photoUrl" :src="selected.photoUrl" alt="Foto" class="h-24 w-24 rounded-md object-cover" />
          <span v-else class="flex h-24 w-24 items-center justify-center rounded-md bg-muted text-muted-foreground"><UserRound class="h-8 w-8" /></span>
          <div class="space-y-1">
            <Badge :variant="STATUS[selected.status].v">{{ STATUS[selected.status].t }}</Badge>
            <p v-if="selected.document" class="text-sm text-muted-foreground">Doc.: {{ selected.document }}</p>
          </div>
        </div>
        <div class="space-y-1 text-sm">
          <div v-if="fmt(selected.expectedAt)" class="flex justify-between"><span class="text-muted-foreground">Esperado para</span><span>{{ fmt(selected.expectedAt) }}</span></div>
          <div v-if="fmt(selected.checkedInAt)" class="flex justify-between"><span class="text-muted-foreground">Entrada</span><span>{{ fmt(selected.checkedInAt) }}</span></div>
          <div v-if="fmt(selected.checkedOutAt)" class="flex justify-between"><span class="text-muted-foreground">Saída</span><span>{{ fmt(selected.checkedOutAt) }}</span></div>
          <p v-if="!fmt(selected.checkedInAt) && selected.status === 'EXPECTED'" class="text-muted-foreground">Aguardando chegada na portaria.</p>
        </div>
      </div>
      <template #footer><Button @click="selected = null">Fechar</Button></template>
    </Modal>

    <Modal v-model:open="showCreate" title="Novo visitante">
      <div class="space-y-3">
        <div><Label>Nome completo</Label><Input v-model="form.fullName" /></div>
        <div><Label>Documento (opcional)</Label><Input v-model="form.document" /></div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showCreate = false">Cancelar</Button>
        <Button :disabled="!form.fullName" @click="submit">Gerar QR</Button>
      </template>
    </Modal>

    <Modal v-model:open="showQr" title="QR de acesso" description="Mostre este código na portaria.">
      <div class="flex flex-col items-center gap-2">
        <img v-if="qrVisitor?.qrCodeDataUrl" :src="qrVisitor.qrCodeDataUrl" alt="QR" class="h-56 w-56 rounded-md border" />
        <p class="font-medium">{{ qrVisitor?.fullName }}</p>
        <p v-if="validUntil" class="text-xs text-muted-foreground">Válido até {{ validUntil }}</p>
      </div>
      <template #footer><Button @click="qrVisitor = null">Fechar</Button></template>
    </Modal>
  </div>
</template>
