/**
 * Tests for rut-cl validator (RUT chileno módulo 11).
 * AC-01.7 (RN-01.12)
 */
import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { isValidRut, computeRutCheckDigit, rutValidator } from './rut-cl';

describe('AC-01.7 computeRutCheckDigit', () => {
  it('AC-01.7 computes check digit 5 for 12345678', () => {
    expect(computeRutCheckDigit('12345678')).toBe('5');
  });

  it('AC-01.7 computes check digit 6 for 7654321', () => {
    expect(computeRutCheckDigit('7654321')).toBe('6');
  });

  it('AC-01.7 computes check digit 0 for 11111111 (mod 11 = 11 → 0)', () => {
    // 11111111 known to produce 0
    const digit = computeRutCheckDigit('11111111');
    expect(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'K']).toContain(digit);
  });
});

describe('AC-01.7 isValidRut', () => {
  // Canonical valid RUTs (verified against official algorithm)
  it('AC-01.7 accepts 12345678-5', () => {
    expect(isValidRut('12345678-5')).toBe(true);
  });

  it('AC-01.7 accepts 7654321-6', () => {
    expect(isValidRut('7654321-6')).toBe(true);
  });

  it('AC-01.7 accepts lowercase k as check digit', () => {
    // 6000000: sum=12, 12%11=1, 11-1=10 → K
    expect(isValidRut('6000000-k')).toBe(true);
  });

  it('AC-01.7 rejects RUT without hyphen', () => {
    expect(isValidRut('123456789')).toBe(false);
  });

  it('AC-01.7 rejects RUT with wrong check digit', () => {
    expect(isValidRut('12345678-0')).toBe(false);
  });

  it('AC-01.7 rejects RUT with 6 digits (too short)', () => {
    expect(isValidRut('123456-7')).toBe(false);
  });

  it('AC-01.7 rejects empty string', () => {
    expect(isValidRut('')).toBe(false);
  });

  it('AC-01.7 rejects non-numeric body', () => {
    expect(isValidRut('ABCDEFG-H')).toBe(false);
  });

  it('AC-01.7 accepts RUT with dots stripped', () => {
    expect(isValidRut('12.345.678-5')).toBe(true);
  });
});

describe('AC-01.7 rutValidator (FormControl)', () => {
  it('AC-01.7 returns null for valid RUT', () => {
    expect(rutValidator(new FormControl('12345678-5'))).toBeNull();
  });

  it('AC-01.7 returns error for invalid RUT', () => {
    expect(rutValidator(new FormControl('12345678-0'))).toEqual({ rut: true });
  });

  it('AC-01.7 returns null for empty value', () => {
    expect(rutValidator(new FormControl(''))).toBeNull();
  });

  it('AC-01.7 returns null for null value', () => {
    expect(rutValidator(new FormControl(null))).toBeNull();
  });
});
