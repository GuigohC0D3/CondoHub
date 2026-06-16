<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth';
import { homeFor } from '@/router/nav';
import { Button } from '@/components/ui/button';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const slug = ref('');
const loading = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(email.value, password.value, slug.value || undefined);
    const redirect = (route.query.redirect as string) || homeFor(auth.role);
    router.push(redirect);
  } catch (e) {
    const ax = e as AxiosError<{ error?: { message?: string } }>;
    error.value = ax.response?.data?.error?.message ?? 'Falha ao entrar';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-muted/40 p-4">
    <form class="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm" @submit.prevent="submit">
      <div class="space-y-1 text-center">
        <h1 class="text-xl font-semibold"><span class="text-primary">●</span> CondoHub</h1>
        <p class="text-sm text-muted-foreground">Acesse sua conta</p>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium" for="slug">Condomínio (subdomínio)</label>
        <input id="slug" v-model="slug" placeholder="ex.: demo (vazio = admin)"
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium" for="email">E-mail</label>
        <input id="email" v-model="email" type="email" required
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium" for="password">Senha</label>
        <input id="password" v-model="password" type="password" required
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

      <Button type="submit" :disabled="loading" class="w-full">
        {{ loading ? 'Entrando...' : 'Entrar' }}
      </Button>
    </form>
  </div>
</template>
