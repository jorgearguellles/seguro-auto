/**
 * Tests for PaymentService and generateQuoteNumber (ADR-010).
 * AC-03.5 — well-formed quote number; service emits success.
 * AC-03.6 — service emits failure when query flag set.
 * AC-03.7 — concurrent calls share the same in-flight observable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import {
  generateQuoteNumber,
  PaymentService,
  PAYMENT_SIMULATION_DELAY_MS,
} from './payment.service';
import { CountryContext } from '../../country/country.context';
import * as logger from '../../core/logger';

// ---- generateQuoteNumber pure unit tests ----

describe('AC-03.5 generateQuoteNumber', () => {
  it('AC-03.5 generates well-formed quote number for CO', () => {
    const now = new Date('2026-11-23T12:00:00.000Z');
    const randomSource = () => new Uint8Array([0, 1, 2, 3, 4, 5]);
    const result = generateQuoteNumber('CO', now, randomSource);
    expect(result).toMatch(/^QT-CO-\d{8}-[A-Z0-9]{6}$/);
  });

  it('AC-03.5 uses active country prefix — CL', () => {
    const now = new Date('2026-11-23T12:00:00.000Z');
    const randomSource = () => new Uint8Array([0, 1, 2, 3, 4, 5]);
    const result = generateQuoteNumber('CL', now, randomSource);
    expect(result.startsWith('QT-CL-')).toBe(true);
  });

  it('AC-03.5 includes correct date in format YYYYMMDD', () => {
    const now = new Date('2026-11-23T12:00:00.000Z');
    const randomSource = () => new Uint8Array([10, 11, 12, 13, 14, 15]);
    const result = generateQuoteNumber('CO', now, randomSource);
    expect(result).toContain('20261123');
  });

  it('AC-03.5 suffix is 6 uppercase base36 chars', () => {
    const now = new Date('2026-11-23T12:00:00.000Z');
    const randomSource = () => new Uint8Array([0, 1, 2, 3, 4, 5]);
    const result = generateQuoteNumber('CO', now, randomSource);
    const suffix = result.split('-')[3];
    expect(suffix).toHaveLength(6);
    expect(suffix).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('AC-03.5 month and day are zero-padded', () => {
    const now = new Date('2026-01-05T12:00:00.000Z');
    const randomSource = () => new Uint8Array([0, 0, 0, 0, 0, 0]);
    const result = generateQuoteNumber('CO', now, randomSource);
    expect(result).toContain('20260105');
  });
});

// ---- PaymentService integration tests ----

function setupService(simulatePaymentFailure = false): PaymentService {
  const queryParamMap = convertToParamMap(
    simulatePaymentFailure ? { simulatePaymentFailure: 'true' } : {},
  );

  TestBed.configureTestingModule({
    providers: [
      PaymentService,
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap } },
      },
      {
        provide: CountryContext,
        useValue: { country: () => 'CO' as const },
      },
    ],
  });

  return TestBed.inject(PaymentService);
}

describe('AC-03.5 PaymentService — simulates success after delay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(logger, 'logStructured').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC-03.5 busy is false initially', () => {
    const service = setupService(false);
    expect(service.busy()).toBe(false);
  });

  it('AC-03.5 busy becomes true during simulation', async () => {
    const service = setupService(false);
    service.simulate('plan-abc').subscribe();
    expect(service.busy()).toBe(true);
    await vi.advanceTimersByTimeAsync(PAYMENT_SIMULATION_DELAY_MS);
  });

  it('AC-03.5 resolves with ok:true and well-formed quoteNumber', async () => {
    const service = setupService(false);
    let result: { ok: boolean; quoteNumber?: string } | null = null;

    service.simulate('plan-abc').subscribe((outcome) => {
      result = outcome;
    });

    await vi.advanceTimersByTimeAsync(PAYMENT_SIMULATION_DELAY_MS);

    expect(result).not.toBeNull();
    expect(result!.ok).toBe(true);
    if (result!.ok) {
      expect((result as { ok: true; quoteNumber: string }).quoteNumber).toMatch(
        /^QT-CO-\d{8}-[A-Z0-9]{6}$/,
      );
    }
  });

  it('AC-03.5 busy is false after completion', async () => {
    const service = setupService(false);
    service.simulate('plan-abc').subscribe();
    await vi.advanceTimersByTimeAsync(PAYMENT_SIMULATION_DELAY_MS);
    expect(service.busy()).toBe(false);
  });

  it('payment logs structured event on success without PII', async () => {
    const service = setupService(false);
    service.simulate('plan-def').subscribe();
    await vi.advanceTimersByTimeAsync(PAYMENT_SIMULATION_DELAY_MS);

    expect(logger.logStructured).toHaveBeenCalledWith(
      'payment.simulated',
      expect.objectContaining({ outcome: 'success', planDocumentId: 'plan-def' }),
    );
    const call = vi.mocked(logger.logStructured).mock.calls.find(
      ([event]) => event === 'payment.simulated',
    );
    if (call) {
      const payload = call[1];
      expect(payload).not.toHaveProperty('documentNumber');
      expect(payload).not.toHaveProperty('rut');
      expect(payload).not.toHaveProperty('cedula');
    }
  });
});

describe('AC-03.6 PaymentService — returns failure when query flag set', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(logger, 'logStructured').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC-03.6 errors with payment.failed when simulatePaymentFailure=true', async () => {
    const service = setupService(true);
    let errorCaught: Error | null = null;

    service.simulate('plan-abc').subscribe({
      error: (err: Error) => {
        errorCaught = err;
      },
    });

    await vi.advanceTimersByTimeAsync(PAYMENT_SIMULATION_DELAY_MS);

    expect(errorCaught).not.toBeNull();
    expect(errorCaught!.message).toBe('payment.failed');
  });

  it('AC-03.6 busy is false after failure', async () => {
    const service = setupService(true);
    service.simulate('plan-abc').subscribe({ error: () => undefined });
    await vi.advanceTimersByTimeAsync(PAYMENT_SIMULATION_DELAY_MS);
    expect(service.busy()).toBe(false);
  });

  it('payment logs structured event on failure', async () => {
    const service = setupService(true);
    service.simulate('plan-fail').subscribe({ error: () => undefined });
    await vi.advanceTimersByTimeAsync(PAYMENT_SIMULATION_DELAY_MS);

    expect(logger.logStructured).toHaveBeenCalledWith(
      'payment.simulated',
      expect.objectContaining({ outcome: 'failure', planDocumentId: 'plan-fail' }),
    );
  });
});

describe('AC-03.7 PaymentService — concurrent calls share in-flight observable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(logger, 'logStructured').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC-03.7 concurrent calls return the same observable reference', () => {
    const service = setupService(false);

    const obs1 = service.simulate('plan-abc');
    const obs2 = service.simulate('plan-abc');

    expect(obs1).toBe(obs2);
  });

  it('AC-03.7 two subscribers receive the same result; logStructured called once', async () => {
    const service = setupService(false);
    const results: unknown[] = [];

    const obs1 = service.simulate('plan-abc');
    const obs2 = service.simulate('plan-abc');

    obs1.subscribe({ next: (v) => results.push(v) });
    obs2.subscribe({ next: (v) => results.push(v) });

    await vi.advanceTimersByTimeAsync(PAYMENT_SIMULATION_DELAY_MS);

    expect(results).toHaveLength(2);
    // tap runs once in the source chain before shareReplay
    expect(logger.logStructured).toHaveBeenCalledTimes(1);
  });
});
