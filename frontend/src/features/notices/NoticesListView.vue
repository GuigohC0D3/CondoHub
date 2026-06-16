<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Plus, Pin, Paperclip, Trash2, Check } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import Pagination from '@/components/common/Pagination.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import Card from '@/components/ui/Card.vue';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Label from '@/components/ui/Label.vue';
import { useAuthStore } from '@/stores/auth';
import { formatDate } from '@/lib/utils';
import { toast, apiError } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { useNotices, useCreateNotice, useMarkRead, useDeleteNotice } from './api';

const auth = useAuthStore();
const isSindico = computed(() => auth.role === 'SINDICO');
const page = ref(1);
const { data, isLoading } = useNotices(page);

const markRead = useMarkRead();
const del = useDeleteNotice();
async function read(id: string) { try { await markRead.mutateAsync(id); } catch (e) { toast.error(apiError(e)); } }
async function remove(id: string) {
  if (!(await confirm({ title: 'Excluir aviso', message: 'Esta ação não pode ser desfeita.', destructive: true, confirmLabel: 'Excluir' }))) return;
  try { await del.mutateAsync(id); toast.success('Aviso excluído'); } catch (e) { toast.error(apiError(e)); }
}

const showCreate = ref(false);
const form = reactive({ title: '', body: '', isPinned: false });
const create = useCreateNotice();
async function submit() {
  try {
    await create.mutateAsync({ ...form });
    toast.success('Aviso publicado'); showCreate.value = false;
    Object.assign(form, { title: '', body: '', isPinned: false });
  } catch (e) { toast.error(apiError(e)); }
}
</script>

<template>
  <div>
    <PageHeader title="Avisos" subtitle="Comunicados do condomínio">
      <template #actions>
        <Button v-if="isSindico" @click="showCreate = true"><Plus class="h-4 w-4" /> Novo aviso</Button>
      </template>
    </PageHeader>

    <p v-if="isLoading" class="text-muted-foreground">Carregando...</p>
    <EmptyState v-else-if="!data?.data.length" message="Nenhum aviso publicado." />

    <div v-else class="space-y-3">
      <Card v-for="n in data!.data" :key="n.id" :class="n.isPinned ? 'p-4 ring-1 ring-primary/30' : 'p-4'">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <Pin v-if="n.isPinned" class="h-4 w-4 text-primary" />
              <h3 class="font-medium">{{ n.title }}</h3>
              <Badge v-if="!n.isRead" variant="warning">Novo</Badge>
            </div>
            <p class="mt-1 whitespace-pre-line text-sm text-muted-foreground">{{ n.body }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{{ n.author.name }}</span>
              <span>{{ formatDate(n.publishedAt) }}</span>
              <span v-if="n.attachments.length" class="flex items-center gap-1"><Paperclip class="h-3 w-3" /> {{ n.attachments.length }}</span>
              <span v-if="isSindico">· {{ n._count.reads }} leitura(s)</span>
            </div>
          </div>
          <div class="flex shrink-0 gap-1">
            <Button v-if="!n.isRead" size="sm" variant="outline" @click="read(n.id)"><Check class="h-4 w-4" /> Lido</Button>
            <Button v-if="isSindico" size="sm" variant="ghost" @click="remove(n.id)"><Trash2 class="h-4 w-4 text-destructive" /></Button>
          </div>
        </div>
      </Card>
    </div>

    <Pagination v-if="data" :page="data.meta.page" :total-pages="data.meta.totalPages" :total="data.meta.total" @change="(p) => (page = p)" />

    <Modal v-model:open="showCreate" title="Novo aviso">
      <form class="space-y-3" @submit.prevent="submit">
        <div><Label>Título</Label><Input v-model="form.title" /></div>
        <div><Label>Mensagem</Label><Textarea v-model="form.body" :rows="5" /></div>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" v-model="form.isPinned" class="h-4 w-4" /> Fixar no topo
        </label>
      </form>
      <template #footer>
        <Button variant="outline" @click="showCreate = false">Cancelar</Button>
        <Button :disabled="!form.title || !form.body || create.isPending.value" @click="submit">Publicar</Button>
      </template>
    </Modal>
  </div>
</template>
