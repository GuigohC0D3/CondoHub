<script setup lang="ts">
import { Inbox } from 'lucide-vue-next';
defineProps<{ message?: string }>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
    <Inbox class="h-8 w-8" />
    <p>{{ message ?? 'Nada por aqui ainda.' }}</p>
    <slot />
  </div>
</template>
