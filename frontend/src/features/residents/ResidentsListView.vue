<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Plus, Check, X, Car } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import DataTable, { type Column } from '@/components/common/DataTable.vue';
import Pagination from '@/components/common/Pagination.vue';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Label from '@/components/ui/Label.vue';
import { toast, apiError } from '@/lib/toast';
import { useApartments } from '@/features/structure/api';
import {
  useResidents, useCreateResident, useApproveResident, useUpdateResident,
  type ResidentStatus, type Resident,
} from './api';

const params = reactive({ status: undefined as ResidentStatus | undefined, search: undefined as string | undefined, page: 1, limit: 20 });
const searchInput = ref('');
const paramsRef = computed(() => params);
const { data, isLoading } = useResidents(paramsRef);

const statusOptions = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'APPROVED', label: 'Aprovados' },
  { value: 'REJECTED', label: 'Rejeitados' },
  { value: 'INACTIVE', label: 'Inativos' },
];
function setStatus(v: string | null | undefined) { params.status = (v || undefined) as ResidentStatus | undefined; params.page = 1; }
function applySearch() { params.search = searchInput.value || undefined; params.page = 1; }

const columns: Column[] = [
  { key: 'fullName', label: 'Nome' },
  { key: 'cpf', label: 'CPF' },
  { key: 'unit', label: 'Unidade' },
  { key: 'occupancy', label: 'Tipo' },
  { key: 'status', label: 'Status' },
];
const statusBadge: Record<ResidentStatus, { v: 'warning' | 'success' | 'destructive' | 'secondary'; t: string }> = {
  PENDING: { v: 'warning', t: 'Pendente' }, APPROVED: { v: 'success', t: 'Aprovado' },
  REJECTED: { v: 'destructive', t: 'Rejeitado' }, INACTIVE: { v: 'secondary', t: 'Inativo' },
};
const rows = computed(() => (data.value?.data ?? []) as unknown as Record<string, unknown>[]);

// --- Aprovação ---
const approveMut = useApproveResident();
async function decide(r: Resident, approve: boolean) {
  try {
    await approveMut.mutateAsync({ id: r.id, approve });
    toast.success(approve ? 'Morador aprovado' : 'Cadastro rejeitado');
  } catch (e) { toast.error(apiError(e)); }
}

// --- Criação ---
const showCreate = ref(false);
const { data: apts } = useApartments();
const aptOptions = computed(() => (apts.value?.data ?? []).map((a) => ({
  value: a.id, label: `${a.block ? a.block.name + ' · ' : ''}${a.number}`,
})));
const form = reactive({ fullName: '', cpf: '', apartmentId: '', occupancy: 'OWNER', email: '', phone: '' });
const createMut = useCreateResident();
async function submit() {
  try {
    await createMut.mutateAsync({
      fullName: form.fullName, cpf: form.cpf, apartmentId: form.apartmentId,
      occupancy: form.occupancy as 'OWNER' | 'TENANT',
      email: form.email || undefined, phone: form.phone || undefined,
    });
    toast.success('Morador cadastrado (pendente de aprovação)');
    showCreate.value = false;
    Object.assign(form, { fullName: '', cpf: '', apartmentId: '', occupancy: 'OWNER', email: '', phone: '' });
  } catch (e) { toast.error(apiError(e)); }
}

// --- Detalhe / edição ---
const editing = ref<Resident | null>(null);
const editForm = reactive({ fullName: '', email: '', phone: '', occupancy: 'OWNER', apartmentId: '' });
const updateMut = useUpdateResident();
function openEdit(r: Resident) {
  editing.value = r;
  // apartmentId fica vazio = manter o atual (mudança é opcional no form).
  Object.assign(editForm, {
    fullName: r.fullName, email: r.email ?? '', phone: r.phone ?? '',
    occupancy: r.occupancy, apartmentId: '',
  });
}
async function saveEdit() {
  if (!editing.value) return;
  try {
    await updateMut.mutateAsync({
      id: editing.value.id,
      data: {
        fullName: editForm.fullName,
        email: editForm.email || null,
        phone: editForm.phone || null,
        occupancy: editForm.occupancy as 'OWNER' | 'TENANT',
        ...(editForm.apartmentId ? { apartmentId: editForm.apartmentId } : {}),
      },
    });
    toast.success('Morador atualizado');
    editing.value = null;
  } catch (e) { toast.error(apiError(e)); }
}
const editOpen = computed({ get: () => !!editing.value, set: (v: boolean) => { if (!v) editing.value = null; } });
</script>

