/**
 * Tests for min-age validator.
 * AC-01.7 (titular must be 18+ — RN-01.4)
 */
import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { isOldEnough, minAgeValidator } from './min-age';

function yearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

describe('AC-01.7 isOldEnough', () => {
  it('AC-01.7 returns true for exactly 18 years old today', () => {
    const dob = yearsAgo(18);
    expect(isOldEnough(dob, 18)).toBe(true);
  });

  it('AC-01.7 returns true for 19 years old', () => {
    expect(isOldEnough(yearsAgo(19), 18)).toBe(true);
  });

  it('AC-01.7 returns false for 17 years old', () => {
    expect(isOldEnough(yearsAgo(17), 18)).toBe(false);
  });

  it('AC-01.7 returns false for 17 years 364 days (not yet 18)', () => {
    const almostEighteen = new Date();
    almostEighteen.setFullYear(almostEighteen.getFullYear() - 18);
    almostEighteen.setDate(almostEighteen.getDate() + 1); // 1 day before 18th birthday
    expect(isOldEnough(almostEighteen, 18)).toBe(false);
  });

  it('AC-01.7 CO — rejects 17 year old', () => {
    expect(isOldEnough(yearsAgo(17), 18)).toBe(false);
  });

  it('AC-01.7 CL — rejects 17 year old', () => {
    expect(isOldEnough(yearsAgo(17), 18)).toBe(false);
  });

  it('AC-01.7 CO — accepts 18 year old', () => {
    expect(isOldEnough(yearsAgo(18), 18)).toBe(true);
  });

  it('AC-01.7 CL — accepts 18 year old', () => {
    expect(isOldEnough(yearsAgo(18), 18)).toBe(true);
  });
});

describe('AC-01.7 minAgeValidator (FormControl)', () => {
  const validate = minAgeValidator(18);

  it('AC-01.7 returns null for valid adult DOB', () => {
    const ctrl = new FormControl(isoDate(yearsAgo(25)));
    expect(validate(ctrl)).toBeNull();
  });

  it('AC-01.7 returns error for underage DOB', () => {
    const ctrl = new FormControl(isoDate(yearsAgo(17)));
    expect(validate(ctrl)).toEqual({ mayor_edad: true });
  });

  it('AC-01.7 returns null for empty value', () => {
    expect(validate(new FormControl(''))).toBeNull();
  });

  it('AC-01.7 returns null for null value', () => {
    expect(validate(new FormControl(null))).toBeNull();
  });

  it('AC-01.7 returns error for unparseable date string', () => {
    expect(validate(new FormControl('not-a-date'))).toEqual({ mayor_edad: true });
  });

  it('AC-01.7 accepts Date object for 18-year-old', () => {
    expect(validate(new FormControl(yearsAgo(18)))).toBeNull();
  });
});
