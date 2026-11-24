/**
 * anio_vehiculo validator — year must be within [currentYear - 20, currentYear + 1] (RN-01.3, RN-01.12).
 * AC-01.6
 */
import type { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Returns true if `year` is within the allowed range.
 * Range: [currentYear - 20 .. currentYear + 1]
 */
export function isValidVehicleYear(year: number): boolean {
  const current = new Date().getFullYear();
  return year >= current - 20 && year <= current + 1;
}

export function vehicleYearValidator(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const year = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  if (isNaN(year)) {
    return { anio_vehiculo: true };
  }
  return isValidVehicleYear(year) ? null : { anio_vehiculo: true };
}
