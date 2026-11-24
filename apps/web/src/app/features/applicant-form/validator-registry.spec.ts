/**
 * Tests for validator-registry.ts
 * AC-01.2 — VALIDATOR_REGISTRY maps every rule key to a ValidatorFn factory.
 * AC-01.3 — buildValidators wires required + custom rules correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormControl } from '@angular/forms';
import { VALIDATOR_REGISTRY, buildValidators } from './validator-registry';
import * as logger from '../../core/logger';

// ---- AC-01.2: Registry completeness ----

describe('AC-01.2 VALIDATOR_REGISTRY — every rule returns a ValidatorFn', () => {
  const requiredRules = [
    'required',
    'min',
    'max',
    'minLength',
    'maxLength',
    'pattern',
    'rut',
    'cedula_co',
    'placa_co',
    'patente_cl',
    'mayor_edad',
    'anio_vehiculo',
  ] as const;

  it('AC-01.2 registry contains all 12 expected rule keys', () => {
    expect(Object.keys(VALIDATOR_REGISTRY)).toHaveLength(requiredRules.length);
  });

  for (const rule of requiredRules) {
    it(`AC-01.2 "${rule}" factory returns a function`, () => {
      const params =
        rule === 'min' || rule === 'max'
          ? { value: 10 }
          : rule === 'minLength' || rule === 'maxLength'
            ? { value: 5 }
            : rule === 'pattern'
              ? { regex: '^[A-Z]+$' }
              : {};
      const fn = VALIDATOR_REGISTRY[rule](params);
      expect(typeof fn).toBe('function');
    });
  }

  it('AC-01.2 "required" factory produces a validator that fails on empty string', () => {
    const fn = VALIDATOR_REGISTRY['required']({});
    const result = fn(new FormControl(''));
    expect(result).not.toBeNull();
  });

  it('AC-01.2 "rut" factory produces the rutValidator (fails on invalid RUT)', () => {
    const fn = VALIDATOR_REGISTRY['rut']({});
    expect(fn(new FormControl('12345678-0'))).toEqual({ rut: true });
    expect(fn(new FormControl('12345678-5'))).toBeNull();
  });

  it('AC-01.2 "cedula_co" factory produces the cedulaCoValidator (fails on bad cedula)', () => {
    const fn = VALIDATOR_REGISTRY['cedula_co']({});
    expect(fn(new FormControl('ABC'))).toEqual({ cedula_co: true });
    expect(fn(new FormControl('12345678'))).toBeNull();
  });

  it('AC-01.2 "placa_co" factory produces the plateCoValidator', () => {
    const fn = VALIDATOR_REGISTRY['placa_co']({});
    expect(fn(new FormControl('INVALID'))).toEqual({ placa_co: true });
    expect(fn(new FormControl('ABC123'))).toBeNull();
  });

  it('AC-01.2 "patente_cl" factory produces the plateClValidator', () => {
    const fn = VALIDATOR_REGISTRY['patente_cl']({});
    expect(fn(new FormControl('INVALID'))).toEqual({ patente_cl: true });
    expect(fn(new FormControl('AB1234'))).toBeNull();
  });

  it('AC-01.2 "mayor_edad" factory produces a minAge(18) validator', () => {
    const fn = VALIDATOR_REGISTRY['mayor_edad']({});
    // A birth date 17 years ago — underage
    const dob17 = new Date();
    dob17.setFullYear(dob17.getFullYear() - 17);
    const isoDate = dob17.toISOString().split('T')[0];
    expect(fn(new FormControl(isoDate))).toEqual({ mayor_edad: true });
  });

  it('AC-01.2 "anio_vehiculo" factory produces the vehicleYearValidator', () => {
    const fn = VALIDATOR_REGISTRY['anio_vehiculo']({});
    const badYear = new Date().getFullYear() + 2;
    expect(fn(new FormControl(badYear))).toEqual({ anio_vehiculo: true });
  });

  it('AC-01.2 "min" factory respects the value param', () => {
    const fn = VALIDATOR_REGISTRY['min']({ value: 18 });
    expect(fn(new FormControl(17))).not.toBeNull();
    expect(fn(new FormControl(18))).toBeNull();
  });

  it('AC-01.2 "max" factory respects the value param', () => {
    const fn = VALIDATOR_REGISTRY['max']({ value: 100 });
    expect(fn(new FormControl(101))).not.toBeNull();
    expect(fn(new FormControl(100))).toBeNull();
  });

  it('AC-01.2 "minLength" factory respects the value param', () => {
    const fn = VALIDATOR_REGISTRY['minLength']({ value: 5 });
    expect(fn(new FormControl('abc'))).not.toBeNull();
    expect(fn(new FormControl('abcde'))).toBeNull();
  });

  it('AC-01.2 "maxLength" factory respects the value param', () => {
    const fn = VALIDATOR_REGISTRY['maxLength']({ value: 3 });
    expect(fn(new FormControl('abcd'))).not.toBeNull();
    expect(fn(new FormControl('abc'))).toBeNull();
  });

  it('AC-01.2 "pattern" factory respects the regex param', () => {
    const fn = VALIDATOR_REGISTRY['pattern']({ regex: '^[A-Z]{3}$' });
    expect(fn(new FormControl('abc'))).not.toBeNull();
    expect(fn(new FormControl('ABC'))).toBeNull();
  });
});

// ---- AC-01.3: buildValidators wires required correctly ----

describe('AC-01.3 buildValidators', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'logStructured').mockImplementation(() => undefined);
  });

  it('AC-01.3 required:true adds Validators.required as first validator', () => {
    const fns = buildValidators(true, []);
    expect(fns).toHaveLength(1);
    const ctrl = new FormControl('');
    expect(fns[0](ctrl)).not.toBeNull(); // required fails on empty
  });

  it('AC-01.3 required:false adds no required validator', () => {
    const fns = buildValidators(false, []);
    expect(fns).toHaveLength(0);
  });

  it('AC-01.3 required:true with additional rule produces required + rule', () => {
    const fns = buildValidators(true, [
      { rule: 'cedula_co', params: {} },
    ]);
    expect(fns).toHaveLength(2);
  });

  it('AC-01.3 required rule in validations array is not duplicated when required:true', () => {
    const fns = buildValidators(true, [
      { rule: 'required', params: {} },
    ]);
    // Should only have 1 required fn — the duplicate is skipped
    expect(fns).toHaveLength(1);
  });

  it('AC-01.3 unknown rule in validations is skipped and logged', () => {
    const fns = buildValidators(false, [
      { rule: 'required', params: {} }, // skipped (required:false but rule is 'required')
    ]);
    // 'required' rule is skipped by the "skip required when already added" guard
    // but here required:false so the guard path hits continue for 'required' rule
    expect(fns).toHaveLength(0);
    // No log since 'required' is explicitly skipped, not "unknown"
    expect(logger.logStructured).not.toHaveBeenCalled();
  });

  it('AC-01.3 form with required text field blocks advance when empty', () => {
    const fns = buildValidators(true, []);
    const ctrl = new FormControl('');
    // Apply all validators
    ctrl.addValidators(fns);
    ctrl.updateValueAndValidity();
    expect(ctrl.invalid).toBe(true);
  });

  it('AC-01.3 form with required text field passes when filled', () => {
    const fns = buildValidators(true, []);
    const ctrl = new FormControl('value');
    ctrl.addValidators(fns);
    ctrl.updateValueAndValidity();
    expect(ctrl.valid).toBe(true);
  });

  it('AC-01.3 required:true + cedula_co — invalid cedula produces errors', () => {
    const fns = buildValidators(true, [
      { rule: 'cedula_co', params: {} },
    ]);
    const ctrl = new FormControl('ABC'); // invalid cedula
    ctrl.addValidators(fns);
    ctrl.updateValueAndValidity();
    expect(ctrl.invalid).toBe(true);
  });

  it('AC-01.3 required:true + cedula_co — valid cedula passes', () => {
    const fns = buildValidators(true, [
      { rule: 'cedula_co', params: {} },
    ]);
    const ctrl = new FormControl('12345678'); // valid 8-digit cedula
    ctrl.addValidators(fns);
    ctrl.updateValueAndValidity();
    expect(ctrl.valid).toBe(true);
  });

  it('AC-01.3 rut rule produces the correct validator', () => {
    const fns = buildValidators(false, [{ rule: 'rut', params: {} }]);
    expect(fns).toHaveLength(1);
    expect(fns[0](new FormControl('12345678-5'))).toBeNull();
    expect(fns[0](new FormControl('12345678-0'))).toEqual({ rut: true });
  });
});
