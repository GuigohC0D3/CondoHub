<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-2 text-center">
    <h1 class="text-2xl font-semibold capitalize">{{ String(route.name) }}</h1>
    <p class="max-w-md text-muted-foreground">
      Módulo em construção. O scaffold e a API já estão prontos no backend — esta tela
      será implementada na sequência (ver <code>docs/FRONTEND.md</code>).
    </p>
  </div>
</template>
