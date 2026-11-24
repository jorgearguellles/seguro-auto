/**
 * Tests for plate-co validator.
 * AC-01.6 (Colombian plates — RN-01.12)
 */
import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { isValidPlateCo, plateCoValidator } from './plate-co';

describe('AC-01.6 isValidPlateCo', () => {
  // Standard format: AAA000
  it('AC-01.6 accepts standard plate AAA123', () => {
    expect(isValidPlateCo('AAA123')).toBe(true);
  });

  it('AC-01.6 accepts standard plate ZZZ999', () => {
    expect(isValidPlateCo('ZZZ999')).toBe(true);
  });

  // Motorcycle / new format: AAA12A
  it('AC-01.6 accepts moto format AAA12A', () => {
    expect(isValidPlateCo('AAA12A')).toBe(true);
  });

  it('AC-01.6 accepts moto format BCD34Z', () => {
    expect(isValidPlateCo('BCD34Z')).toBe(true);
  });

  it('AC-01.6 accepts lowercase plate (normalized to upper case)', () => {
    // isValidPlateCo toUpperCases internally
    expect(isValidPlateCo('aaa123')).toBe(true);
  });

  it('AC-01.6 rejects plate with 4 letters prefix', () => {
    expect(isValidPlateCo('AAAA23')).toBe(false);
  });

  it('AC-01.6 rejects plate with only 2 digits', () => {
    expect(isValidPlateCo('AAA12')).toBe(false);
  });

  it('AC-01.6 rejects plate with 7 characters', () => {
    expect(isValidPlateCo('AAA1234')).toBe(false);
  });

  it('AC-01.6 rejects empty string', () => {
    expect(isValidPlateCo('')).toBe(false);
  });
});

describe('AC-01.6 plateCoValidator (FormControl)', () => {
  it('AC-01.6 returns null for valid plate', () => {
    const ctrl = new FormControl('ABC123');
    expect(plateCoValidator(ctrl)).toBeNull();
  });

  it('AC-01.6 returns error for invalid plate', () => {
    const ctrl = new FormControl('1234');
    expect(plateCoValidator(ctrl)).toEqual({ placa_co: true });
  });

  it('AC-01.6 returns null for empty value', () => {
    const ctrl = new FormControl('');
    expect(plateCoValidator(ctrl)).toBeNull();
  });
});
