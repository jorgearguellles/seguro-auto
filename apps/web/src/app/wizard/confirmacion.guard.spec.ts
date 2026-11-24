/**
 * Tests for confirmacionGuard (ADR-010 §D3-A, AC-03.9, AC-03.17, F-03-1.4).
 * AC-03.9  — guard redirects to paso-1 when quoteNumber is null.
 * AC-03.17 — confirmation route is not reachable after navigating away and back.
 */
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { confirmacionGuard } from './confirmacion.guard';
import { WizardStore } from './wizard.store';
import { CountryContext } from '../country/country.context';

// ---------------------------------------------------------------------------
// Helper to run the guard as a CanActivateFn
// ---------------------------------------------------------------------------

function runGuard(): boolean | UrlTree {
  const route = {} as never;
  const state = {} as never;
  return TestBed.runInInjectionContext(() => confirmacionGuard(route, state));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AC-03.9 confirmacionGuard', () => {
  it('AC-03.9 redirects to /co/paso-1 when quoteNumber is null', () => {
    const quoteNumber = signal<string | null>(null);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: WizardStore,
          useValue: { quoteNumber: quoteNumber.asReadonly() },
        },
        {
          provide: CountryContext,
          useValue: { country: () => 'CO' as const },
        },
      ],
    });

    const result = runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    const tree = result as UrlTree;
    expect(tree.toString()).toBe('/co/paso-1');
  });

  it('AC-03.9 allows navigation when quoteNumber is set', () => {
    const quoteNumber = signal<string | null>('QT-CO-20261123-ABC123');

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: WizardStore,
          useValue: { quoteNumber: quoteNumber.asReadonly() },
        },
        {
          provide: CountryContext,
          useValue: { country: () => 'CO' as const },
        },
      ],
    });

    const result = runGuard();

    expect(result).toBe(true);
  });

  it('AC-03.17 uses country from CountryContext in redirect URL', () => {
    const quoteNumber = signal<string | null>(null);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: WizardStore,
          useValue: { quoteNumber: quoteNumber.asReadonly() },
        },
        {
          provide: CountryContext,
          useValue: { country: () => 'CL' as const },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const parseSpy = vi.spyOn(router, 'parseUrl');

    runGuard();

    expect(parseSpy).toHaveBeenCalledWith('/cl/paso-1');
  });
});
