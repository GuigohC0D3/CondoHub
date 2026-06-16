<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { NAV } from '@/router/nav';

defineEmits<{ navigate: [] }>();

const auth = useAuthStore();
const items = computed(() => NAV.filter((i) => auth.role && i.roles.includes(auth.role)));
</script>

<template>
  <nav class="flex-1 space-y-1 p-3">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      exact-active-class="bg-accent text-accent-foreground font-medium"
      @click="$emit('navigate')"
    >
      <component :is="item.icon" class="h-4 w-4" />
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
