import pino from 'pino';
import { env } from '@/config/env';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  // Evita logar PII/segredos acidentalmente.
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
});
