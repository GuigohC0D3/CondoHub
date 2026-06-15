import { describe, expect, it } from 'vitest';
import { isValidCpf, onlyDigits } from '@/utils/cpf';

describe('cpf', () => {
  it('aceita CPF válido (com e sem máscara)', () => {
    expect(isValidCpf('390.533.447-05')).toBe(true);
    expect(isValidCpf('39053344705')).toBe(true);
  });

  it('rejeita dígitos verificadores errados', () => {
    expect(isValidCpf('390.533.447-00')).toBe(false);
  });

  it('rejeita sequências repetidas e tamanho inválido', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });

  it('onlyDigits remove máscara', () => {
    expect(onlyDigits('390.533.447-05')).toBe('39053344705');
  });
});
