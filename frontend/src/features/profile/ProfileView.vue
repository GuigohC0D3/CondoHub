<script setup lang="ts">
import { computed } from 'vue';
import PageHeader from '@/components/common/PageHeader.vue';
import Card from '@/components/ui/Card.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const roleLabel: Record<string, string> = { SUPER_ADMIN: 'Administrador', SINDICO: 'Síndico', MORADOR: 'Morador', PORTEIRO: 'Porteiro' };
const fields = computed(() => [
  { label: 'Nome', value: auth.user?.name },
  { label: 'E-mail', value: auth.user?.email },
  { label: 'Perfil', value: roleLabel[auth.user?.role ?? ''] },
]);
</script>

<template>
  <div>
    <PageHeader title="Meu perfil" />
    <Card class="max-w-lg divide-y p-0">
      <div v-for="f in fields" :key="f.label" class="flex justify-between p-4 text-sm">
        <span class="text-muted-foreground">{{ f.label }}</span>
        <span class="font-medium">{{ f.value }}</span>
      </div>
    </Card>
  </div>
</template>
