/**
 * Helpers de data/hora cientes de timezone, sem dependências externas (Intl).
 * Usados para validar reservas contra a janela de funcionamento do condomínio,
 * que é definida no fuso local do condomínio (ex. America/Sao_Paulo).
 */

/** Minutos desde a meia-noite (0–1439) de `date` no fuso `tz`. */
export function minutesOfDayInZone(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/** Chave de dia "YYYY-MM-DD" de `date` no fuso `tz`. */
export function dayKeyInZone(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Chave de mês "YYYY-MM" de `date` no fuso `tz`. */
export function monthKeyInZone(date: Date, tz: string): string {
  return dayKeyInZone(date, tz).slice(0, 7);
}

/** Converte "HH:MM" em minutos desde a meia-noite. */
export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}
