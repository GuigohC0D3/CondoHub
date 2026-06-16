<script setup lang="ts">
import { watch } from 'vue';
import { X } from 'lucide-vue-next';
import NavLinks from './NavLinks.vue';

const open = defineModel<boolean>('open', { required: true });

watch(open, (v) => { document.body.style.overflow = v ? 'hidden' : ''; });
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150" enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150" leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 bg-black/50 md:hidden" @click.self="open = false">
        <div class="flex h-full w-64 flex-col bg-card shadow-xl">
          <div class="flex h-16 items-center justify-between border-b px-4 font-semibold">
            <span><span class="text-primary">●</span> CondoHub</span>
            <button class="text-muted-foreground hover:text-foreground" @click="open = false" aria-label="Fechar">
              <X class="h-5 w-5" />
            </button>
          </div>
          <NavLinks @navigate="open = false" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
