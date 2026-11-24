/**
 * ConfirmacionComponent — Confirmation screen shown after a successful simulated payment.
 * Renders when the user reaches /:country/confirmacion with a valid quoteNumber in WizardStore.
 * Moves focus to the confirmed heading on render (AC-03.14, F-03-1.7).
 * Guard prevents direct access without a quoteNumber (AC-03.9, ADR-010 §D3-A).
 *
 * AC-03.5, AC-03.14, AC-03.17, F-03-1.4, F-03-1.7
 */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';

import { SYSTEM_MESSAGES } from '../../core/system-messages';
import { WizardStore } from '../../wizard/wizard.store';

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="confirmacion-page" aria-labelledby="confirmed-title">
      <!-- Confirmation screen (AC-03.5, AC-03.14, AC-03.17) -->
      <div
        class="state-confirmed"
        role="status"
        aria-live="polite"
      >
        <h2
          id="confirmed-title"
          #confirmedHeading
          class="confirmed-heading"
          tabindex="-1"
        >
          {{ msgs['summary.confirmed'] }}
        </h2>
        <p class="quote-number-label">{{ msgs['summary.quoteNumber'] }}</p>
        <p class="quote-number-value">{{ wizardStore.quoteNumber() }}</p>
      </div>
    </main>
  `,
  styles: [`
    .confirmacion-page {
      max-width: 680px;
      margin: 0 auto;
      padding: var(--space-lg, 1.5rem) var(--space-md, 1rem);
    }

    .state-confirmed {
      background: var(--color-success-bg, #f0fff4);
      border: 1px solid var(--color-success, #38a169);
      border-radius: var(--radius-sm, 4px);
      padding: var(--space-lg, 1.5rem);
      text-align: center;
    }

    .confirmed-heading {
      font-size: var(--font-size-xl, 1.5rem);
      color: var(--color-success, #38a169);
      margin: 0 0 var(--space-md, 1rem);

      &:focus-visible {
        outline: 2px solid var(--color-success, #38a169);
        outline-offset: 2px;
        border-radius: 2px;
      }
    }

    .quote-number-label {
      font-weight: 500;
      margin: 0 0 var(--space-xs, 0.25rem);
    }

    .quote-number-value {
      font-size: var(--font-size-lg, 1.25rem);
      font-weight: 700;
      font-family: var(--font-mono, monospace);
      margin: 0;
    }

    @media (max-width: 639px) {
      .confirmacion-page {
        padding: var(--space-md, 1rem) var(--space-sm, 0.75rem);
      }
    }

    @media (min-width: 1280px) {
      .confirmacion-page {
        padding: var(--space-xl, 2rem) var(--space-lg, 1.5rem);
      }
    }
  `],
})
export class ConfirmacionComponent implements AfterViewInit {
  readonly msgs = SYSTEM_MESSAGES;
  protected readonly wizardStore = inject(WizardStore);

  /** Signal-based reference to the confirmed heading element (AC-03.14, F-03-1.7). */
  readonly confirmedHeading = viewChild<ElementRef<HTMLElement>>('confirmedHeading');

  /**
   * Move focus to the confirmed heading so screen readers announce the confirmation
   * immediately (AC-03.14, F-03-1.7, SPEC-03 AC-03.14).
   */
  ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.confirmedHeading()?.nativeElement.focus();
    });
  }
}
