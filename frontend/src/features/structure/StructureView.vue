<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Plus } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import DataTable, { type Column } from '@/components/common/DataTable.vue';
import Card from '@/components/ui/Card.vue';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Label from '@/components/ui/Label.vue';
import { toast, apiError } from '@/lib/toast';
import { useBlocks, useApartments, useCreateBlock, useCreateApartment } from './api';

const { data: blocks, isLoading: lb } = useBlocks();
const { data: apts, isLoading: la } = useApartments();

const blockCols: Column[] = [{ key: 'name', label: 'Bloco' }, { key: 'count', label: 'Apartamentos' }];
const aptCols: Column[] = [{ key: 'block', label: 'Bloco' }, { key: 'number', label: 'Número' }, { key: 'floor', label: 'Andar' }, { key: 'residents', label: 'Moradores' }];

const blockRows = computed(() => (blocks.value ?? []) as unknown as Record<string, unknown>[]);
const aptRows = computed(() => (apts.value?.data ?? []) as unknown as Record<string, unknown>[]);
const blockOptions = computed(() => (blocks.value ?? []).map((b) => ({ value: b.id, label: b.name })));

// Bloco
const showBlock = ref(false);
const blockForm = reactive({ name: '', apartmentCount: '', unitsPerFloor: '4', startFloor: '1' });
const createBlock = useCreateBlock();

// Prévia da numeração gerada (ex.: 101, 102, ...).
const previewNumbers = computed(() => {
  const count = Number(blockForm.apartmentCount);
  const upf = Math.max(1, Number(blockForm.unitsPerFloor) || 4);
  const start = Number(blockForm.startFloor) || 1;
  if (!count || count < 1) return '';
  const nums = Array.from({ length: Math.min(count, 4) }, (_, i) => {
    const floor = start + Math.floor(i / upf);
    return `${floor}${String((i % upf) + 1).padStart(2, '0')}`;
  });
  return nums.join(', ') + (count > 4 ? ', …' : '');
});

function resetBlock() {
  Object.assign(blockForm, { name: '', apartmentCount: '', unitsPerFloor: '4', startFloor: '1' });
}
async function submitBlock() {
  try {
    const count = Number(blockForm.apartmentCount);
    await createBlock.mutateAsync({
      name: blockForm.name,
      apartmentCount: count > 0 ? count : undefined,
      unitsPerFloor: count > 0 ? Number(blockForm.unitsPerFloor) || 4 : undefined,
      startFloor: count > 0 ? Number(blockForm.startFloor) || 1 : undefined,
    });
    toast.success(count > 0 ? `Bloco criado com ${count} apartamento(s)` : 'Bloco criado');
    showBlock.value = false;
    resetBlock();
  } catch (e) { toast.error(apiError(e)); }
}

// Apartamento
const showApt = ref(false);
const aptForm = reactive({ number: '', blockId: '', floor: '' });
const createApt = useCreateApartment();
async function submitApt() {
  try {
    await createApt.mutateAsync({ number: aptForm.number, blockId: aptForm.blockId || undefined, floor: aptForm.floor ? Number(aptForm.floor) : undefined });
    toast.success('Apartamento criado'); showApt.value = false;
    Object.assign(aptForm, { number: '', blockId: '', floor: '' });
  } catch (e) { toast.error(apiError(e)); }
}
</script>

<template>
  <div>
    <PageHeader title="Estrutura" subtitle="Blocos e apartamentos do condomínio" />
    <div class="grid gap-6 lg:grid-cols-2">
      <Card class="p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-medium">Blocos</h2>
          <Button size="sm" @click="showBlock = true"><Plus class="h-4 w-4" /> Bloco</Button>
        </div>
        <DataTable :columns="blockCols" :rows="blockRows" :loading="lb" row-key="id" empty-message="Sem blocos.">
          <template #cell-count="{ row }">{{ (row as any)._count?.apartments ?? 0 }}</template>
        </DataTable>
      </Card>

      <Card class="p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-medium">Apartamentos</h2>
          <Button size="sm" @click="showApt = true"><Plus class="h-4 w-4" /> Apartamento</Button>
        </div>
        <DataTable :columns="aptCols" :rows="aptRows" :loading="la" row-key="id" empty-message="Sem apartamentos.">
          <template #cell-block="{ row }">{{ (row as any).block?.name ?? '—' }}</template>
          <template #cell-floor="{ value }">{{ value ?? '—' }}</template>
          <template #cell-residents="{ row }">{{ (row as any)._count?.residents ?? 0 }}</template>
        </DataTable>
      </Card>
    </div>

    <Modal v-model:open="showBlock" title="Novo bloco">
      <div class="space-y-3">
        <div><Label>Nome</Label><Input v-model="blockForm.name" placeholder="Ex.: Bloco A, Torre 1" /></div>
        <div>
          <Label>Qtd. de apartamentos (opcional)</Label>
          <Input v-model="blockForm.apartmentCount" type="number" min="0" placeholder="Ex.: 20" />
          <p class="mt-1 text-xs text-muted-foreground">Deixe vazio para criar o bloco sem apartamentos.</p>
        </div>
        <div v-if="Number(blockForm.apartmentCount) > 0" class="grid grid-cols-2 gap-3">
          <div><Label>Aptos por andar</Label><Input v-model="blockForm.unitsPerFloor" type="number" min="1" /></div>
          <div><Label>Andar inicial</Label><Input v-model="blockForm.startFloor" type="number" /></div>
        </div>
        <p v-if="previewNumbers" class="text-xs text-muted-foreground">
          Numeração gerada: <span class="font-medium">{{ previewNumbers }}</span>
        </p>
      </div>
      <template #footer>
        <Button variant="outline" @click="showBlock = false">Cancelar</Button>
        <Button :disabled="!blockForm.name" @click="submitBlock">Salvar</Button>
      </template>
    </Modal>

    <Modal v-model:open="showApt" title="Novo apartamento">
      <div class="space-y-3">
        <div><Label>Bloco (opcional)</Label><Select v-model="aptForm.blockId" :options="blockOptions" placeholder="Sem bloco" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>Número</Label><Input v-model="aptForm.number" placeholder="101" /></div>
          <div><Label>Andar</Label><Input v-model="aptForm.floor" type="number" /></div>
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showApt = false">Cancelar</Button>
        <Button :disabled="!aptForm.number" @click="submitApt">Salvar</Button>
      </template>
    </Modal>
  </div>
</template>
