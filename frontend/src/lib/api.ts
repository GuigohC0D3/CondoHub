import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api';

/**
 * Holder de tokens em módulo (evita dependência circular com a store).
 * A store de auth sincroniza os tokens aqui via setTokens().
 */
let accessToken: string | null = null;
let refreshToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
}
export function getRefreshToken() {
  return refreshToken;
}
export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// ---- Refresh com single-flight + fila de requests pendentes ----
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isAuthCall = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && !original?._retry && !isAuthCall && refreshToken) {
      original._retry = true;
      refreshing ??= doRefresh().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);
