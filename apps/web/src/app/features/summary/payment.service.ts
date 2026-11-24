/**
 * PaymentService — simulates a payment in the browser (RN-03.6, ADR-010).
 * No real payment gateway is called; no card data is captured (CLAUDE.md §7).
 * Delay: PAYMENT_SIMULATION_DELAY_MS (ADR-010 G-03.4).
 * Failure mode: ?simulatePaymentFailure=true in query string (ADR-010 D1-A, G-03.2).
 * Idempotence: shareReplay(1) prevents duplicate in-flight calls (AC-03.7).
 * AC-03.5, AC-03.6, AC-03.7, G-03.11
 */
import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, throwError, of, shareReplay, timer } from 'rxjs';
import { switchMap, tap, finalize } from 'rxjs/operators';
import { logStructured } from '../../core/logger';
import { CountryContext } from '../../country/country.context';

export const PAYMENT_SIMULATION_DELAY_MS = 1500;

export type PaymentOutcome =
  | { ok: true; quoteNumber: string }
  | { ok: false };

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Generates a quote number in the format QT-{COUNTRY}-{YYYYMMDD}-{BASE36_6} (ADR-010 D2-B, G-03.3). */
export function generateQuoteNumber(
  country: 'CO' | 'CL',
  now: Date = new Date(),
  randomSource: () => Uint8Array = () => {
    const buf = new Uint8Array(6);
    crypto.getRandomValues(buf);
    return buf;
  },
): string {
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yyyymmdd = `${yyyy}${mm}${dd}`;

  const bytes = randomSource();
  let suffix = '';
  for (const b of bytes) {
    suffix += BASE36[b % 36];
  }
  return `QT-${country}-${yyyymmdd}-${suffix.toUpperCase()}`;
}

@Injectable()
export class PaymentService {
  readonly #route = inject(ActivatedRoute);
  readonly #countryContext = inject(CountryContext);

  /** True while a payment simulation is in progress (AC-03.5, AC-03.7). */
  readonly busy = signal(false);

  #inflight: Observable<PaymentOutcome> | null = null;

  /**
   * Simulates a payment.
   * - Idempotent: if already in progress, returns the same shared Observable (AC-03.7).
   * - Delays PAYMENT_SIMULATION_DELAY_MS ms (G-03.4).
   * - Failure forced by ?simulatePaymentFailure=true (ADR-010 D1-A).
   * - Logs outcome without PII (G-03.11).
   */
  simulate(planDocumentId: string): Observable<PaymentOutcome> {
    if (this.#inflight !== null) {
      // AC-03.7 — second concurrent call shares the same in-flight observable
      return this.#inflight;
    }

    const shouldFail =
      this.#route.snapshot.queryParamMap.get('simulatePaymentFailure') === 'true';
    const country = this.#countryContext.country();

    let outcome$: Observable<PaymentOutcome>;

    if (shouldFail) {
      // Use timer + switchMap to ensure the delay fires even for errors (ADR-010 G-03.4)
      outcome$ = timer(PAYMENT_SIMULATION_DELAY_MS).pipe(
        switchMap(() => throwError(() => new Error('payment.failed'))),
      ) as Observable<PaymentOutcome>;
    } else {
      const quoteNumber = generateQuoteNumber(country);
      outcome$ = timer(PAYMENT_SIMULATION_DELAY_MS).pipe(
        switchMap(() => of<PaymentOutcome>({ ok: true, quoteNumber })),
      );
    }

    // Attach logging and cleanup once using tap + finalize, then share the result
    this.#inflight = outcome$.pipe(
      tap({
        next: (outcome) => {
          const quoteNumber = outcome.ok ? outcome.quoteNumber : undefined;
          logStructured('payment.simulated', {
            country,
            planDocumentId,
            outcome: outcome.ok ? 'success' : 'failure',
            ...(quoteNumber !== undefined ? { quoteNumber } : {}),
          });
        },
        error: () => {
          logStructured('payment.simulated', {
            country,
            planDocumentId,
            outcome: 'failure',
          });
        },
      }),
      finalize(() => {
        this.busy.set(false);
        this.#inflight = null;
      }),
      shareReplay(1),
    );
    this.busy.set(true);

    return this.#inflight;
  }
}
