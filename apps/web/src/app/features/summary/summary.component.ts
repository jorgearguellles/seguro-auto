/**
 * SummaryComponent — Step 3 of the wizard: review and simulated payment.
 * Displays applicant data (masked document), vehicle data, chosen plan with final price.
 * Loads terms & conditions from Strapi (AC-03.3, AC-03.10, AC-03.11, AC-03.12).
 * Simulates payment with confirmation/error states (AC-03.5, AC-03.6, AC-03.7).
 * Guard prevents direct access without steps 1+2 (AC-03.9, RN-03.10).
 * Keyboard-accessible; aria-busy/aria-disabled on pay button (AC-03.14).
 * Responsive 375px + 1280px (AC-03.15).
 * Document number masked in DOM — only last 4 non-separator chars visible (AC-03.2, AC-03.16, RN-03.11).
 * Three blocks: titular data, vehicle data, plan (RN-03.1, F-03-1.3).
 * After payment success navigates to /:country/confirmacion (ADR-010 D4-A, F-03-1.4).
 *
 * AC-03.1, AC-03.2, AC-03.3, AC-03.4, AC-03.5, AC-03.6, AC-03.7, AC-03.8,
 * AC-03.9, AC-03.10, AC-03.11, AC-03.12, AC-03.13, AC-03.14, AC-03.15, AC-03.16, AC-03.17
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { StrapiClient } from '../../core/strapi.client';
import { SYSTEM_MESSAGES } from '../../core/system-messages';
import { calculateFinalPrice, formatPrice } from '../../core/pricing';
import { CountryContext } from '../../country/country.context';
import { WizardStore } from '../../wizard/wizard.store';
import { PaymentService } from './payment.service';
import { TermsBlocksRendererComponent } from '../../shared/terms-blocks-renderer/terms-blocks-renderer.component';
import { maskDocument, isDocumentKey } from '../../core/document-mask';
import type { TermsDocument } from '../../core/schemas/terms.schema';

type PageState = 'loading' | 'error' | 'ready';

/** Re-export maskDocument so existing spec file (mask-document.spec.ts) keeps importing from here. */
export { maskDocument };

