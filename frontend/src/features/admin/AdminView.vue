<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Plus, Lock, Unlock } from 'lucide-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import DataTable, { type Column } from '@/components/common/DataTable.vue';
import Pagination from '@/components/common/Pagination.vue';
import Card from '@/components/ui/Card.vue';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Label from '@/components/ui/Label.vue';
import { formatBRL } from '@/lib/utils';
import { toast, apiError } from '@/lib/toast';
import { useMetrics, useCondominiums, useCreateCondominium, useToggleBlock, type Condominium } from './api';

const { data: metrics } = useMetrics();
const page = ref(1);
const search = ref<string | undefined>(undefined);
const searchInput = ref('');
const { data, isLoading } = useCondominiums(page, search);

const kpis = computed(() => {
  const m = metrics.value; if (!m) return [];
  return [
    { label: 'Condomínios ativos', value: `${m.condominiums.active}/${m.condominiums.total}` },
    { label: 'Assinaturas ativas', value: m.subscriptions.active },
    { label: 'MRR', value: formatBRL(m.mrr) },
    { label: 'ARR', value: formatBRL(m.arr) },
  ];
});
const columns: Column[] = [{ key: 'name', label: 'Condomínio' }, { key: 'slug', label: 'Slug' }, { key: 'plan', label: 'Plano' }, { key: 'units', label: 'Unidades' }, { key: 'status', label: 'Status' }];
const rows = computed(() => (data.value?.data ?? []) as unknown as Record<string, unknown>[]);

const toggle = useToggleBlock();
async function setBlock(c: Condominium, block: boolean) {
  try { await toggle.mutateAsync({ id: c.id, block }); toast.success(block ? 'Condomínio bloqueado' : 'Condomínio reativado'); }
  catch (e) { toast.error(apiError(e)); }
}

const showCreate = ref(false);
const form = reactive({ name: '', slug: '', plan: 'FREE', sindicoName: '', email: '', password: '' });
const create = useCreateCondominium();
async function submit() {
  try {
    await create.mutateAsync({ name: form.name, slug: form.slug, plan: form.plan, sindico: { name: form.sindicoName, email: form.email, password: form.password } });
    toast.success('Condomínio criado'); showCreate.value = false;
    Object.assign(form, { name: '', slug: '', plan: 'FREE', sindicoName: '', email: '', password: '' });
  } catch (e) { toast.error(apiError(e)); }
}
</script>

<template>
  <div>
    <PageHeader title="Plataforma" subtitle="Gestão de condomínios e assinaturas">
      <template #actions><Button @click="showCreate = true"><Plus class="h-4 w-4" /> Novo condomínio</Button></template>
    </PageHeader>

    <div class="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card v-for="k in kpis" :key="k.label" class="p-4">
        <div class="text-sm text-muted-foreground">{{ k.label }}</div>
        <div class="mt-1 text-2xl font-semibold">{{ k.value }}</div>
      </Card>
    </div>

    <form class="mb-4 flex gap-2" @submit.prevent="search = searchInput || undefined; page = 1">
      <Input v-model="searchInput" placeholder="Buscar condomínio" class="w-64" />
      <Button variant="outline" type="submit">Buscar</Button>
    </form>

    <DataTable :columns="columns" :rows="rows" :loading="isLoading" row-key="id" empty-message="Nenhum condomínio.">
      <template #cell-plan="{ row }">{{ (row as unknown as Condominium).subscription?.plan ?? '—' }}</template>
      <template #cell-units="{ row }">{{ (row as any)._count.apartments }} aptos · {{ (row as any)._count.users }} users</template>
      <template #cell-status="{ row }">
        <Badge :variant="(row as unknown as Condominium).isActive ? 'success' : 'destructive'">{{ (row as unknown as Condominium).isActive ? 'Ativo' : 'Bloqueado' }}</Badge>
      </template>
      <template #actions="{ row }">
        <Button v-if="(row as unknown as Condominium).isActive" size="sm" variant="ghost" @click="setBlock(row as unknown as Condominium, true)"><Lock class="h-4 w-4 text-destructive" /></Button>
        <Button v-else size="sm" variant="ghost" @click="setBlock(row as unknown as Condominium, false)"><Unlock class="h-4 w-4 text-emerald-600" /></Button>
      </template>
    </DataTable>
    <Pagination v-if="data" :page="data.meta.page" :total-pages="data.meta.totalPages" :total="data.meta.total" @change="(p) => (page = p)" />

    <Modal v-model:open="showCreate" title="Novo condomínio" description="Cria o condomínio e a conta do síndico.">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div><Label>Nome</Label><Input v-model="form.name" /></div>
          <div><Label>Slug (subdomínio)</Label><Input v-model="form.slug" placeholder="acme" /></div>
        </div>
        <div><Label>Plano</Label><Select v-model="form.plan" :options="[{ value: 'FREE', label: 'Free' }, { value: 'BASICO', label: 'Básico' }, { value: 'PROFISSIONAL', label: 'Profissional' }, { value: 'ENTERPRISE', label: 'Enterprise' }]" /></div>
        <hr class="border-border" />
        <p class="text-sm font-medium">Síndico</p>
        <div><Label>Nome</Label><Input v-model="form.sindicoName" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label>E-mail</Label><Input v-model="form.email" type="email" /></div>
          <div><Label>Senha</Label><Input v-model="form.password" type="password" /></div>
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showCreate = false">Cancelar</Button>
        <Button :disabled="!form.name || !form.slug || !form.sindicoName || !form.email || form.password.length < 8" @click="submit">Criar</Button>
      </template>
    </Modal>
  </div>
</template>
