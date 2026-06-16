<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Moon, Sun, LogOut, Menu, User, ChevronDown } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { Button } from '@/components/ui/button';
import NotificationsMenu from '@/features/notifications/NotificationsMenu.vue';

defineEmits<{ menu: [] }>();

const auth = useAuthStore();
const theme = useThemeStore();
const router = useRouter();
const userOpen = ref(false);

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: 'Administrador', SINDICO: 'Síndico', MORADOR: 'Morador', PORTEIRO: 'Porteiro',
};

function go(name: string) { userOpen.value = false; router.push({ name }); }
function logout() { auth.logout(); router.push({ name: 'login' }); }
</script>

<template>
  <header class="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
    <Button variant="ghost" size="icon" class="md:hidden" aria-label="Menu" @click="$emit('menu')">
      <Menu class="h-5 w-5" />
    </Button>
    <div class="flex-1" />
    <div class="flex items-center gap-2">
      <NotificationsMenu v-if="auth.user?.role !== 'SUPER_ADMIN'" />
      <Button variant="ghost" size="icon" aria-label="Alternar tema" @click="theme.toggle()">
        <Moon v-if="theme.theme === 'light'" class="h-5 w-5" />
        <Sun v-else class="h-5 w-5" />
      </Button>

      <div class="relative">
        <button class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent" @click="userOpen = !userOpen">
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {{ (auth.user?.name ?? '?').charAt(0).toUpperCase() }}
          </span>
          <div class="hidden text-left leading-tight sm:block">
            <div class="font-medium">{{ auth.user?.name }}</div>
            <div class="text-xs text-muted-foreground">{{ roleLabel[auth.user?.role ?? ''] }}</div>
          </div>
          <ChevronDown class="h-4 w-4 text-muted-foreground" />
        </button>

        <div v-if="userOpen" class="fixed inset-0 z-40" @click="userOpen = false" />
        <div v-if="userOpen" class="absolute right-0 z-50 mt-2 w-44 rounded-md border bg-card py-1 shadow-lg">
          <button class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent" @click="go('profile')">
            <User class="h-4 w-4" /> Meu perfil
          </button>
          <button class="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent" @click="logout">
            <LogOut class="h-4 w-4" /> Sair
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
