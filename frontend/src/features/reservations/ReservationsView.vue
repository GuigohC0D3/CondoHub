<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Plus, Check, X, Ban } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import DataTable, { type Column } from '@/components/common/DataTable.vue';
import Pagination from '@/components/common/Pagination.vue';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Label from '@/components/ui/Label.vue';
import { useAuthStore } from '@/stores/auth';
import { toast, apiError } from '@/lib/toast';
import {
  useCommonAreas, useReservations, useCreateReservation, useDecideReservation, useCancelReservation,
  useCreateCommonArea, useUpdateCommonArea,
  type Reservation, type ReservationStatus, type CommonArea,
} from './api';

const auth = useAuthStore();
const isSindico = computed(() => auth.role === 'SINDICO');
const isMorador = computed(() => auth.role === 'MORADOR');

const page = ref(1);
const { data, isLoading } = useReservations(page);
const { data: areas } = useCommonAreas();
const areaOptions = computed(() => (areas.value ?? []).filter((a) => a.isActive).map((a) => ({ value: a.id, label: a.name })));

const columns: Column[] = [
  { key: 'commonArea', label: 'Área' }, { key: 'resident', label: 'Morador' },
  { key: 'startsAt', label: 'Início' }, { key: 'endsAt', label: 'Fim' }, { key: 'status', label: 'Status' },
];
const statusBadge: Record<ReservationStatus, { v: 'warning' | 'success' | 'destructive' | 'secondary'; t: string }> = {
  PENDING: { v: 'warning', t: 'Pendente' }, APPROVED: { v: 'success', t: 'Aprovada' },
  REJECTED: { v: 'destructive', t: 'Rejeitada' }, CANCELED: { v: 'secondary', t: 'Cancelada' },
};
const rows = computed(() => (data.value?.data ?? []) as unknown as Record<string, unknown>[]);
const fmt = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const decide = useDecideReservation();
const cancel = useCancelReservation();
async function act(fn: Promise<unknown>, msg: string) { try { await fn; toast.success(msg); } catch (e) { toast.error(apiError(e)); } }

// Criar reserva (morador)
const showCreate = ref(false);
const form = reactive({ commonAreaId: '', date: '', start: '', end: '', notes: '' });
const create = useCreateReservation();
async function submit() {
  try {
    const startsAt = new Date(`${form.date}T${form.start}:00`).toISOString();
    const endsAt = new Date(`${form.date}T${form.end}:00`).toISOString();
    await create.mutateAsync({ commonAreaId: form.commonAreaId, startsAt, endsAt, notes: form.notes || undefined });
    toast.success('Reserva solicitada'); showCreate.value = false;
    Object.assign(form, { commonAreaId: '', date: '', start: '', end: '', notes: '' });
  } catch (e) { toast.error(apiError(e)); }
}

// Áreas (síndico): criar / editar / ativar-desativar
const showArea = ref(false);
const editingAreaId = ref<string | null>(null);
const blankArea = { name: '', approvalMode: 'MANUAL', maxPerMonthPerResident: 2, openTime: '08:00', closeTime: '22:00' };
const areaForm = reactive({ ...blankArea });
const createArea = useCreateCommonArea();
const updateArea = useUpdateCommonArea();

function openNewArea() {
  editingAreaId.value = null;
  Object.assign(areaForm, blankArea);
  showArea.value = true;
}
function openEditArea(a: CommonArea) {
  editingAreaId.value = a.id;
  Object.assign(areaForm, {
    name: a.name, approvalMode: a.approvalMode, maxPerMonthPerResident: a.maxPerMonthPerResident,
    openTime: a.openTime, closeTime: a.closeTime,
  });
  showArea.value = true;
}
async function submitArea() {
  try {
    const payload = { ...areaForm, maxPerMonthPerResident: Number(areaForm.maxPerMonthPerResident) };
    if (editingAreaId.value) {
      await updateArea.mutateAsync({ id: editingAreaId.value, data: payload });
      toast.success('Área atualizada');
    } else {
      await createArea.mutateAsync(payload);
      toast.success('Área criada');
    }
    showArea.value = false;
  } catch (e) { toast.error(apiError(e)); }
}
async function toggleArea(a: CommonArea) {
  try {
    await updateArea.mutateAsync({ id: a.id, data: { isActive: !a.isActive } });
    toast.success(a.isActive ? 'Área desativada' : 'Área reativada');
  } catch (e) { toast.error(apiError(e)); }
}
</script>

