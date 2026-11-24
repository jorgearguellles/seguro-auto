/**
 * Tests for pricing.ts
 * AC-02.3 — applies 10% surcharge when vehicle is older than threshold.
 * AC-02.2 — price formatted with correct locale and currency.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateFinalPrice,
  formatPrice,
  VEHICLE_YEAR_FIELD_KEY,
  PRICE_ADJUST_THRESHOLD_YEARS,
  PRICE_ADJUST_SURCHARGE,
} from './pricing';

const CURRENT_YEAR = new Date().getFullYear();

describe('AC-02.3 calculateFinalPrice — vehicle age surcharge', () => {
  it('AC-02.3 exports the correct constants', () => {
    expect(VEHICLE_YEAR_FIELD_KEY).toBe('vehicleYear');
    expect(PRICE_ADJUST_THRESHOLD_YEARS).toBe(5);
    expect(PRICE_ADJUST_SURCHARGE).toBe(0.1);
  });

  it('AC-02.3 returns basePrice when vehicleYear equals currentYear', () => {
    const applicant = { [VEHICLE_YEAR_FIELD_KEY]: CURRENT_YEAR };
    expect(calculateFinalPrice(1000000, applicant)).toBe(1000000);
  });

  it('AC-02.3 returns basePrice when vehicleYear = currentYear - 5 (boundary: not older than threshold)', () => {
    const applicant = { [VEHICLE_YEAR_FIELD_KEY]: CURRENT_YEAR - 5 };
    // currentYear - (currentYear - 5) = 5, NOT > 5, so no surcharge
    expect(calculateFinalPrice(1000000, applicant)).toBe(1000000);
  });

  it('AC-02.3 applies 10% surcharge when vehicleYear = currentYear - 6 (older than threshold)', () => {
    const applicant = { [VEHICLE_YEAR_FIELD_KEY]: CURRENT_YEAR - 6 };
    // currentYear - (currentYear - 6) = 6 > 5 → surcharge
    expect(calculateFinalPrice(1000000, applicant)).toBe(1100000);
  });

  it('AC-02.3 applies 10% surcharge when vehicleYear = currentYear - 20 (very old)', () => {
    const applicant = { [VEHICLE_YEAR_FIELD_KEY]: CURRENT_YEAR - 20 };
    expect(calculateFinalPrice(1000000, applicant)).toBe(1100000);
  });

  it('AC-02.3 does not apply surcharge when vehicleYear is missing', () => {
    const applicant: Record<string, unknown> = {};
    expect(calculateFinalPrice(1000000, applicant)).toBe(1000000);
  });

  it('AC-02.3 does not apply surcharge when vehicleYear is not a number', () => {
    const applicant = { [VEHICLE_YEAR_FIELD_KEY]: 'dos-mil-veinte' };
    expect(calculateFinalPrice(1000000, applicant)).toBe(1000000);
  });

  it('AC-02.3 does not apply surcharge when vehicleYear is null', () => {
    const applicant = { [VEHICLE_YEAR_FIELD_KEY]: null };
    expect(calculateFinalPrice(1000000, applicant)).toBe(1000000);
  });

  it('AC-02.3 rounds to nearest integer (Math.round)', () => {
    // 1500001 * 1.10 = 1650001.1 → rounds to 1650001
    const applicant = { [VEHICLE_YEAR_FIELD_KEY]: CURRENT_YEAR - 10 };
    expect(calculateFinalPrice(1500001, applicant)).toBe(Math.round(1500001 * 1.1));
  });
});

describe('AC-02.2 formatPrice — locale and currency formatting', () => {
  it('AC-02.2 formats COP with es-CO locale (no decimals)', () => {
    const result = formatPrice(1200000, 'COP');
    // Should contain the number formatted for es-CO — no decimals, currency symbol/code
    expect(result).toMatch(/1[.,]200[.,]000/);
    expect(result).toContain('$');
  });

  it('AC-02.2 formats CLP with es-CL locale (no decimals)', () => {
    const result = formatPrice(45000, 'CLP');
    expect(result).toMatch(/45[.,]000/);
    expect(result).toContain('$');
  });

  it('AC-02.2 returns a string', () => {
    expect(typeof formatPrice(1000, 'COP')).toBe('string');
    expect(typeof formatPrice(1000, 'CLP')).toBe('string');
  });

  it('AC-02.2 does not include decimal separator for COP', () => {
    const result = formatPrice(1200000, 'COP');
    // es-CO uses . as thousands separator and , as decimal; since maxFractionDigits=0, no comma after integer
    // The number "1200000" formatted as es-CO COP should not have decimals
    expect(result).not.toMatch(/[,\.]\d{2}$/);
  });
});
