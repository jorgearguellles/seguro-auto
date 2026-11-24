/**
 * confirmacionGuard — prevents direct access to /:country/confirmacion
 * without a quoteNumber in the WizardStore (ADR-010 §D3-A, AC-03.9, AC-03.17).
 *
 * If quoteNumber is null, the user has not completed a successful payment in
 * this session. Redirect to paso-1 of the active country.
 */
import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { CountryContext } from '../country/country.context';
import { WizardStore } from './wizard.store';

export const confirmacionGuard: CanActivateFn = () => {
  const store = inject(WizardStore);
  const context = inject(CountryContext);
  const router = inject(Router);

  if (store.quoteNumber() !== null) return true;

  const country = context.country().toLowerCase();
  return router.parseUrl(`/${country}/paso-1`);
};
