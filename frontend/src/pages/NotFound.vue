<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
    <h1 class="text-4xl font-bold">404</h1>
    <p class="text-muted-foreground">Página não encontrada.</p>
    <RouterLink to="/" class="text-primary underline-offset-4 hover:underline">Voltar ao início</RouterLink>
  </div>
</template>
