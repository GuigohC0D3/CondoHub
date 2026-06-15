import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '@/lib/redis';
import { env } from '@/config/env';

const store = () =>
  new RedisStore({
    // ioredis: encaminha o comando para o cliente.
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<never>,
  });

/** Limite global por IP/usuário. */
export const globalRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: store(),
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anon',
  message: { error: { code: 'RATE_LIMITED', message: 'Muitas requisições, tente mais tarde' } },
});

/** Limite agressivo para login (anti brute force). */
export const authRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: store(),
  keyGenerator: (req) => `auth:${req.ip}`,
  message: { error: { code: 'RATE_LIMITED', message: 'Muitas tentativas de login' } },
});
