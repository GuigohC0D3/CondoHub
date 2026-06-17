<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import { useAuthStore } from '@/stores/auth';
import { homeFor } from '@/router/nav';
import { apiError } from '@/lib/toast';
import { fetchInviteInfo, acceptInvite, type InviteInfo } from './api';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const token = route.params.token as string;

const info = ref<InviteInfo | null>(null);
const loading = ref(true);
const error = ref('');
const password = ref('');
const confirm = ref('');
const acceptedTerms = ref(false);
const submitting = ref(false);
const ROLE: Record<string, string> = { MORADOR: 'Morador', PORTEIRO: 'Porteiro' };

onMounted(async () => {
  try { info.value = await fetchInviteInfo(token); }
  catch (e) { error.value = apiError(e, 'Convite inválido ou expirado'); }
  finally { loading.value = false; }
});

async function submit() {
  if (password.value !== confirm.value) { error.value = 'As senhas não conferem'; return; }
  error.value = '';
  submitting.value = true;
  try {
    const res = await acceptInvite(token, password.value, acceptedTerms.value);
    auth.setSession(res.accessToken, res.refreshToken, res.user);
    router.push(homeFor(res.user.role));
  } catch (e) {
    error.value = apiError(e, 'Falha ao aceitar o convite');
  } finally { submitting.value = false; }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-muted/40 p-4">
    <div class="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
      <h1 class="mb-4 text-center text-xl font-semibold"><span class="text-primary">●</span> CondoHub</h1>

      <p v-if="loading" class="text-center text-muted-foreground">Carregando convite...</p>

      <div v-else-if="!info" class="text-center">
        <p class="text-destructive">{{ error }}</p>
        <RouterLink to="/login" class="mt-3 inline-block text-sm text-primary hover:underline">Ir para o login</RouterLink>
      </div>

      <form v-else class="space-y-4" @submit.prevent="submit">
        <div class="rounded-md bg-muted/40 p-3 text-sm">
          <p>Você foi convidado para <strong>{{ info.condominium.name }}</strong></p>
          <p class="text-muted-foreground">{{ info.email }} · {{ ROLE[info.role] }}</p>
        </div>
        <div><Label>Crie sua senha</Label><Input v-model="password" type="password" /></div>
        <div><Label>Confirme a senha</Label><Input v-model="confirm" type="password" /></div>
        <label class="flex items-start gap-2 text-sm">
          <input v-model="acceptedTerms" type="checkbox" class="mt-0.5" />
          <span>Li e aceito os <strong>Termos de Uso</strong> e a <strong>Política de Privacidade</strong> (LGPD).</span>
        </label>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <Button type="submit" class="w-full" :disabled="password.length < 8 || !acceptedTerms || submitting">
          {{ submitting ? 'Criando...' : 'Criar conta e entrar' }}
        </Button>
      </form>
    </div>
  </div>
</template>
