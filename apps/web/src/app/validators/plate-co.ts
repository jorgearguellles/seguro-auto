/**
 * placa_co validator (RN-01.12).
 * Valid formats:
 *   - ^[A-Z]{3}[0-9]{3}$  (standard private)
 *   - ^[A-Z]{3}[0-9]{2}[A-Z]$  (motorcycle / new format)
 * AC-01.6
 */
import type { AbstractControl, ValidationErrors } from '@angular/forms';

const PLATE_CO_REGEX_1 = /^[A-Z]{3}[0-9]{3}$/;
const PLATE_CO_REGEX_2 = /^[A-Z]{3}[0-9]{2}[A-Z]$/;

export function isValidPlateCo(value: string): boolean {
  const v = value.trim().toUpperCase();
  return PLATE_CO_REGEX_1.test(v) || PLATE_CO_REGEX_2.test(v);
}

export function plateCoValidator(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    return { placa_co: true };
  }
  return isValidPlateCo(value) ? null : { placa_co: true };
}
