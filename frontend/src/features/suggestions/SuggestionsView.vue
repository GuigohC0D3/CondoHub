<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Plus, ThumbsUp, Trash2 } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import Pagination from '@/components/common/Pagination.vue';
import Card from '@/components/ui/Card.vue';
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
  useSuggestions, useCreateSuggestion, useVoteSuggestion, useSetSuggestionStatus, useDeleteSuggestion,
  type Suggestion, type SuggestionStatus, type SuggestionCategory, type SuggestionFilters,
} from './api';

const auth = useAuthStore();
const isSindico = computed(() => auth.role === 'SINDICO');
const isMorador = computed(() => auth.role === 'MORADOR');

const CATEGORY: Record<SuggestionCategory, string> = {
  COMMON_AREAS: 'Áreas comuns', SECURITY: 'Segurança', SUSTAINABILITY: 'Sustentabilidade',
  INFRASTRUCTURE: 'Infraestrutura', FINANCE: 'Financeiro', OTHER: 'Outro',
};
const STATUS: Record<SuggestionStatus, { v: 'warning' | 'secondary' | 'success' | 'destructive'; t: string }> = {
  OPEN: { v: 'warning', t: 'Aberta' }, UNDER_REVIEW: { v: 'secondary', t: 'Em análise' },
  PLANNED: { v: 'success', t: 'Planejada' }, DONE: { v: 'success', t: 'Concluída' }, REJECTED: { v: 'destructive', t: 'Recusada' },
};

const page = ref(1);
const filters = ref<SuggestionFilters>({ sort: 'votes' });
const { data, isLoading } = useSuggestions(page, filters);
const items = computed(() => data.value?.data ?? []);

const catOptions = Object.entries(CATEGORY).map(([value, label]) => ({ value, label }));
const statusOptions = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.t }));
const sortOptions = [{ value: 'votes', label: 'Mais votadas' }, { value: 'recent', label: 'Recentes' }];

const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { dateStyle: 'short' }) : '—');
const unitOf = (s: Suggestion) =>
  s.resident.apartment ? `${s.resident.apartment.block ? s.resident.apartment.block.name + ' · ' : ''}${s.resident.apartment.number}` : '';

// Votar
const vote = useVoteSuggestion();
async function toggleVote(s: Suggestion) {
  try { await vote.mutateAsync(s.id); } catch (e) { toast.error(apiError(e)); }
}

// Criar (morador)
const showCreate = ref(false);
const form = reactive({ title: '', description: '', category: 'OTHER' });
const create = useCreateSuggestion();
async function submit() {
  try {
    await create.mutateAsync({ ...form });
    toast.success('Sugestão enviada'); showCreate.value = false;
    Object.assign(form, { title: '', description: '', category: 'OTHER' });
  } catch (e) { toast.error(apiError(e)); }
}

// Gerenciar (síndico)
const manage = reactive({ open: false, id: '', title: '', status: 'OPEN' as string, message: '' });
const setStatus = useSetSuggestionStatus();
function openManage(s: Suggestion) {
  Object.assign(manage, { open: true, id: s.id, title: s.title, status: s.status, message: s.responseMessage ?? '' });
}
async function saveStatus() {
  try {
    await setStatus.mutateAsync({ id: manage.id, status: manage.status, message: manage.message || undefined });
    toast.success('Sugestão atualizada'); manage.open = false;
  } catch (e) { toast.error(apiError(e)); }
}

// Remover
const del = useDeleteSuggestion();
async function remove(s: Suggestion) {
  if (!confirm(`Remover a sugestão "${s.title}"?`)) return;
  try { await del.mutateAsync(s.id); toast.success('Sugestão removida'); } catch (e) { toast.error(apiError(e)); }
}
const canDelete = (s: Suggestion) => isSindico.value || (s.isAuthor && s.status === 'OPEN');
</script>