<template>
  <div>
    <PageHeader title="Moradores" subtitle="Cadastro e aprovação de moradores">
      <template #actions>
        <Button @click="showCreate = true"><Plus class="h-4 w-4" /> Novo morador</Button>
      </template>
    </PageHeader>

    <div class="mb-4 flex flex-wrap gap-2">
      <Select :options="statusOptions" :model-value="params.status ?? ''" placeholder="" class="w-48" @update:model-value="setStatus" />
      <form class="flex gap-2" @submit.prevent="applySearch">
        <Input v-model="searchInput" placeholder="Buscar por nome, CPF ou e-mail" class="w-64" />
        <Button variant="outline" type="submit">Buscar</Button>
      </form>
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="isLoading" row-key="id" empty-message="Nenhum morador encontrado.">
      <template #cell-fullName="{ row }">
        <button class="text-left font-medium hover:underline" @click="openEdit(row as unknown as Resident)">{{ (row as unknown as Resident).fullName }}</button>
      </template>
      <template #cell-unit="{ row }">
        {{ (row as unknown as Resident).apartment
          ? `${(row as unknown as Resident).apartment!.block ? (row as unknown as Resident).apartment!.block!.name + ' · ' : ''}${(row as unknown as Resident).apartment!.number}`
          : '—' }}
      </template>
      <template #cell-occupancy="{ value }">{{ value === 'OWNER' ? 'Proprietário' : 'Inquilino' }}</template>
      <template #cell-status="{ value }">
        <Badge :variant="statusBadge[value as ResidentStatus].v">{{ statusBadge[value as ResidentStatus].t }}</Badge>
      </template>
      <template #actions="{ row }">
        <template v-if="(row as unknown as Resident).status === 'PENDING'">
          <Button size="sm" variant="ghost" @click="decide(row as unknown as Resident, true)"><Check class="h-4 w-4 text-emerald-600" /></Button>
          <Button size="sm" variant="ghost" @click="decide(row as unknown as Resident, false)"><X class="h-4 w-4 text-destructive" /></Button>
        </template>
        <span v-else class="text-xs text-muted-foreground">—</span>
      </template>
    </DataTable>

    <Pagination
      v-if="data" :page="data.meta.page" :total-pages="data.meta.totalPages" :total="data.meta.total"
      @change="(p) => (params.page = p)"
    />

    <Modal v-model:open="showCreate" title="Novo morador" description="O cadastro entra como pendente até aprovação.">
      <form class="space-y-3" @submit.prevent="submit">
        <div><Label>Nome completo</Label><Input v-model="form.fullName" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>CPF</Label><Input v-model="form.cpf" placeholder="000.000.000-00" /></div>
          <div>
            <Label>Tipo</Label>
            <Select v-model="form.occupancy" :options="[{ value: 'OWNER', label: 'Proprietário' }, { value: 'TENANT', label: 'Inquilino' }]" />
          </div>
        </div>
        <div>
          <Label>Apartamento</Label>
          <Select v-model="form.apartmentId" :options="aptOptions" placeholder="Selecione" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>E-mail</Label><Input v-model="form.email" type="email" /></div>
          <div><Label>Telefone</Label><Input v-model="form.phone" /></div>
        </div>
      </form>
      <template #footer>
        <Button variant="outline" @click="showCreate = false">Cancelar</Button>
        <Button :disabled="createMut.isPending.value || !form.fullName || !form.cpf || !form.apartmentId" @click="submit">Salvar</Button>
      </template>
    </Modal>

    <Modal v-model:open="editOpen" :title="editing?.fullName" description="Editar dados do morador">
      <div v-if="editing" class="space-y-3">
        <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>CPF {{ editing.cpf }}</span>
          <Badge :variant="statusBadge[editing.status].v">{{ statusBadge[editing.status].t }}</Badge>
          <Badge v-if="!editing.userId" variant="warning">Sem login</Badge>
          <Badge v-else variant="success">Com login</Badge>
        </div>
        <div><Label>Nome completo</Label><Input v-model="editForm.fullName" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>E-mail</Label><Input v-model="editForm.email" type="email" /></div>
          <div><Label>Telefone</Label><Input v-model="editForm.phone" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select v-model="editForm.occupancy" :options="[{ value: 'OWNER', label: 'Proprietário' }, { value: 'TENANT', label: 'Inquilino' }]" />
          </div>
          <div>
            <Label>Mudar de apartamento</Label>
            <Select v-model="editForm.apartmentId" :options="aptOptions" placeholder="Manter atual" />
          </div>
        </div>
        <div v-if="editing.vehicles.length">
          <Label>Veículos</Label>
          <div class="mt-1 flex flex-wrap gap-2">
            <span v-for="v in editing.vehicles" :key="v.id" class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
              <Car class="h-3 w-3" /> {{ v.plate }}<template v-if="v.model"> · {{ v.model }}</template>
            </span>
          </div>
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="editing = null">Cancelar</Button>
        <Button :disabled="updateMut.isPending.value || !editForm.fullName" @click="saveEdit">Salvar alterações</Button>
      </template>
    </Modal>
  </div>
</template>
