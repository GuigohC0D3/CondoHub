<script setup lang="ts">
import { Button } from '@/components/ui/button';

const props = defineProps<{ page: number; totalPages: number; total: number }>();
const emit = defineEmits<{ change: [page: number] }>();

function go(p: number) {
  if (p >= 1 && p <= props.totalPages) emit('change', p);
}
</script>

<template>
  <div v-if="total > 0" class="flex items-center justify-between gap-2 px-1 py-3 text-sm text-muted-foreground">
    <span>{{ total }} registro(s)</span>
    <div class="flex items-center gap-2">
      <Button variant="outline" size="sm" :disabled="page <= 1" @click="go(page - 1)">Anterior</Button>
      <span>{{ page }} / {{ totalPages }}</span>
      <Button variant="outline" size="sm" :disabled="page >= totalPages" @click="go(page + 1)">Próxima</Button>
    </div>
  </div>
</template>
