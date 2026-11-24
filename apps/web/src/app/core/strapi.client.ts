/**
 * Strapi HTTP client wrapper.
 * - Always calls relative /api paths (no absolute URLs, no tokens — CLAUDE.md §7, ADR-003).
 * - populate is always explicit (ADR-003 D4).
 * - Every response passes through a zod parser before returning (ADR-006).
 */
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { type FormField, parseFormFields } from './schemas/form-field.schema';
import { type Plan, parsePlans } from './schemas/plan.schema';
import { type TermsDocument, parseTerms } from './schemas/terms.schema';

export type Country = 'CO' | 'CL';

@Injectable({ providedIn: 'root' })
export class StrapiClient {
  readonly #http = inject(HttpClient);

  /**
   * Fetches published form fields for the given country, sorted by order.
   * Uses explicit populate for options and validations (ADR-003 D4).
   * AC-01.1, AC-01.4, AC-01.15
   */
  getFormFields(country: Country): Observable<FormField[]> {
    const params = new URLSearchParams({
      'filters[country][code][$eq]': country,
      'sort': 'order:asc',
      'populate[options]': 'true',
      'populate[validations]': 'true',
    });

    return this.#http
      .get<unknown>(`/api/form-fields?${params.toString()}`)
      .pipe(map((raw) => parseFormFields(raw)));
  }

  /**
   * Fetches published, active plans for the given country, sorted by order.
   * Populate is exactly: coverages,benefits,country (ADR-007, ADR-008).
   * AC-02.1, RN-02.2, RN-02.7
   */
  getPlans(country: Country): Observable<Plan[]> {
    const params = new URLSearchParams({
      'filters[country][code][$eq]': country,
      'filters[active][$eq]': 'true',
      'sort': 'order:asc',
      'populate': 'coverages,benefits,country',
      'publicationState': 'live',
    });

    return this.#http
      .get<unknown>(`/api/plans?${params.toString()}`)
      .pipe(map((raw) => parsePlans(raw)));
  }

  /**
   * Fetches the most recent published terms document for the given country.
   * Query: sort=effectiveDate:desc,updatedAt:desc, limit=1 (ADR-009 D2-A, ADR-011).
   * Returns null if no document published or response is invalid (AC-03.12).
   * AC-03.3, AC-03.10, AC-03.11, AC-03.12
   */
  getTerms(country: Country): Observable<TermsDocument | null> {
    const params = new URLSearchParams({
      'filters[country][code][$eq]': country,
      'sort': 'effectiveDate:desc,updatedAt:desc',
      'pagination[limit]': '1',
      'populate[country]': 'true',
    });

    return this.#http
      .get<unknown>(`/api/legal-terms?${params.toString()}`)
      .pipe(map((raw) => parseTerms(raw)));
  }
}
