/**
 * Tests for step2Guard.
 * AC-02.9 — Guard redirects to paso-1 when WizardStore.applicant() is null.
 * RN-02.8 — cannot reach paso-2 without valid paso-1 data.
 */
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { step2Guard } from './wizard-step.guard';
import { WizardStore } from './wizard.store';
import { CountryContext } from '../country/country.context';

// ---------------------------------------------------------------------------
// Mock applicant data (fictional)
// ---------------------------------------------------------------------------

const mockApplicant: Record<string, unknown> = {
  fullName: 'Ana García Pérez',
  documentNumber: '87654321',
  plate: 'ABC123',
  vehicleYear: 2020,
  brand: 'toyota',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sets up TestBed with mocked WizardStore and CountryContext.
 * applicantValue controls what WizardStore.applicant() returns.
 */
function setup(applicantValue: Record<string, unknown> | null) {
  // Minimal WizardStore mock: only the applicant signal is needed by step2Guard
  const applicantSignal = signal(applicantValue);
  const wizardStoreMock = {
    applicant: applicantSignal,
  };

  // CountryContext mock: country() returns 'CO'
  const countryContextMock = {
    country: () => 'CO' as const,
  };

  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'co/paso-1', children: [] },
        { path: 'co/paso-2', canActivate: [step2Guard], children: [] },
      ]),
      { provide: WizardStore, useValue: wizardStoreMock },
      { provide: CountryContext, useValue: countryContextMock },
    ],
  });

  return {
    router: TestBed.inject(Router),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('step2Guard', () => {
  it('AC-02.9 returns true when applicant is set', () => {
    setup(mockApplicant);

    const result = TestBed.runInInjectionContext(() => step2Guard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('AC-02.9 redirects to /co/paso-1 when applicant is null', () => {
    setup(null);

    const result = TestBed.runInInjectionContext(() => step2Guard({} as never, {} as never));

    // Guard must return a UrlTree (not true)
    expect(result).not.toBe(true);

    // The UrlTree must point to /co/paso-1
    const tree = result as UrlTree;
    const serialized = TestBed.inject(Router).serializeUrl(tree);
    expect(serialized).toContain('paso-1');
  });
});
