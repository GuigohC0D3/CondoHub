<script setup lang="ts">
import { watch } from 'vue';
import { X } from 'lucide-vue-next';

const open = defineModel<boolean>('open', { required: true });
defineProps<{ title?: string; description?: string }>();

// Bloqueia scroll do body quando aberto.
watch(open, (v) => {
  document.body.style.overflow = v ? 'hidden' : '';
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150" enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150" leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" @click.self="open = false">
        <div class="relative w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg">
          <button class="absolute right-4 top-4 text-muted-foreground hover:text-foreground" @click="open = false" aria-label="Fechar">
            <X class="h-4 w-4" />
          </button>
          <div v-if="title || description" class="mb-4">
            <h2 v-if="title" class="text-lg font-semibold">{{ title }}</h2>
            <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
          </div>
          <slot />
          <div v-if="$slots.footer" class="mt-6 flex justify-end gap-2">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
