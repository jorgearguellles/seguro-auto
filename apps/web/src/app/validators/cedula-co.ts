/**
 * cedula_co validator — 6 to 10 numeric digits (RN-01.12).
 * AC-01.6 (identity document Colombia)
 */
import type { AbstractControl, ValidationErrors } from '@angular/forms';

const CEDULA_CO_REGEX = /^\d{6,10}$/;

/**
 * Pure function — testable without Angular bootstrap.
 */
export function isValidCedulaCo(value: string): boolean {
  return CEDULA_CO_REGEX.test(value.trim());
}

export function cedulaCoValidator(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (value === null || value === undefined || value === '') {
    return null; // obligatoriedad handled by Validators.required
  }
  if (typeof value !== 'string') {
    return { cedula_co: true };
  }
  return isValidCedulaCo(value) ? null : { cedula_co: true };
}