<template>
  <div>
    <PageHeader title="Reservas" subtitle="Áreas comuns e agendamentos">
      <template #actions>
        <Button v-if="isSindico" variant="outline" @click="openNewArea"><Plus class="h-4 w-4" /> Área</Button>
        <Button v-if="isMorador" @click="showCreate = true"><Plus class="h-4 w-4" /> Reservar</Button>
      </template>
    </PageHeader>

    <div v-if="isSindico && areas && areas.length" class="mb-6 rounded-lg border bg-card p-4">
      <h2 class="mb-3 text-sm font-medium">Áreas comuns</h2>
      <div class="flex flex-wrap gap-2">
        <div v-for="a in areas" :key="a.id" class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm" :class="{ 'opacity-50': !a.isActive }">
          <span class="font-medium">{{ a.name }}</span>
          <Badge :variant="a.approvalMode === 'AUTOMATIC' ? 'success' : 'secondary'">{{ a.approvalMode === 'AUTOMATIC' ? 'Auto' : 'Manual' }}</Badge>
          <button class="text-xs text-primary hover:underline" @click="openEditArea(a)">editar</button>
          <button class="text-xs text-muted-foreground hover:underline" @click="toggleArea(a)">{{ a.isActive ? 'desativar' : 'reativar' }}</button>
        </div>
      </div>
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="isLoading" row-key="id" empty-message="Nenhuma reserva.">
      <template #cell-commonArea="{ row }">{{ (row as unknown as Reservation).commonArea.name }}</template>
      <template #cell-resident="{ row }">{{ (row as unknown as Reservation).resident.fullName }}</template>
      <template #cell-startsAt="{ value }">{{ fmt(value as string) }}</template>
      <template #cell-endsAt="{ value }">{{ fmt(value as string) }}</template>
      <template #cell-status="{ value }"><Badge :variant="statusBadge[value as ReservationStatus].v">{{ statusBadge[value as ReservationStatus].t }}</Badge></template>
      <template #actions="{ row }">
        <template v-if="isSindico && (row as unknown as Reservation).status === 'PENDING'">
          <Button size="sm" variant="ghost" @click="act(decide.mutateAsync({ id: (row as any).id, approve: true }), 'Reserva aprovada')"><Check class="h-4 w-4 text-emerald-600" /></Button>
          <Button size="sm" variant="ghost" @click="act(decide.mutateAsync({ id: (row as any).id, approve: false }), 'Reserva rejeitada')"><X class="h-4 w-4 text-destructive" /></Button>
        </template>
        <Button v-if="['PENDING', 'APPROVED'].includes((row as unknown as Reservation).status)" size="sm" variant="ghost" @click="act(cancel.mutateAsync((row as any).id), 'Reserva cancelada')"><Ban class="h-4 w-4 text-muted-foreground" /></Button>
      </template>
    </DataTable>

    <Pagination v-if="data" :page="data.meta.page" :total-pages="data.meta.totalPages" :total="data.meta.total" @change="(p) => (page = p)" />

    <Modal v-model:open="showCreate" title="Nova reserva">
      <div class="space-y-3">
        <div><Label>Área</Label><Select v-model="form.commonAreaId" :options="areaOptions" placeholder="Selecione" /></div>
        <div><Label>Data</Label><Input v-model="form.date" type="date" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>Início</Label><Input v-model="form.start" type="time" /></div>
          <div><Label>Fim</Label><Input v-model="form.end" type="time" /></div>
        </div>
        <div><Label>Observação</Label><Input v-model="form.notes" /></div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showCreate = false">Cancelar</Button>
        <Button :disabled="!form.commonAreaId || !form.date || !form.start || !form.end" @click="submit">Reservar</Button>
      </template>
    </Modal>

    <Modal v-model:open="showArea" :title="editingAreaId ? 'Editar área comum' : 'Nova área comum'">
      <div class="space-y-3">
        <div><Label>Nome</Label><Input v-model="areaForm.name" placeholder="Salão de festas" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>Aprovação</Label><Select v-model="areaForm.approvalMode" :options="[{ value: 'MANUAL', label: 'Manual' }, { value: 'AUTOMATIC', label: 'Automática' }]" /></div>
          <div><Label>Limite/mês</Label><Input v-model="areaForm.maxPerMonthPerResident" type="number" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>Abre</Label><Input v-model="areaForm.openTime" type="time" /></div>
          <div><Label>Fecha</Label><Input v-model="areaForm.closeTime" type="time" /></div>
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showArea = false">Cancelar</Button>
        <Button :disabled="!areaForm.name" @click="submitArea">Salvar</Button>
      </template>
    </Modal>
  </div>
</template>
