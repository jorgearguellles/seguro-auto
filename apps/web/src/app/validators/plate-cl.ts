/**
 * patente_cl validator (RN-01.12).
 * Valid formats:
 *   - ^[A-Z]{2}[0-9]{4}$  (pre-2007 two letters + four digits)
 *   - ^[A-Z]{4}[0-9]{2}$  (post-2007 four letters + two digits)
 * AC-01.6
 */
import type { AbstractControl, ValidationErrors } from '@angular/forms';

const PLATE_CL_REGEX_1 = /^[A-Z]{2}[0-9]{4}$/;
const PLATE_CL_REGEX_2 = /^[A-Z]{4}[0-9]{2}$/;

export function isValidPlateCl(value: string): boolean {
  const v = value.trim().toUpperCase();
  return PLATE_CL_REGEX_1.test(v) || PLATE_CL_REGEX_2.test(v);
}

export function plateClValidator(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    return { patente_cl: true };
  }
  return isValidPlateCl(value) ? null : { patente_cl: true };
}
