/**
 * Validator registry — maps ValidationRule keys to ValidatorFn factories.
 * Keeps "what rules exist" (Strapi/zod) decoupled from "what each rule does" (front).
 * ADR-004 §Design concreto.
 */
import { Validators, type ValidatorFn } from '@angular/forms';
import type { ValidationRule, ParsedValidation } from '../../core/schemas/form-field.schema';
import {
  rutValidator,
  cedulaCoValidator,
  plateCoValidator,
  plateClValidator,
  minAgeValidator,
  vehicleYearValidator,
} from '../../validators';
import { logStructured } from '../../core/logger';

type Factory = (params: unknown) => ValidatorFn;

export const VALIDATOR_REGISTRY: Record<ValidationRule, Factory> = {
  required: () => Validators.required,
  min: (p) => Validators.min((p as { value: number }).value),
  max: (p) => Validators.max((p as { value: number }).value),
  minLength: (p) => Validators.minLength((p as { value: number }).value),
  maxLength: (p) => Validators.maxLength((p as { value: number }).value),
  pattern: (p) => Validators.pattern((p as { regex: string }).regex),
  rut: () => rutValidator,
  cedula_co: () => cedulaCoValidator,
  placa_co: () => plateCoValidator,
  patente_cl: () => plateClValidator,
  mayor_edad: () => minAgeValidator(18),
  anio_vehiculo: () => vehicleYearValidator,
};

/**
 * Builds the list of ValidatorFns for a form field from its parsed validations.
 * Adds Validators.required when field.required === true (RN-01.11).
 */
export function buildValidators(
  required: boolean,
  validations: ParsedValidation[],
): ValidatorFn[] {
  const fns: ValidatorFn[] = [];

  if (required) {
    fns.push(Validators.required);
  }

  for (const v of validations) {
    // skip 'required' rule if already added via field.required (avoid duplicate)
    if (v.rule === 'required') continue;

    const factory = VALIDATOR_REGISTRY[v.rule];
    if (!factory) {
      logStructured('validator.registry.unknownRule', { rule: v.rule as string });
      continue;
    }
    fns.push(factory(v.params));
  }

  return fns;
}