<template>
  <div>
    <PageHeader title="Sugestões" subtitle="Ideias de melhoria para o condomínio">
      <template #actions>
        <Button v-if="isMorador" @click="showCreate = true"><Plus class="h-4 w-4" /> Nova sugestão</Button>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <div class="w-44"><Select v-model="filters.sort" :options="sortOptions" /></div>
      <div class="w-48"><Select :model-value="filters.status ?? ''" :options="[{ value: '', label: 'Todos os status' }, ...statusOptions]" @update:model-value="(v) => (filters.status = (v || undefined) as SuggestionStatus | undefined)" /></div>
      <div class="w-48"><Select :model-value="filters.category ?? ''" :options="[{ value: '', label: 'Todas as categorias' }, ...catOptions]" @update:model-value="(v) => (filters.category = (v || undefined) as SuggestionCategory | undefined)" /></div>
    </div>

    <p v-if="isLoading" class="text-sm text-muted-foreground">Carregando…</p>
    <p v-else-if="!items.length" class="text-sm text-muted-foreground">Nenhuma sugestão ainda. Seja o primeiro a propor uma melhoria!</p>

    <div class="grid gap-3">
      <Card v-for="s in items" :key="s.id" class="p-4">
        <div class="flex items-start gap-4">
          <!-- Voto -->
          <button
            class="flex w-16 shrink-0 flex-col items-center rounded-md border py-2 transition"
            :class="s.hasVoted ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'"
            :disabled="!isMorador"
            @click="toggleVote(s)"
          >
            <ThumbsUp class="h-4 w-4" />
            <span class="mt-1 text-lg font-semibold leading-none">{{ s._count?.votes ?? 0 }}</span>
            <span class="text-[10px] text-muted-foreground">votos</span>
          </button>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-medium">{{ s.title }}</h3>
              <Badge variant="outline">{{ CATEGORY[s.category] }}</Badge>
              <Badge :variant="STATUS[s.status].v">{{ STATUS[s.status].t }}</Badge>
            </div>
            <p class="mt-1 whitespace-pre-line text-sm text-muted-foreground">{{ s.description }}</p>
            <p class="mt-2 text-xs text-muted-foreground">
              por {{ s.resident.fullName }}<span v-if="unitOf(s)"> · {{ unitOf(s) }}</span> · {{ fmt(s.createdAt) }}
            </p>

            <div v-if="s.responseMessage" class="mt-2 rounded-md border-l-2 border-primary bg-muted/40 p-2 text-sm">
              <span class="text-xs font-medium text-muted-foreground">Resposta da administração:</span>
              <p class="mt-0.5">{{ s.responseMessage }}</p>
            </div>

            <div class="mt-3 flex gap-2">
              <Button v-if="isSindico" size="sm" variant="outline" @click="openManage(s)">Gerenciar</Button>
              <Button v-if="canDelete(s)" size="sm" variant="ghost" @click="remove(s)"><Trash2 class="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <Pagination v-if="data" :page="data.meta.page" :total-pages="data.meta.totalPages" :total="data.meta.total" @change="(p) => (page = p)" />

    <!-- Criar -->
    <Modal v-model:open="showCreate" title="Nova sugestão">
      <div class="space-y-3">
        <div><Label>Título</Label><Input v-model="form.title" placeholder="Ex.: Instalar bicicletário" /></div>
        <div><Label>Descrição</Label><Textarea v-model="form.description" :rows="4" placeholder="Descreva a melhoria e o benefício para o condomínio" /></div>
        <div><Label>Categoria</Label><Select v-model="form.category" :options="catOptions" /></div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showCreate = false">Cancelar</Button>
        <Button :disabled="!form.title || !form.description" @click="submit">Enviar</Button>
      </template>
    </Modal>

    <!-- Gerenciar (síndico) -->
    <Modal v-model:open="manage.open" :title="`Gerenciar: ${manage.title}`">
      <div class="space-y-3">
        <div><Label>Status</Label><Select v-model="manage.status" :options="statusOptions" /></div>
        <div>
          <Label>Resposta ao autor (opcional)</Label>
          <Textarea v-model="manage.message" :rows="3" placeholder="Mensagem enviada ao morador junto da notificação" />
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="manage.open = false">Cancelar</Button>
        <Button @click="saveStatus">Salvar</Button>
      </template>
    </Modal>
  </div>
</template>
