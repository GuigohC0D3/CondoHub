<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Plus, QrCode, Check, X } from 'lucide-vue-next';
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
import { useApartments } from '@/features/structure/api';
import {
  useCharges, useMyCharges, useCreateCharge, useCreateBatch, useCancelCharge, useSimulatePayment,
  type Charge, type ChargeStatus,
} from './api';

const auth = useAuthStore();
const isSindico = computed(() => auth.role === 'SINDICO');

const STATUS: Record<ChargeStatus, { v: 'warning' | 'success' | 'destructive' | 'secondary'; t: string }> = {
  PENDING: { v: 'warning', t: 'Pendente' },
  PAID: { v: 'success', t: 'Pago' },
  OVERDUE: { v: 'destructive', t: 'Vencido' },
  CANCELED: { v: 'secondary', t: 'Cancelado' },
  REFUNDED: { v: 'secondary', t: 'Estornado' },
};

const brl = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (s: string) => new Date(s).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

const page = ref(1);
const status = ref('');
const sindicoQuery = useCharges(page, status);
const moradorQuery = useMyCharges(page);
const data = computed(() => (isSindico.value ? sindicoQuery.data.value : moradorQuery.data.value));
const isLoading = computed(() => (isSindico.value ? sindicoQuery.isLoading.value : moradorQuery.isLoading.value));
const rows = computed(() => (data.value?.data ?? []) as unknown as Record<string, unknown>[]);

const statusOptions = [{ value: '', label: 'Todos os status' }, ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.t }))];

const columns = computed<Column[]>(() => [
  ...(isSindico.value ? [{ key: 'unit', label: 'Unidade' }, { key: 'payer', label: 'Morador' }] : []),
  { key: 'description', label: 'Descrição' },
  { key: 'amount', label: 'Valor' },
  { key: 'dueDate', label: 'Vencimento' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '' },
]);
const unitOf = (c: Charge) => (c.apartment ? `${c.apartment.block ? c.apartment.block.name + ' · ' : ''}${c.apartment.number}` : '—');

// PIX / boleto
const pixCharge = ref<Charge | null>(null);
async function copyPix() {
  if (pixCharge.value?.pixPayload) {
    await navigator.clipboard.writeText(pixCharge.value.pixPayload);
    toast.success('Código PIX copiado');
  }
}

// Pagamento (demo) e cancelamento
const simulate = useSimulatePayment();
async function pay(c: Charge) {
  try { await simulate.mutateAsync(c.id); toast.success('Pagamento confirmado (demo)'); }
  catch (e) { toast.error(apiError(e)); }
}
const cancel = useCancelCharge();
async function doCancel(c: Charge) {
  if (!confirm(`Cancelar a cobrança "${c.description}"?`)) return;
  try { await cancel.mutateAsync(c.id); toast.success('Cobrança cancelada'); }
  catch (e) { toast.error(apiError(e)); }
}

// Criar cobrança (síndico)
const showCreate = ref(false);
const { data: apts } = useApartments();
const aptOptions = computed(() => (apts.value?.data ?? []).map((a) => ({ value: a.id, label: `${a.block?.name ? a.block.name + ' · ' : ''}${a.number}` })));
const form = reactive({ apartmentId: '', description: '', amount: '', dueDate: '', method: 'PIX' });
const createCharge = useCreateCharge();
async function submitCharge() {
  try {
    await createCharge.mutateAsync({ apartmentId: form.apartmentId, description: form.description, amount: Number(form.amount), dueDate: form.dueDate, method: form.method });
    toast.success('Cobrança criada'); showCreate.value = false;
    Object.assign(form, { apartmentId: '', description: '', amount: '', dueDate: '', method: 'PIX' });
  } catch (e) { toast.error(apiError(e)); }
}

// Lote mensal (síndico)
const showBatch = ref(false);
const batch = reactive({ referenceMonth: '', amount: '', dueDate: '', description: '', method: 'PIX' });
const createBatch = useCreateBatch();
async function submitBatch() {
  try {
    const r = await createBatch.mutateAsync({ referenceMonth: batch.referenceMonth, amount: Number(batch.amount), dueDate: batch.dueDate, description: batch.description || undefined, method: batch.method });
    toast.success(`Lote gerado: ${r.issued ?? ''} cobrança(s)`); showBatch.value = false;
    Object.assign(batch, { referenceMonth: '', amount: '', dueDate: '', description: '', method: 'PIX' });
  } catch (e) { toast.error(apiError(e)); }
}
</script>

