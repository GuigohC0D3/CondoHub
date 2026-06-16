<script setup lang="ts">
import { RouterView } from 'vue-router';
import Toaster from '@/components/ui/Toaster.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
</script>

<template>
  <RouterView />
  <Toaster />
  <ConfirmDialog />
</template>
