<script setup lang="ts">
import NavLinks from './NavLinks.vue';
</script>

<template>
  <aside class="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
    <div class="flex h-16 items-center gap-2 border-b px-6 font-semibold">
      <span class="text-primary">●</span> CondoHub
    </div>
    <NavLinks />
  </aside>
</template>