@Component({
  selector: 'app-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TermsBlocksRendererComponent],
  providers: [PaymentService],
  template: `
    <main class="summary-page" aria-labelledby="summary-title">
      <h1 id="summary-title" class="summary-title" tabindex="-1">
        {{ msgs['summary.title'] }}
      </h1>

      <!-- Aria-live region for state announcements (AC-03.14) -->
      <div aria-live="polite" aria-atomic="true" class="visually-hidden">
        {{ ariaAnnouncement() }}
      </div>

      <!-- Summary blocks always visible (AC-03.1, AC-03.11 — rest of summary shows even on terms error) -->

      <!-- Block 1: Applicant identity data (AC-03.1, AC-03.2, AC-03.16, RN-03.1, F-03-1.3) -->
      <section class="summary-block" aria-labelledby="section-identity">
        <h2 id="section-identity" class="block-heading">{{ msgs['summary.yourData'] }}</h2>
        <dl class="data-list">
          @for (entry of applicantIdentityEntries(); track entry.label) {
            <div class="data-row">
              <dt class="data-label">{{ entry.label }}</dt>
              <dd class="data-value">{{ entry.value }}</dd>
            </div>
          }
        </dl>
        <a
          class="summary-action-link"
          [attr.href]="editDataUrl()"
          (click)="goEditData($event)"
        >{{ msgs['summary.editData'] }}</a>
      </section>

      <!-- Block 2: Vehicle data (AC-03.1, RN-03.1, F-03-1.3) -->
      @if (vehicleEntries().length > 0) {
        <section class="summary-block" aria-labelledby="section-vehicle">
          <h2 id="section-vehicle" class="block-heading">{{ msgs['summary.yourVehicle'] }}</h2>
          <dl class="data-list">
            @for (entry of vehicleEntries(); track entry.label) {
              <div class="data-row">
                <dt class="data-label">{{ entry.label }}</dt>
                <dd class="data-value">{{ entry.value }}</dd>
              </div>
            }
          </dl>
          <a
            class="summary-action-link"
            [attr.href]="editDataUrl()"
            (click)="goEditData($event)"
          >{{ msgs['summary.editData'] }}</a>
        </section>
      }

      <!-- Block 3: Plan summary (AC-03.1, AC-03.13) -->
      @if (wizardStore.selectedPlan(); as plan) {
        <section class="summary-block" aria-labelledby="section-plan">
          <h2 id="section-plan" class="block-heading">{{ msgs['summary.yourPlan'] }}</h2>
          <dl class="data-list">
            <div class="data-row">
              <dt class="data-label">{{ msgs['summary.yourPlan'] }}</dt>
              <dd class="data-value">{{ plan.name }}</dd>
            </div>
            <div class="data-row">
              <dt class="data-label">{{ msgs['summary.price'] }}</dt>
              <dd class="data-value">{{ finalPriceFormatted() }}</dd>
            </div>
          </dl>
          <a
            class="summary-action-link"
            [attr.href]="changePlanUrl()"
            (click)="goChangePlan($event)"
          >{{ msgs['summary.back'] }}</a>
        </section>
      }

      <!-- Block 4: Terms (AC-03.3, AC-03.10, AC-03.11, AC-03.12) -->
      <section class="summary-block summary-block--terms" aria-labelledby="section-terms">
        <h2 id="section-terms" class="block-heading">{{ msgs['summary.terms'] }}</h2>

        @switch (pageState()) {
          @case ('loading') {
            <div class="state-loading" role="status">
              <div class="loading-spinner" aria-hidden="true"></div>
              <p>{{ msgs['summary.loading'] }}</p>
            </div>
          }

          @case ('error') {
            <div role="alert" class="state-error">
              <p>{{ msgs['summary.loadError'] }}</p>
              <button
                type="button"
                class="btn btn--secondary"
                (click)="loadTerms()"
              >
                {{ msgs['summary.loadRetry'] }}
              </button>
            </div>
          }

          @case ('ready') {
            @if (terms(); as termsDoc) {
              <div class="terms-content">
                <app-terms-blocks-renderer [blocks]="termsDoc.body" />
              </div>

              <!-- Checkbox: terms acceptance (AC-03.4, AC-03.14, G-03.10) -->
              <div class="terms-accept">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    class="checkbox-input"
                    [checked]="termsAccepted()"
                    (change)="onTermsChange($event)"
                    [attr.aria-label]="msgs['summary.accept']"
                  />
                  <span class="checkbox-text">{{ msgs['summary.accept'] }}</span>
                </label>
              </div>
            } @else {
              <!-- Empty state: no published terms (AC-03.12) -->
              <div class="state-empty">
                <p>Los términos no están disponibles en este momento.</p>
              </div>
            }
          }
        }
      </section>

      <!-- Payment error (AC-03.6) -->
      @if (payErrorMessage()) {
        <div role="alert" class="state-error state-error--payment">
          <p>{{ payErrorMessage() }}</p>
        </div>
      }

      <!-- Pay button (AC-03.4, AC-03.5, AC-03.7, AC-03.14) -->
      <div class="form-actions">
        <button
          type="button"
          class="btn btn--primary btn--pay"
          [disabled]="isPayDisabled()"
          [attr.aria-disabled]="isPayDisabled() ? 'true' : 'false'"
          [attr.aria-busy]="isSubmitting() ? 'true' : null"
          (click)="onPay()"
        >
          @if (isSubmitting()) {
            {{ msgs['summary.paying'] }}
          } @else {
            {{ msgs['summary.pay'] }}
          }
        </button>
      </div>
    </main>
  `,
  styles: [`
    .summary-page {
      max-width: 680px;
      margin: 0 auto;
      padding: var(--space-lg, 1.5rem) var(--space-md, 1rem);
    }

    .summary-title {
      font-size: var(--font-size-xl, 1.5rem);
      margin-bottom: var(--space-lg, 1.5rem);
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* ---- Summary blocks ---- */
    .summary-block {
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e0e0e0);
      border-radius: var(--radius-sm, 4px);
      padding: var(--space-md, 1rem);
      margin-bottom: var(--space-md, 1rem);
    }

    .summary-block--terms {
      max-height: 400px;
      overflow-y: auto;
    }

    .block-heading {
      font-size: var(--font-size-base, 1rem);
      font-weight: 600;
      margin-bottom: var(--space-sm, 0.5rem);
      margin-top: 0;
    }

    .data-list {
      display: grid;
      gap: var(--space-xs, 0.25rem);
      margin: 0 0 var(--space-sm, 0.5rem);
    }

    .data-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs, 0.25rem);
    }

    .data-label {
      font-weight: 500;
      flex-basis: 160px;
      color: var(--color-text-secondary, #555);
    }

    .data-label::after {
      content: ':';
    }

    .data-value {
      flex: 1;
    }

    .summary-action-link {
      display: inline-block;
      margin-top: var(--space-xs, 0.25rem);
      color: var(--color-primary, #1a56db);
      font-size: var(--font-size-sm, 0.875rem);
      text-decoration: underline;
      cursor: pointer;

      &:hover { text-decoration: none; }
      &:focus-visible {
        outline: 2px solid var(--color-primary, #1a56db);
        outline-offset: 2px;
        border-radius: 2px;
      }
    }

    /* ---- States ---- */
    .state-loading,
    .state-error,
    .state-empty {
      padding: var(--space-md, 1rem);
      text-align: center;
    }

    .state-error--payment {
      text-align: left;
      background: var(--color-error-bg, #fff5f5);
      border: 1px solid var(--color-error, #e53e3e);
      border-radius: var(--radius-sm, 4px);
      margin-bottom: var(--space-sm, 0.5rem);
    }

    .loading-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--color-border, #e0e0e0);
      border-top-color: var(--color-primary, #1a56db);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto var(--space-sm, 0.5rem);
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ---- Terms accept ---- */
    .terms-content {
      max-height: 240px;
      overflow-y: auto;
      padding-right: var(--space-xs, 0.25rem);
    }

    .terms-accept {
      margin-top: var(--space-md, 1rem);
      padding-top: var(--space-md, 1rem);
      border-top: 1px solid var(--color-border, #e0e0e0);
    }

    .checkbox-label {
      display: flex;
      align-items: flex-start;
      gap: var(--space-sm, 0.5rem);
      cursor: pointer;
    }

    .checkbox-input {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      margin-top: 2px;
      cursor: pointer;
      accent-color: var(--color-primary, #1a56db);

      &:focus-visible {
        outline: 2px solid var(--color-primary, #1a56db);
        outline-offset: 2px;
      }
    }

    .checkbox-text {
      line-height: 1.4;
    }

    /* ---- Actions ---- */
    .form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: var(--space-lg, 1.5rem);
    }

    .btn {
      min-height: 44px;
      min-width: 120px;
      padding: var(--space-sm, 0.5rem) var(--space-lg, 1.5rem);
      border: none;
      border-radius: var(--radius-sm, 4px);
      font-size: var(--font-size-base, 1rem);
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;

      &:disabled,
      &[aria-disabled="true"] {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .btn--primary {
      background: var(--color-primary, #1a56db);
      color: #fff;

      &:hover:not(:disabled):not([aria-disabled="true"]) {
        background: var(--color-primary-dark, #1240a4);
      }
    }

    .btn--secondary {
      background: transparent;
      color: var(--color-primary, #1a56db);
      border: 2px solid var(--color-primary, #1a56db);

      &:hover:not(:disabled) { background: #eef4fc; }
    }

    .btn--pay {
      min-width: 160px;
    }

    /* ---- Responsive (AC-03.15) ---- */
    @media (max-width: 639px) {
      .summary-page {
        padding: var(--space-md, 1rem) var(--space-sm, 0.75rem);
      }

      .btn {
        width: 100%;
      }

      .form-actions {
        justify-content: stretch;
      }

      .data-label {
        flex-basis: 100%;
      }
    }

    @media (min-width: 1280px) {
      .summary-page {
        padding: var(--space-xl, 2rem) var(--space-lg, 1.5rem);
      }
    }
  `],
})
export class SummaryComponent implements OnInit, OnDestroy {
  readonly msgs = SYSTEM_MESSAGES;

