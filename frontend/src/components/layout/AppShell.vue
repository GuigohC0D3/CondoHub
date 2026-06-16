<script setup lang="ts">
import { ref } from 'vue';
import Sidebar from './Sidebar.vue';
import MobileSidebar from './MobileSidebar.vue';
import Topbar from './Topbar.vue';

const mobileOpen = ref(false);
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <Sidebar />
    <MobileSidebar v-model:open="mobileOpen" />
    <div class="flex flex-1 flex-col overflow-hidden">
      <Topbar @menu="mobileOpen = true" />
      <main class="flex-1 overflow-y-auto p-4 md:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
