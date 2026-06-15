import { describe, expect, it } from 'vitest';
import { dayKeyInZone, hhmmToMinutes, minutesOfDayInZone, monthKeyInZone } from '@/utils/datetime';

describe('datetime (timezone-aware)', () => {
  // 2026-07-10T14:00:00-03:00 = 17:00 UTC
  const d = new Date('2026-07-10T14:00:00-03:00');

  it('minutesOfDayInZone converte para o fuso do condomínio', () => {
    expect(minutesOfDayInZone(d, 'America/Sao_Paulo')).toBe(14 * 60);
    expect(minutesOfDayInZone(d, 'UTC')).toBe(17 * 60);
  });

  it('dayKeyInZone respeita o fuso na virada do dia', () => {
    const late = new Date('2026-07-10T23:30:00-03:00'); // 02:30 UTC do dia 11
    expect(dayKeyInZone(late, 'America/Sao_Paulo')).toBe('2026-07-10');
    expect(dayKeyInZone(late, 'UTC')).toBe('2026-07-11');
  });

  it('monthKeyInZone retorna YYYY-MM', () => {
    expect(monthKeyInZone(d, 'America/Sao_Paulo')).toBe('2026-07');
  });

  it('hhmmToMinutes converte HH:MM', () => {
    expect(hhmmToMinutes('08:00')).toBe(480);
    expect(hhmmToMinutes('22:30')).toBe(1350);
  });
});