  readonly #strapi = inject(StrapiClient);
  readonly #countryContext = inject(CountryContext);
  readonly #router = inject(Router);
  protected readonly wizardStore = inject(WizardStore);
  readonly #payment = inject(PaymentService);

  readonly pageState = signal<PageState>('loading');
  readonly terms = signal<TermsDocument | null>(null);
  readonly termsAccepted = signal(false);
  readonly payErrorMessage = signal<string | null>(null);

  #termsSub?: Subscription;
  #paymentSub?: Subscription;

  /** Reflects payment-in-progress state from the service (AC-03.5, AC-03.7). */
  readonly isSubmitting = computed(() => this.#payment.busy());

  /** Computed: pay button disabled condition (AC-03.4, AC-03.5, AC-03.7) */
  readonly isPayDisabled = computed(
    () =>
      !this.termsAccepted() ||
      this.pageState() !== 'ready' ||
      this.terms() === null ||
      this.isSubmitting(),
  );

  /** Computed: formatted final price for the selected plan (AC-03.13) */
  readonly finalPriceFormatted = computed(() => {
    const plan = this.wizardStore.selectedPlan();
    const applicant = this.wizardStore.applicant();
    if (!plan || !applicant) return '';
    const finalPrice = calculateFinalPrice(plan.basePrice, applicant);
    return formatPrice(finalPrice, plan.currency);
  });

  /**
   * Computed: applicant identity entries (section === 'applicant').
   * Uses field.label as display label; masks document number fields (F-03-1.3, AC-03.2).
   */
  readonly applicantIdentityEntries = computed(() => {
    const applicant = this.wizardStore.applicant();
    const fields = this.wizardStore.applicantFieldsSnapshot();
    if (!applicant || !fields) return [];

    return fields
      .filter((f) => f.section === 'applicant' || f.section == null)
      .map((field) => {
        const rawValue = applicant[field.key];
        const stringValue = rawValue === null || rawValue === undefined ? '' : String(rawValue);
        // Mask document number fields — NEVER expose the full value in the DOM (RN-03.11, AC-03.16, F-03-1.1)
        const value = isDocumentKey(field.key) ? maskDocument(stringValue) : stringValue;
        return { label: field.label, value };
      });
  });

  /**
   * Computed: vehicle entries (section === 'vehicle').
   * Uses field.label as display label (F-03-1.3, RN-03.1).
   */
  readonly vehicleEntries = computed(() => {
    const applicant = this.wizardStore.applicant();
    const fields = this.wizardStore.applicantFieldsSnapshot();
    if (!applicant || !fields) return [];

    return fields
      .filter((f) => f.section === 'vehicle')
      .map((field) => {
        const rawValue = applicant[field.key];
        const stringValue = rawValue === null || rawValue === undefined ? '' : String(rawValue);
        return { label: field.label, value: stringValue };
      });
  });

  /** Aria announcement for screen readers (AC-03.14) */
  readonly ariaAnnouncement = computed(() => {
    // Only announce 'loading' — the error (role="alert") containers are live regions themselves.
    return this.pageState() === 'loading' ? this.msgs['summary.loading'] : '';
  });

  readonly editDataUrl = computed(
    () => `/${this.#countryContext.country().toLowerCase()}/paso-1`,
  );

  readonly changePlanUrl = computed(
    () => `/${this.#countryContext.country().toLowerCase()}/paso-2`,
  );

  ngOnInit(): void {
    this.loadTerms();
  }

  ngOnDestroy(): void {
    this.#termsSub?.unsubscribe();
    this.#paymentSub?.unsubscribe();
  }

  loadTerms(): void {
    this.pageState.set('loading');
    this.#termsSub?.unsubscribe();

    const country = this.#countryContext.country();

    this.#termsSub = this.#strapi.getTerms(country).subscribe({
      next: (doc) => {
        this.terms.set(doc);
        this.pageState.set('ready');
      },
      error: () => {
        this.pageState.set('error');
      },
    });
  }

  onTermsChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.termsAccepted.set(checkbox.checked);
  }

  onPay(): void {
    if (this.isPayDisabled()) return;

    const plan = this.wizardStore.selectedPlan();
    if (!plan) return;

    this.payErrorMessage.set(null);

    this.#paymentSub?.unsubscribe();
    this.#paymentSub = this.#payment.simulate(plan.documentId).subscribe({
      next: (outcome) => {
        if (outcome.ok) {
          this.wizardStore.setQuoteNumber(outcome.quoteNumber);
          // ADR-010 D4-A — replaceUrl prevents back-button to payment
          const country = this.#countryContext.country().toLowerCase();
          void this.#router.navigate(['/', country, 'confirmacion'], { replaceUrl: true });
        }
      },
      error: () => {
        this.payErrorMessage.set(this.msgs['summary.payError']);
        // checkbox stays checked (G-03.10, AC-03.6)
      },
    });
  }

  goEditData(event: Event): void {
    event.preventDefault();
    void this.#router.navigate([this.editDataUrl()]);
  }

  goChangePlan(event: Event): void {
    event.preventDefault();
    void this.#router.navigate([this.changePlanUrl()]);
  }
}
