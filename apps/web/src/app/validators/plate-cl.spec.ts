/**
 * Tests for plate-cl validator (patente chilena).
 * AC-01.6 (Chilean plates — RN-01.12)
 */
import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { isValidPlateCl, plateClValidator } from './plate-cl';

describe('AC-01.6 isValidPlateCl', () => {
  // Pre-2007: AA1234
  it('AC-01.6 accepts pre-2007 plate BB1234', () => {
    expect(isValidPlateCl('BB1234')).toBe(true);
  });

  it('AC-01.6 accepts pre-2007 plate ZZ9999', () => {
    expect(isValidPlateCl('ZZ9999')).toBe(true);
  });

  // Post-2007: BBCC12
  it('AC-01.6 accepts post-2007 plate BBCC12', () => {
    expect(isValidPlateCl('BBCC12')).toBe(true);
  });

  it('AC-01.6 accepts post-2007 plate XYZW99', () => {
    expect(isValidPlateCl('XYZW99')).toBe(true);
  });

  it('AC-01.6 accepts lowercase (internally uppercased)', () => {
    expect(isValidPlateCl('bb1234')).toBe(true);
  });

  it('AC-01.6 rejects 3 letters + 3 digits (Colombian format)', () => {
    expect(isValidPlateCl('AAA123')).toBe(false);
  });

  it('AC-01.6 rejects 1 letter + 5 digits', () => {
    expect(isValidPlateCl('A12345')).toBe(false);
  });

  it('AC-01.6 rejects empty string', () => {
    expect(isValidPlateCl('')).toBe(false);
  });
});

describe('AC-01.6 plateClValidator (FormControl)', () => {
  it('AC-01.6 returns null for valid pre-2007 plate', () => {
    const ctrl = new FormControl('AB1234');
    expect(plateClValidator(ctrl)).toBeNull();
  });

  it('AC-01.6 returns null for valid post-2007 plate', () => {
    const ctrl = new FormControl('ABCD12');
    expect(plateClValidator(ctrl)).toBeNull();
  });

  it('AC-01.6 returns error for invalid plate', () => {
    expect(plateClValidator(new FormControl('INVALID'))).toEqual({ patente_cl: true });
  });

  it('AC-01.6 returns null for empty value', () => {
    expect(plateClValidator(new FormControl(''))).toBeNull();
  });
});
