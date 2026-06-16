<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Plus, Copy, Trash2 } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import DataTable, { type Column } from '@/components/common/DataTable.vue';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Label from '@/components/ui/Label.vue';
import { toast, apiError } from '@/lib/toast';
import { confirm } from '@/lib/confirm';
import { useResidents } from '@/features/residents/api';
import { useInvitations, useCreateInvitation, useRevokeInvitation, type Invitation } from './api';

const { data: invitations, isLoading } = useInvitations();
const rows = computed(() => (invitations.value ?? []) as unknown as Record<string, unknown>[]);
const columns: Column[] = [{ key: 'name', label: 'Nome' }, { key: 'email', label: 'E-mail' }, { key: 'role', label: 'Perfil' }, { key: 'resident', label: 'Vínculo' }];
const ROLE: Record<string, string> = { MORADOR: 'Morador', PORTEIRO: 'Porteiro' };

// Moradores aprovados ainda sem login (para vincular no convite).
const residentParams = ref({ status: 'APPROVED' as const, page: 1, limit: 200 });
const { data: residents } = useResidents(residentParams);
const linkable = computed(() => (residents.value?.data ?? []).filter((r) => !r.userId));
const residentOptions = computed(() => linkable.value.map((r) => ({ value: r.id, label: `${r.fullName} — ${r.apartment?.number ?? ''}` })));

const inviteLink = (token: string) => `${location.origin}/convite/${token}`;
async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
  toast.success('Link copiado');
}
const copyLink = (token: string) => copyText(inviteLink(token));

const revoke = useRevokeInvitation();
async function doRevoke(id: string) {
  if (!(await confirm({ title: 'Revogar convite', message: 'O link deixará de funcionar.', destructive: true, confirmLabel: 'Revogar' }))) return;
  try { await revoke.mutateAsync(id); toast.success('Convite revogado'); } catch (e) { toast.error(apiError(e)); }
}

const showCreate = ref(false);
const form = reactive({ role: 'MORADOR', name: '', email: '', residentId: '' });
const create = useCreateInvitation();
function onResident(id: string | null | undefined) {
  form.residentId = id ?? '';
  const r = linkable.value.find((x) => x.id === id);
  if (r) { form.name = r.fullName; form.email = r.email ?? ''; }
}
const lastLink = ref<string | null>(null);
async function submit() {
  try {
    const inv = await create.mutateAsync({
      role: form.role, name: form.name, email: form.email,
      residentId: form.role === 'MORADOR' && form.residentId ? form.residentId : undefined,
    });
    lastLink.value = inviteLink(inv.token);
    toast.success('Convite criado');
    showCreate.value = false;
    Object.assign(form, { role: 'MORADOR', name: '', email: '', residentId: '' });
  } catch (e) { toast.error(apiError(e)); }
}
</script>

<template>
  <div>
    <PageHeader title="Convites" subtitle="Convide moradores e porteiros para criarem login">
      <template #actions><Button @click="showCreate = true"><Plus class="h-4 w-4" /> Convidar</Button></template>
    </PageHeader>

    <div v-if="lastLink" class="mb-4 flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
      <span class="truncate">{{ lastLink }}</span>
      <Button size="sm" variant="outline" class="ml-auto shrink-0" @click="copyText(lastLink!)">
        <Copy class="h-4 w-4" /> Copiar
      </Button>
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="isLoading" row-key="id" empty-message="Nenhum convite pendente.">
      <template #cell-role="{ value }"><Badge variant="secondary">{{ ROLE[value as string] }}</Badge></template>
      <template #cell-resident="{ row }">{{ (row as unknown as Invitation).resident?.fullName ?? '—' }}</template>
      <template #actions="{ row }">
        <Button size="sm" variant="ghost" @click="copyLink((row as unknown as Invitation).token)"><Copy class="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" @click="doRevoke((row as any).id)"><Trash2 class="h-4 w-4 text-destructive" /></Button>
      </template>
    </DataTable>

    <Modal v-model:open="showCreate" title="Novo convite" description="Gera um link para o convidado definir a senha.">
      <div class="space-y-3">
        <div><Label>Perfil</Label><Select v-model="form.role" :options="[{ value: 'MORADOR', label: 'Morador' }, { value: 'PORTEIRO', label: 'Porteiro' }]" /></div>
        <div v-if="form.role === 'MORADOR'">
          <Label>Vincular a um morador (opcional)</Label>
          <Select :model-value="form.residentId" :options="residentOptions" placeholder="Sem vínculo" @update:model-value="onResident" />
          <p class="mt-1 text-xs text-muted-foreground">Moradores aprovados que ainda não têm login.</p>
        </div>
        <div><Label>Nome</Label><Input v-model="form.name" /></div>
        <div><Label>E-mail</Label><Input v-model="form.email" type="email" /></div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showCreate = false">Cancelar</Button>
        <Button :disabled="!form.name || !form.email || create.isPending.value" @click="submit">Criar convite</Button>
      </template>
    </Modal>
  </div>
</template>
