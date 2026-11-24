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
}
