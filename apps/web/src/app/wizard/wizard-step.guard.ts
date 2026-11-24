/**
 * step2Guard — prevents navigating to step 2 without valid step 1 data.
 * step3Guard — prevents navigating to step 3 without a selected plan from step 2.
 * ADR-005, RN-01.8, RN-02.8.
 */
import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { WizardStore } from './wizard.store';
import { CountryContext } from '../country/country.context';

/** AC-02.9 — step 2 requires step 1 data. */
export const step2Guard: CanActivateFn = () => {
  const store = inject(WizardStore);
  const context = inject(CountryContext);
  const router = inject(Router);

  if (store.applicant() !== null) {
    return true;
  }

  const country = context.country().toLowerCase();
  return router.parseUrl(`/${country}/paso-1`);
};

/** step3Guard — step 3 requires a selected plan from step 2 (AC-02.6). */
export const step3Guard: CanActivateFn = () => {
  const store = inject(WizardStore);
  const context = inject(CountryContext);
  const router = inject(Router);

  if (store.selectedPlanId() !== null) {
    return true;
  }

  const country = context.country().toLowerCase();
  return router.parseUrl(`/${country}/paso-2`);
};
