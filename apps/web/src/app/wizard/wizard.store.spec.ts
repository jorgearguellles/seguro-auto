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

  it('AC-01.5 setApplicant stores values and snapshot', () => {
    const store = createStore();
    store.setApplicant({ documentNumber: '12345678' }, ['documentNumber']);
    expect(store.applicant()).toEqual({ documentNumber: '12345678' });
    expect(store.applicantFieldsSnapshot()).toEqual(['documentNumber']);
  });

  it('AC-01.5 clearApplicant resets applicant and snapshot to null', () => {
    const store = createStore();
    store.setApplicant({ documentNumber: '12345678' }, ['documentNumber']);
    store.clearApplicant();
    expect(store.applicant()).toBeNull();
    expect(store.applicantFieldsSnapshot()).toBeNull();
  });

  it('AC-01.5 reset clears all state', () => {
    const store = createStore();
    store.setApplicant({ documentNumber: '12345678' }, ['documentNumber']);
    store.reset();
    expect(store.applicant()).toBeNull();
    expect(store.applicantFieldsSnapshot()).toBeNull();
    expect(store.selectedPlanId()).toBeNull();
    expect(store.quote()).toBeNull();
    expect(store.quoteNumber()).toBeNull();
  });

  it('RN-01.13 does not write to localStorage', () => {
    const store = createStore();
    store.setApplicant({ rut: '12345678-9' }, ['rut']);
    expect(localStorage.length).toBe(0);
  });

  it('RN-01.13 does not write to sessionStorage', () => {
    const store = createStore();
    store.setApplicant({ rut: '12345678-9' }, ['rut']);
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
