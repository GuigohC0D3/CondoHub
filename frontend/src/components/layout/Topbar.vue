<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Moon, Sun, Bell, LogOut } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { Button } from '@/components/ui/button';

const auth = useAuthStore();
const theme = useThemeStore();
const router = useRouter();

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: 'Administrador', SINDICO: 'Síndico', MORADOR: 'Morador', PORTEIRO: 'Porteiro',
};

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <header class="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
    <div class="font-medium md:hidden">CondoHub</div>
    <div class="flex-1" />
    <div class="flex items-center gap-2">
      <Button variant="ghost" size="icon" aria-label="Notificações">
        <Bell class="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Alternar tema" @click="theme.toggle()">
        <Moon v-if="theme.theme === 'light'" class="h-5 w-5" />
        <Sun v-else class="h-5 w-5" />
      </Button>
      <div class="ml-2 hidden text-right text-sm sm:block">
        <div class="font-medium leading-tight">{{ auth.user?.name }}</div>
        <div class="text-xs text-muted-foreground">{{ roleLabel[auth.user?.role ?? ''] }}</div>
      </div>
      <Button variant="ghost" size="icon" aria-label="Sair" @click="logout">
        <LogOut class="h-5 w-5" />
      </Button>
    </div>
  </header>
</template>
