/**
 * step2Guard — prevents navigating to step 2 without valid step 1 data.
 * ADR-005, RN-01.8.
 */
import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { WizardStore } from './wizard.store';
import { CountryContext } from '../country/country.context';

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
