/**
 * min-age validator — titular must be at least `minAge` years old (RN-01.4, RN-01.12).
 * Accepts a date string (ISO 8601 or dd/MM/yyyy) or Date object.
 * AC-01.7
 */
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Parses a date value from control.value.
 * Supports ISO 8601 strings and Date objects.
 */
function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const d = new Date(value.trim());
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Returns true if the person born on `birthDate` is at least `minAge` years old today.
 */
export function isOldEnough(birthDate: Date, minAge: number): boolean {
  const today = new Date();
  const birthday = new Date(birthDate);
  birthday.setFullYear(birthday.getFullYear() + minAge);
  return birthday <= today;
}

/**
 * Factory — returns a ValidatorFn that checks the minimum age.
 * Usage: minAgeValidator(18)
 */
export function minAgeValidator(minAge: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    if (value === null || value === undefined || value === '') {
      return null; // obligatoriedad handled by Validators.required
    }
    const date = parseDate(value);
    if (date === null) {
      return { mayor_edad: true }; // unparseable date is treated as invalid
    }
    return isOldEnough(date, minAge) ? null : { mayor_edad: true };
  };
}
