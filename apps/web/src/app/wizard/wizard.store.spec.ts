/**
 * Tests for WizardStore.
 * AC-01.5  — persists applicant across step navigation (in-memory).
 * RN-01.13 — no localStorage / sessionStorage.
 * AC-02.5  — selectPlan stores plan + documentId.
 * AC-02.7  — clearPlan resets selection.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WizardStore } from './wizard.store';
import type { Plan } from '../core/schemas/plan.schema';
import type { FormField } from '../core/schemas/form-field.schema';

/** Minimal FormField stub for use in store tests (F-03-1.3). */
function makeField(key: string, section: 'applicant' | 'vehicle' = 'applicant'): FormField {
  return {
    documentId: `doc-${key}`,
    key,
    label: key,
    type: 'text',
    section,
    required: false,
    helpText: null,
    errorMessage: 'Required',
    order: 1,
    defaultValue: null,
    autocomplete: null,
    validations: [],
  } as FormField;
}

function createStore(): InstanceType<typeof WizardStore> {
  TestBed.configureTestingModule({ providers: [WizardStore] });
  return TestBed.inject(WizardStore);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('AC-01.5 WizardStore', () => {
  it('AC-01.5 initial state has null applicant', () => {
    const store = createStore();
    expect(store.applicant()).toBeNull();
    expect(store.applicantFieldsSnapshot()).toBeNull();
  });

  it('AC-01.5 setApplicant stores values and snapshot (now FormField[], F-03-1.3)', () => {
    const store = createStore();
    const fields = [makeField('documentNumber_CO')];
    store.setApplicant({ documentNumber_CO: '12345678' }, fields);
    expect(store.applicant()).toEqual({ documentNumber_CO: '12345678' });
    expect(store.applicantFieldsSnapshot()).toEqual(fields);
  });

  it('AC-01.5 clearApplicant resets applicant and snapshot to null', () => {
    const store = createStore();
    store.setApplicant({ documentNumber_CO: '12345678' }, [makeField('documentNumber_CO')]);
    store.clearApplicant();
    expect(store.applicant()).toBeNull();
    expect(store.applicantFieldsSnapshot()).toBeNull();
  });

  it('AC-01.5 reset clears all state', () => {
    const store = createStore();
    store.setApplicant({ documentNumber_CO: '12345678' }, [makeField('documentNumber_CO')]);
    store.reset();
    expect(store.applicant()).toBeNull();
    expect(store.applicantFieldsSnapshot()).toBeNull();
    expect(store.selectedPlanId()).toBeNull();
    expect(store.quote()).toBeNull();
    expect(store.quoteNumber()).toBeNull();
  });

  it('RN-01.13 does not write to localStorage', () => {
    const store = createStore();
    store.setApplicant({ rut_CL: '12345678-9' }, [makeField('rut_CL')]);
    expect(localStorage.length).toBe(0);
  });

  it('RN-01.13 does not write to sessionStorage', () => {
    const store = createStore();
    store.setApplicant({ rut_CL: '12345678-9' }, [makeField('rut_CL')]);
    expect(sessionStorage.length).toBe(0);
  });
});

// ---- Plan selection (US-02) ----

const mockPlan: Plan = {
  documentId: 'plan-abc',
  name: 'Plan Básico',
  shortDescription: 'Cobertura esencial',
  basePrice: 1200000,
  currency: 'COP',
  coverages: [{ label: 'Responsabilidad civil', description: null, order: 0 }],
  benefits: [],
  order: 1,
  recommended: false,
  active: true,
  country: { code: 'CO' },
};

describe('AC-02.5 WizardStore — plan selection', () => {
  it('AC-02.5 initial state has null selectedPlanId and selectedPlan', () => {
    const store = createStore();
    expect(store.selectedPlanId()).toBeNull();
    expect(store.selectedPlan()).toBeNull();
  });

  it('AC-02.5 selectPlan stores documentId and plan object', () => {
    const store = createStore();
    store.selectPlan(mockPlan);
    expect(store.selectedPlanId()).toBe('plan-abc');
    expect(store.selectedPlan()).toEqual(mockPlan);
  });

  it('AC-02.5 selectPlan replaces previous selection (unique selection)', () => {
    const store = createStore();
    const anotherPlan: Plan = { ...mockPlan, documentId: 'plan-xyz', name: 'Plan Premium' };
    store.selectPlan(mockPlan);
    store.selectPlan(anotherPlan);
    expect(store.selectedPlanId()).toBe('plan-xyz');
    expect(store.selectedPlan()?.name).toBe('Plan Premium');
  });

  it('AC-02.7 clearPlan resets selectedPlanId and selectedPlan to null', () => {
    const store = createStore();
    store.selectPlan(mockPlan);
    store.clearPlan();
    expect(store.selectedPlanId()).toBeNull();
    expect(store.selectedPlan()).toBeNull();
  });

  it('AC-02.5 reset clears plan selection along with other state', () => {
    const store = createStore();
    store.selectPlan(mockPlan);
    store.reset();
    expect(store.selectedPlanId()).toBeNull();
    expect(store.selectedPlan()).toBeNull();
  });
});

// ---- Quote number (US-03) ----

describe('AC-03.5 WizardStore — quoteNumber', () => {
  it('AC-03.5 initial state has null quoteNumber', () => {
    const store = createStore();
    expect(store.quoteNumber()).toBeNull();
  });

  it('AC-03.5 store exposes quoteNumber after setQuoteNumber', () => {
    const store = createStore();
    store.setQuoteNumber('QT-CO-20261123-ABC123');
    expect(store.quoteNumber()).toBe('QT-CO-20261123-ABC123');
  });

  it('AC-03.5 reset returns quoteNumber to null', () => {
    const store = createStore();
    store.setQuoteNumber('QT-CO-20261123-ABC123');
    store.reset();
    expect(store.quoteNumber()).toBeNull();
  });

  it('AC-03.5 setQuoteNumber replaces previous value', () => {
    const store = createStore();
    store.setQuoteNumber('QT-CO-20261123-FIRST1');
    store.setQuoteNumber('QT-CO-20261124-SECOND');
    expect(store.quoteNumber()).toBe('QT-CO-20261124-SECOND');
  });
});
