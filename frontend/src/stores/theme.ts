import { ref } from 'vue';
import { defineStore } from 'pinia';

type Theme = 'light' | 'dark';
const LS_KEY = 'condohub.theme';

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>('light');

  function apply(t: Theme) {
    theme.value = t;
    document.documentElement.classList.toggle('dark', t === 'dark');
    localStorage.setItem(LS_KEY, t);
  }

  function toggle() {
    apply(theme.value === 'dark' ? 'light' : 'dark');
  }

  function init() {
    const saved = localStorage.getItem(LS_KEY) as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    apply(saved ?? (prefersDark ? 'dark' : 'light'));
  }

  return { theme, toggle, init, apply };
});
