import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import App from './App.vue';
import { router } from '@/router';
import { queryClient } from '@/lib/queryClient';
import { setOnUnauthorized } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import './styles/tailwind.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// Tema (claro/escuro) antes de montar para evitar flash.
useThemeStore().init();

// Refresh falhou → encerra sessão e volta ao login.
const auth = useAuthStore();
setOnUnauthorized(() => {
  auth.logout();
  router.push({ name: 'login' });
});

app.use(VueQueryPlugin, { queryClient });
app.use(router);
app.mount('#app');
