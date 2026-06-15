import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api, setTokens } from '@/lib/api';
import type { AuthUser } from '@/types';

const LS_KEY = 'condohub.session';

interface PersistedSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const ready = ref(false);

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value);
  const role = computed(() => user.value?.role ?? null);

  function persist() {
    if (accessToken.value && refreshToken.value && user.value) {
      const data: PersistedSession = {
        accessToken: accessToken.value,
        refreshToken: refreshToken.value,
        user: user.value,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(LS_KEY);
    }
  }

  function apply(access: string, refresh: string, u: AuthUser) {
    accessToken.value = access;
    refreshToken.value = refresh;
    user.value = u;
    setTokens(access, refresh);
    persist();
  }

  async function login(email: string, password: string, condominiumSlug?: string) {
    const { data } = await api.post('/auth/login', { email, password, condominiumSlug });
    apply(data.accessToken, data.refreshToken, data.user);
  }

  function logout() {
    const token = refreshToken.value;
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    setTokens(null, null);
    persist();
    if (token) api.post('/auth/logout', { refreshToken: token }).catch(() => undefined);
  }

  /** Reidrata a sessão do localStorage no boot e valida via /auth/me. */
  async function restore() {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try {
        const s = JSON.parse(raw) as PersistedSession;
        accessToken.value = s.accessToken;
        refreshToken.value = s.refreshToken;
        user.value = s.user;
        setTokens(s.accessToken, s.refreshToken);
        // Confirma/atualiza o usuário (dispara refresh se o access expirou).
        const { data } = await api.get('/auth/me');
        user.value = data.user;
        persist();
      } catch {
        logout();
      }
    }
    ready.value = true;
  }

  return { user, accessToken, refreshToken, ready, isAuthenticated, role, login, logout, restore };
});
