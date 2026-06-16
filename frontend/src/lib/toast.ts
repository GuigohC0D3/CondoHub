import { reactive } from 'vue';

export interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error' | 'info';
}

const state = reactive<{ items: Toast[] }>({ items: [] });
let seq = 0;

export function useToasts() {
  return state;
}

function push(message: string, variant: Toast['variant']) {
  const id = ++seq;
  state.items.push({ id, message, variant });
  setTimeout(() => dismiss(id), 4000);
}

export function dismiss(id: number) {
  const i = state.items.findIndex((t) => t.id === id);
  if (i !== -1) state.items.splice(i, 1);
}

export const toast = {
  success: (m: string) => push(m, 'success'),
  error: (m: string) => push(m, 'error'),
  info: (m: string) => push(m, 'info'),
};

/** Extrai mensagem de erro padronizada da API. */
export function apiError(e: unknown, fallback = 'Ocorreu um erro'): string {
  const err = e as { response?: { data?: { error?: { message?: string } } } };
  return err.response?.data?.error?.message ?? fallback;
}
