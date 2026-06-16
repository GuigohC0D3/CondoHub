<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Plus } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import DataTable, { type Column } from '@/components/common/DataTable.vue';
import Pagination from '@/components/common/Pagination.vue';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Select from '@/components/ui/Select.vue';
import Label from '@/components/ui/Label.vue';
import { useAuthStore } from '@/stores/auth';
import { toast, apiError } from '@/lib/toast';
import {
  useTickets, useTicket, useCreateTicket, useUpdateTicket, useAddComment,
  type Ticket, type TicketStatus, type TicketPriority,
} from './api';

const auth = useAuthStore();
const isSindico = computed(() => auth.role === 'SINDICO');
const isMorador = computed(() => auth.role === 'MORADOR');

const page = ref(1);
const { data, isLoading } = useTickets(page);

const CATEGORY: Record<string, string> = { LEAK: 'Vazamento', CLEANING: 'Limpeza', NOISE: 'Barulho', SECURITY: 'Segurança', MAINTENANCE: 'Manutenção', OTHER: 'Outro' };
const STATUS: Record<TicketStatus, { v: 'warning' | 'secondary' | 'success'; t: string }> = {
  OPEN: { v: 'warning', t: 'Aberto' }, IN_PROGRESS: { v: 'secondary', t: 'Em andamento' },
  RESOLVED: { v: 'success', t: 'Resolvido' }, CLOSED: { v: 'secondary', t: 'Fechado' },
};
const PRIORITY: Record<TicketPriority, { v: 'secondary' | 'warning' | 'destructive'; t: string }> = {
  LOW: { v: 'secondary', t: 'Baixa' }, MEDIUM: { v: 'secondary', t: 'Média' },
  HIGH: { v: 'warning', t: 'Alta' }, URGENT: { v: 'destructive', t: 'Urgente' },
};
const columns: Column[] = [
  { key: 'title', label: 'Título' }, { key: 'category', label: 'Categoria' },
  { key: 'priority', label: 'Prioridade' }, { key: 'status', label: 'Status' }, { key: 'resident', label: 'Morador' },
];
const rows = computed(() => (data.value?.data ?? []) as unknown as Record<string, unknown>[]);

// Detalhe
const selectedId = ref<string | null>(null);
const { data: ticket } = useTicket(selectedId);
const showDetail = computed({ get: () => !!selectedId.value, set: (v) => { if (!v) selectedId.value = null; } });
const newComment = ref('');
const addComment = useAddComment();
const update = useUpdateTicket();
async function comment() {
  if (!newComment.value || !selectedId.value) return;
  try { await addComment.mutateAsync({ id: selectedId.value, body: newComment.value }); newComment.value = ''; }
  catch (e) { toast.error(apiError(e)); }
}
async function changeStatus(status: string) {
  if (!selectedId.value) return;
  try { await update.mutateAsync({ id: selectedId.value, data: { status } }); toast.success('Status atualizado'); }
  catch (e) { toast.error(apiError(e)); }
}

// Criar (morador)
const showCreate = ref(false);
const form = reactive({ title: '', description: '', category: 'OTHER', priority: 'MEDIUM' });
const create = useCreateTicket();
async function submit() {
  try {
    await create.mutateAsync({ ...form });
    toast.success('Chamado aberto'); showCreate.value = false;
    Object.assign(form, { title: '', description: '', category: 'OTHER', priority: 'MEDIUM' });
  } catch (e) { toast.error(apiError(e)); }
}
const catOptions = Object.entries(CATEGORY).map(([value, label]) => ({ value, label }));
const statusOptions = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.t }));
</script>

<template>
  <div>
    <PageHeader title="Chamados" subtitle="Solicitações e manutenção">
      <template #actions>
        <Button v-if="isMorador" @click="showCreate = true"><Plus class="h-4 w-4" /> Abrir chamado</Button>
      </template>
    </PageHeader>

    <DataTable :columns="columns" :rows="rows" :loading="isLoading" row-key="id" empty-message="Nenhum chamado.">
      <template #cell-title="{ row }">
        <button class="text-left font-medium hover:underline" @click="selectedId = (row as any).id">{{ (row as unknown as Ticket).title }}</button>
      </template>
      <template #cell-category="{ value }">{{ CATEGORY[value as string] }}</template>
      <template #cell-priority="{ value }"><Badge :variant="PRIORITY[value as TicketPriority].v">{{ PRIORITY[value as TicketPriority].t }}</Badge></template>
      <template #cell-status="{ value }"><Badge :variant="STATUS[value as TicketStatus].v">{{ STATUS[value as TicketStatus].t }}</Badge></template>
      <template #cell-resident="{ row }">{{ (row as unknown as Ticket).resident.fullName }}</template>
    </DataTable>

    <Pagination v-if="data" :page="data.meta.page" :total-pages="data.meta.totalPages" :total="data.meta.total" @change="(p) => (page = p)" />

    <!-- Detalhe -->
    <Modal v-model:open="showDetail" :title="ticket?.title">
      <div v-if="ticket" class="space-y-4">
        <p class="whitespace-pre-line text-sm text-muted-foreground">{{ ticket.description }}</p>
        <div class="flex flex-wrap gap-2">
          <Badge :variant="PRIORITY[ticket.priority].v">{{ PRIORITY[ticket.priority].t }}</Badge>
          <Badge :variant="STATUS[ticket.status].v">{{ STATUS[ticket.status].t }}</Badge>
        </div>
        <div v-if="isSindico">
          <Label>Alterar status</Label>
          <Select :model-value="ticket.status" :options="statusOptions" @update:model-value="(v) => v && changeStatus(v)" />
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium">Comentários</h3>
          <div class="space-y-2">
            <div v-for="c in ticket.comments" :key="c.id" class="rounded-md bg-muted/40 p-2 text-sm">
              <div class="text-xs text-muted-foreground">{{ c.author.name }}</div>
              <div>{{ c.body }}</div>
            </div>
            <p v-if="!ticket.comments?.length" class="text-sm text-muted-foreground">Sem comentários.</p>
          </div>
          <div class="mt-2 flex gap-2">
            <Input v-model="newComment" placeholder="Escrever comentário..." @keyup.enter="comment" />
            <Button :disabled="!newComment" @click="comment">Enviar</Button>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Criar -->
    <Modal v-model:open="showCreate" title="Abrir chamado">
      <div class="space-y-3">
        <div><Label>Título</Label><Input v-model="form.title" /></div>
        <div><Label>Descrição</Label><Textarea v-model="form.description" :rows="4" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>Categoria</Label><Select v-model="form.category" :options="catOptions" /></div>
          <div><Label>Prioridade</Label><Select v-model="form.priority" :options="[{ value: 'LOW', label: 'Baixa' }, { value: 'MEDIUM', label: 'Média' }, { value: 'HIGH', label: 'Alta' }, { value: 'URGENT', label: 'Urgente' }]" /></div>
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showCreate = false">Cancelar</Button>
        <Button :disabled="!form.title || !form.description" @click="submit">Abrir</Button>
      </template>
    </Modal>
  </div>
</template>