<template>
  <div>
    <PageHeader title="Cobranças" subtitle="Taxas e cobranças do condomínio">
      <template #actions>
        <template v-if="isSindico">
          <Button variant="outline" @click="showBatch = true"><Plus class="h-4 w-4" /> Lote mensal</Button>
          <Button @click="showCreate = true"><Plus class="h-4 w-4" /> Nova cobrança</Button>
        </template>
      </template>
    </PageHeader>

    <div v-if="isSindico" class="mb-4 w-52">
      <Select v-model="status" :options="statusOptions" />
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="isLoading" row-key="id" empty-message="Nenhuma cobrança.">
      <template #cell-unit="{ row }">{{ unitOf(row as unknown as Charge) }}</template>
      <template #cell-payer="{ row }">{{ (row as unknown as Charge).resident?.fullName ?? '—' }}</template>
      <template #cell-amount="{ row }">{{ brl((row as unknown as Charge).amount) }}</template>
      <template #cell-dueDate="{ row }">{{ date((row as unknown as Charge).dueDate) }}</template>
      <template #cell-status="{ value }"><Badge :variant="STATUS[value as ChargeStatus].v">{{ STATUS[value as ChargeStatus].t }}</Badge></template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1">
          <Button
            v-if="(row as unknown as Charge).pixPayload || (row as unknown as Charge).boletoUrl"
            size="sm" variant="outline" @click="pixCharge = row as unknown as Charge"
          ><QrCode class="h-4 w-4" /> PIX</Button>
          <template v-if="isSindico">
            <Button
              v-if="['PENDING', 'OVERDUE'].includes((row as unknown as Charge).status)"
              size="sm" variant="outline" title="Confirmar pagamento (demo)" @click="pay(row as unknown as Charge)"
            ><Check class="h-4 w-4" /></Button>
            <Button
              v-if="!['PAID', 'CANCELED'].includes((row as unknown as Charge).status)"
              size="sm" variant="ghost" title="Cancelar" @click="doCancel(row as unknown as Charge)"
            ><X class="h-4 w-4" /></Button>
          </template>
        </div>
      </template>
    </DataTable>

    <Pagination v-if="data" :page="data.meta.page" :total-pages="data.meta.totalPages" :total="data.meta.total" @change="(p) => (page = p)" />

    <!-- PIX / Boleto -->
    <Modal :open="!!pixCharge" title="Pagamento" @update:open="(v) => { if (!v) pixCharge = null; }">
      <div v-if="pixCharge" class="space-y-3 text-center">
        <p class="text-lg font-semibold">{{ brl(pixCharge.amount) }}</p>
        <p class="text-sm text-muted-foreground">{{ pixCharge.description }} · vence {{ date(pixCharge.dueDate) }}</p>
        <img v-if="pixCharge.pixQrCodeUrl" :src="pixCharge.pixQrCodeUrl" alt="QR Code PIX" class="mx-auto h-56 w-56 rounded border" />
        <div v-if="pixCharge.pixPayload" class="space-y-2">
          <p class="break-all rounded-md bg-muted/40 p-2 text-left text-xs">{{ pixCharge.pixPayload }}</p>
          <Button class="w-full" variant="outline" @click="copyPix">Copiar código PIX (copia e cola)</Button>
        </div>
        <a v-if="pixCharge.boletoUrl" :href="pixCharge.boletoUrl" target="_blank" class="block text-sm text-primary hover:underline">Abrir boleto</a>
      </div>
    </Modal>

    <!-- Nova cobrança -->
    <Modal v-model:open="showCreate" title="Nova cobrança">
      <div class="space-y-3">
        <div><Label>Unidade</Label><Select v-model="form.apartmentId" :options="aptOptions" placeholder="Selecione" /></div>
        <div><Label>Descrição</Label><Input v-model="form.description" placeholder="Ex.: Taxa condominial junho" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>Valor (R$)</Label><Input v-model="form.amount" type="number" step="0.01" /></div>
          <div><Label>Vencimento</Label><Input v-model="form.dueDate" type="date" /></div>
        </div>
        <div><Label>Método</Label><Select v-model="form.method" :options="[{ value: 'PIX', label: 'PIX' }, { value: 'BOLETO', label: 'Boleto' }]" /></div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showCreate = false">Cancelar</Button>
        <Button :disabled="!form.apartmentId || !form.description || !form.amount || !form.dueDate" @click="submitCharge">Criar</Button>
      </template>
    </Modal>

    <!-- Lote mensal -->
    <Modal v-model:open="showBatch" title="Gerar lote mensal">
      <div class="space-y-3">
        <p class="text-sm text-muted-foreground">Cria uma cobrança para cada unidade no mês de referência.</p>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>Mês (AAAA-MM)</Label><Input v-model="batch.referenceMonth" placeholder="2026-06" /></div>
          <div><Label>Vencimento</Label><Input v-model="batch.dueDate" type="date" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>Valor (R$)</Label><Input v-model="batch.amount" type="number" step="0.01" /></div>
          <div><Label>Método</Label><Select v-model="batch.method" :options="[{ value: 'PIX', label: 'PIX' }, { value: 'BOLETO', label: 'Boleto' }]" /></div>
        </div>
        <div><Label>Descrição (opcional)</Label><Input v-model="batch.description" placeholder="Taxa condominial" /></div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showBatch = false">Cancelar</Button>
        <Button :disabled="!batch.referenceMonth || !batch.amount || !batch.dueDate" @click="submitBatch">Gerar lote</Button>
      </template>
    </Modal>
  </div>
</template>
