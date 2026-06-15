<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { NAV } from '@/router/nav';

const auth = useAuthStore();
const items = computed(() => NAV.filter((i) => auth.role && i.roles.includes(auth.role)));
</script>

<template>
  <aside class="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
    <div class="flex h-16 items-center gap-2 border-b px-6 font-semibold">
      <span class="text-primary">●</span> CondoHub
    </div>
    <nav class="flex-1 space-y-1 p-3">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        exact-active-class="bg-accent text-accent-foreground font-medium"
      >
        <component :is="item.icon" class="h-4 w-4" />
        {{ item.label }}
      </RouterLink>
    </nav>
  </aside>
</template>
