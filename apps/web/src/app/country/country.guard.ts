/**
 * countryGuard — CanMatchFn that validates the :country segment.
 * Valid values: 'co' | 'cl' (case-insensitive).
 * Invalid → redirects to /co (ADR-002, RN-01.9).
 */
import { inject } from '@angular/core';
import { Router, type CanMatchFn, type Route, type UrlSegment } from '@angular/router';
import { CountryContext, type Country } from './country.context';

export const countryGuard: CanMatchFn = (_route: Route, segments: UrlSegment[]) => {
  const raw = segments[0]?.path?.toLowerCase();
  const context = inject(CountryContext);
  const router = inject(Router);

  if (raw === 'co' || raw === 'cl') {
    context.set(raw.toUpperCase() as Country);
    return true;
  }

  return router.parseUrl('/co');
};
