/**
 * Tests for WizardStore.
 * AC-01.5 — persists applicant across step navigation (in-memory).
 * RN-01.13 — no localStorage / sessionStorage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WizardStore } from './wizard.store';

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
