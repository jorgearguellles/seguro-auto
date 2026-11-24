/**
 * CountryContext — single source of truth for the active country.
 * Set by countryGuard on route match; read by all features via inject().
 * Throws if accessed outside the /:country branch (ADR-002).
 */
import { Injectable, computed, signal } from '@angular/core';

export type Country = 'CO' | 'CL';

@Injectable({ providedIn: 'root' })
export class CountryContext {
  readonly #country = signal<Country | null>(null);

  /**
   * Returns the active country.
   * Throws if set() was never called (i.e., accessed outside /:country route).
   */
  readonly country = computed<Country>(() => {
    const c = this.#country();
    if (c === null) {
      throw new Error(
        '[CountryContext] Accessed outside the /:country route branch. ' +
          'Only inject CountryContext inside components/services loaded under /:country.',
      );
    }
    return c;
  });

  set(country: Country): void {
    this.#country.set(country);
  }
}
