/**
 * rut validator — Chilean RUT with modulo-11 check digit (RN-01.12).
 * Accepted format: 7–8 digits + '-' + check digit (0–9 or 'K').
 * Example valid: 12345678-9, 7654321-k (case-insensitive).
 * AC-01.7
 */
import type { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Computes the expected check digit for a numeric RUT body.
 * Uses the modulo-11 algorithm.
 */
export function computeRutCheckDigit(rutBody: string): string {
  const digits = rutBody.replace(/\D/g, '');
  let sum = 0;
  let multiplier = 2;

  for (let i = digits.length - 1; i >= 0; i--) {
    sum += parseInt(digits[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

/**
 * Validates a RUT string in format XXXXXXXX-D or XXXXXXX-D.
 * Case-insensitive for 'K'.
 */
export function isValidRut(rut: string): boolean {
  const cleaned = rut.trim().toUpperCase().replace(/\./g, '');
  const match = cleaned.match(/^(\d{7,8})-([0-9K])$/);
  if (!match) return false;

  const body = match[1];
  const checkDigit = match[2];
  return computeRutCheckDigit(body) === checkDigit;
}

export function rutValidator(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    return { rut: true };
  }
  return isValidRut(value) ? null : { rut: true };
}
