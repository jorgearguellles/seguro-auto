/**
 * Tests for cedula-co validator.
 * AC-01.6 (identity document Colombia — 6–10 numeric digits, RN-01.12)
 */
import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { isValidCedulaCo, cedulaCoValidator } from './cedula-co';

describe('AC-01.6 isValidCedulaCo', () => {
  it('AC-01.6 accepts 6-digit cedula', () => {
    expect(isValidCedulaCo('123456')).toBe(true);
  });

  it('AC-01.6 accepts 10-digit cedula', () => {
    expect(isValidCedulaCo('1234567890')).toBe(true);
  });

  it('AC-01.6 accepts 7-digit cedula', () => {
    expect(isValidCedulaCo('1234567')).toBe(true);
  });

  it('AC-01.6 rejects 5-digit cedula (too short)', () => {
    expect(isValidCedulaCo('12345')).toBe(false);
  });

  it('AC-01.6 rejects 11-digit cedula (too long)', () => {
    expect(isValidCedulaCo('12345678901')).toBe(false);
  });

  it('AC-01.6 rejects cedula with letters', () => {
    expect(isValidCedulaCo('123ABC')).toBe(false);
  });

  it('AC-01.6 rejects cedula with hyphens', () => {
    expect(isValidCedulaCo('123-456')).toBe(false);
  });

  it('AC-01.6 rejects empty string', () => {
    expect(isValidCedulaCo('')).toBe(false);
  });
});

describe('AC-01.6 cedulaCoValidator (FormControl)', () => {
  it('AC-01.6 returns null for valid cedula', () => {
    const ctrl = new FormControl('12345678');
    expect(cedulaCoValidator(ctrl)).toBeNull();
  });

  it('AC-01.6 returns error for invalid cedula', () => {
    const ctrl = new FormControl('ABC');
    expect(cedulaCoValidator(ctrl)).toEqual({ cedula_co: true });
  });

  it('AC-01.6 returns null for empty value (required handled separately)', () => {
    const ctrl = new FormControl('');
    expect(cedulaCoValidator(ctrl)).toBeNull();
  });

  it('AC-01.6 returns null for null value', () => {
    const ctrl = new FormControl(null);
    expect(cedulaCoValidator(ctrl)).toBeNull();
  });
});
