<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Bell } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { useNotifications, useMarkNotification, useMarkAllNotifications, type Notification } from './api';

const open = ref(false);
const router = useRouter();
const { data } = useNotifications();
const markOne = useMarkNotification();
const markAll = useMarkAllNotifications();

function onClick(n: Notification) {
  if (!n.isRead) markOne.mutate(n.id);
  open.value = false;
  if (n.linkUrl) router.push(n.linkUrl).catch(() => undefined);
}
</script>

<template>
  <div class="relative">
    <Button variant="ghost" size="icon" aria-label="Notificações" @click="open = !open">
      <Bell class="h-5 w-5" />
      <span v-if="data && data.unreadCount > 0" class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
        {{ data.unreadCount > 9 ? '9+' : data.unreadCount }}
      </span>
    </Button>

    <div v-if="open" class="fixed inset-0 z-40" @click="open = false" />
    <div v-if="open" class="absolute right-0 z-50 mt-2 w-80 rounded-md border bg-card shadow-lg">
      <div class="flex items-center justify-between border-b p-3">
        <span class="text-sm font-medium">Notificações</span>
        <button v-if="data && data.unreadCount > 0" class="text-xs text-primary hover:underline" @click="markAll.mutate()">Marcar todas</button>
      </div>
      <div class="max-h-96 overflow-y-auto">
        <p v-if="!data?.data.length" class="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
        <button
          v-for="n in data?.data" :key="n.id"
          class="flex w-full flex-col items-start gap-0.5 border-b p-3 text-left text-sm transition-colors hover:bg-muted/40"
          :class="{ 'bg-primary/5': !n.isRead }"
          @click="onClick(n)"
        >
          <span class="font-medium">{{ n.title }}</span>
          <span class="text-muted-foreground">{{ n.body }}</span>
          <span class="text-[10px] text-muted-foreground">{{ formatDate(n.createdAt) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
