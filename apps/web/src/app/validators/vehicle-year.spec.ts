/**
 * Tests for vehicle-year validator.
 * AC-01.6 (year range Y-20 .. Y+1 — RN-01.3)
 */
import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { isValidVehicleYear, vehicleYearValidator } from './vehicle-year';

const Y = new Date().getFullYear();

describe('AC-01.6 isValidVehicleYear', () => {
  it('AC-01.6 accepts current year Y', () => {
    expect(isValidVehicleYear(Y)).toBe(true);
  });

  it('AC-01.6 accepts Y + 1 (next year)', () => {
    expect(isValidVehicleYear(Y + 1)).toBe(true);
  });

  it('AC-01.6 rejects Y + 2', () => {
    expect(isValidVehicleYear(Y + 2)).toBe(false);
  });

  it('AC-01.6 accepts Y - 20 (oldest allowed)', () => {
    expect(isValidVehicleYear(Y - 20)).toBe(true);
  });

  it('AC-01.6 rejects Y - 21 (too old)', () => {
    expect(isValidVehicleYear(Y - 21)).toBe(false);
  });

  it('AC-01.6 accepts middle of range (Y - 10)', () => {
    expect(isValidVehicleYear(Y - 10)).toBe(true);
  });
});

describe('AC-01.6 vehicleYearValidator (FormControl)', () => {
  it('AC-01.6 returns null for current year', () => {
    expect(vehicleYearValidator(new FormControl(Y))).toBeNull();
  });

  it('AC-01.6 returns null for Y+1 as string', () => {
    expect(vehicleYearValidator(new FormControl(String(Y + 1)))).toBeNull();
  });

  it('AC-01.6 returns error for Y+2', () => {
    expect(vehicleYearValidator(new FormControl(Y + 2))).toEqual({ anio_vehiculo: true });
  });

  it('AC-01.6 returns error for Y-21', () => {
    expect(vehicleYearValidator(new FormControl(Y - 21))).toEqual({ anio_vehiculo: true });
  });

  it('AC-01.6 returns null for empty value', () => {
    expect(vehicleYearValidator(new FormControl(''))).toBeNull();
  });

  it('AC-01.6 returns null for null value', () => {
    expect(vehicleYearValidator(new FormControl(null))).toBeNull();
  });

  it('AC-01.6 returns error for non-numeric string', () => {
    expect(vehicleYearValidator(new FormControl('abc'))).toEqual({ anio_vehiculo: true });
  });
});
