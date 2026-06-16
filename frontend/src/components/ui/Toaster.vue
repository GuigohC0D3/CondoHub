<script setup lang="ts">
import { CheckCircle2, XCircle, Info } from 'lucide-vue-next';
import { useToasts, dismiss } from '@/lib/toast';

const toasts = useToasts();
const icon = { success: CheckCircle2, error: XCircle, info: Info };
const color = {
  success: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  error: 'border-destructive/40 text-destructive',
  info: 'border-border text-foreground',
};
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      <TransitionGroup
        enter-active-class="transition-all duration-200" enter-from-class="translate-x-4 opacity-0"
        leave-active-class="transition-all duration-200" leave-to-class="translate-x-4 opacity-0"
      >
        <div
          v-for="t in toasts.items" :key="t.id"
          class="flex items-start gap-2 rounded-md border bg-card p-3 text-sm shadow-md"
          :class="color[t.variant]"
          @click="dismiss(t.id)"
        >
          <component :is="icon[t.variant]" class="mt-0.5 h-4 w-4 shrink-0" />
          <span class="text-card-foreground">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
