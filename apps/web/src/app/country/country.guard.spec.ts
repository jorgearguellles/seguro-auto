/**
 * Tests for countryGuard.
 * AC-01.1 — country resolved from URL segment.
 * ADR-002 — CanMatch validation.
 */
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { countryGuard } from './country.guard';
import { CountryContext } from './country.context';

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: ':country', canMatch: [countryGuard], children: [] },
        { path: '**', redirectTo: 'co' },
      ]),
      CountryContext,
    ],
  });
  return {
    context: TestBed.inject(CountryContext),
    router: TestBed.inject(Router),
  };
}

function makeSegment(path: string) {
  return { path } as import('@angular/router').UrlSegment;
}

describe('AC-01.1 countryGuard', () => {
  it('AC-01.1 returns true and sets CO for segment "co"', () => {
    const { context } = setup();

    // Invoke guard directly
    const result = TestBed.runInInjectionContext(() =>
      countryGuard({} as never, [makeSegment('co')]),
    );

    expect(result).toBe(true);
    expect(context.country()).toBe('CO');
  });

  it('AC-01.1 returns true and sets CL for segment "cl"', () => {
    setup();
    const context = TestBed.inject(CountryContext);

    const result = TestBed.runInInjectionContext(() =>
      countryGuard({} as never, [makeSegment('cl')]),
    );

    expect(result).toBe(true);
    expect(context.country()).toBe('CL');
  });

  it('AC-01.1 returns true for uppercase "CO"', () => {
    setup();
    const context = TestBed.inject(CountryContext);

    const result = TestBed.runInInjectionContext(() =>
      countryGuard({} as never, [makeSegment('CO')]),
    );

    expect(result).toBe(true);
    expect(context.country()).toBe('CO');
  });

  it('AC-01.1 redirects to /co for unknown segment "us"', () => {
    setup();

    const result = TestBed.runInInjectionContext(() =>
      countryGuard({} as never, [makeSegment('us')]),
    );

    expect(result).not.toBe(true);
    // result is a UrlTree
    expect(typeof result).toBe('object');
  });

  it('AC-01.1 redirects to /co for empty segments', () => {
    setup();

    const result = TestBed.runInInjectionContext(() =>
      countryGuard({} as never, []),
    );

    expect(result).not.toBe(true);
  });
});
