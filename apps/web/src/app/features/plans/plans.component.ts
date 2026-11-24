/**
 * PlansComponent — Step 2 of the wizard.
 * Renders published, active plans for the active country.
 * Implements loading (AC-02.10), error (AC-02.11), empty (AC-02.12), ready states.
 * Plan selection persists in WizardStore (AC-02.5, AC-02.7, RN-02.5).
 * Price adjustment based on vehicle year (AC-02.3, RN-02.4).
 * Accessible: role="radiogroup" + role="radio" + aria-checked (G-02.8, AC-02.14).
 * Responsive: 375px (single column) / 1280px (3-column grid) (AC-02.15).
 * AC-02.1, AC-02.2, AC-02.3, AC-02.4, AC-02.5, AC-02.6, AC-02.7, AC-02.8,
 * AC-02.9, AC-02.10, AC-02.11, AC-02.12, AC-02.13, AC-02.14, AC-02.15, AC-02.16
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

import type { Plan } from '../../core/schemas/plan.schema';
import { StrapiClient } from '../../core/strapi.client';
import { SYSTEM_MESSAGES } from '../../core/system-messages';
import { calculateFinalPrice, formatPrice } from '../../core/pricing';
import { CountryContext } from '../../country/country.context';
import { WizardStore } from '../../wizard/wizard.store';

type LoadState = 'loading' | 'error' | 'empty' | 'ready';

@Component({
  selector: 'app-plans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="plans-page" aria-labelledby="plans-title">
      <h1 id="plans-title" class="plans-title" tabindex="-1">
        Elige tu plan
      </h1>

      <!-- Visually-hidden aria-live region for state transition announcements (AC-02.10, AC-02.14) -->
      <div aria-live="polite" aria-atomic="true" class="visually-hidden">
        {{ ariaStatusMessage() }}
      </div>

      @switch (loadState()) {
        @case ('loading') {
          <div class="state-loading" role="status">
            <div class="loading-spinner"></div>
            <p>{{ msgs['plans.loading'] }}</p>
          </div>
        }

        @case ('error') {
          <div role="alert" class="state-error">
            <p>{{ msgs['plans.loadError'] }}</p>
            <button
              type="button"
              class="btn btn--secondary"
              (click)="loadPlans()"
            >
              {{ msgs['plans.retry'] }}
            </button>
          </div>
        }

        @case ('empty') {
          <div role="status" class="state-empty">
            <p>{{ msgs['plans.empty'] }}</p>
          </div>
        }

        @case ('ready') {
          <!-- Selection-cleared notice (G-02.11) -->
          @if (selectionCleared()) {
            <div role="alert" class="selection-cleared-notice">
              {{ msgs['plans.selectionCleared'] }}
            </div>
          }

          <!-- Plan list as radiogroup (AC-02.14, G-02.8, ADR-007 §Accesibilidad) -->
          <div
            role="radiogroup"
            aria-labelledby="plans-title"
            class="plans-grid"
          >
            @for (plan of plans(); track plan.documentId) {
              <div
                role="radio"
                [attr.aria-checked]="isSelected(plan) ? 'true' : 'false'"
                [attr.aria-label]="plan.name"
                [class.plan-card]="true"
                [class.plan-card--selected]="isSelected(plan)"
                [class.plan-card--recommended]="plan.recommended"
                tabindex="0"
                (click)="selectPlan(plan)"
                (keydown.enter)="selectPlan(plan)"
                (keydown.space)="onSpaceKey($event, plan)"
              >
                <!-- Recommended badge (AC-02.4, RN-02.6) -->
                @if (plan.recommended) {
                  <span class="badge badge--recommended" aria-label="{{ msgs['plans.recommended'] }}">
                    {{ msgs['plans.recommended'] }}
                  </span>
                }

                <!-- Plan header -->
                <div class="plan-header">
                  <h2 class="plan-name">{{ plan.name }}</h2>
                  <p class="plan-description">{{ plan.shortDescription }}</p>
                </div>

                <!-- Price (AC-02.2, AC-02.3) -->
                <div class="plan-price">
                  <span class="price-amount">{{ finalPrice(plan) }}</span>
                  @if (isPriceAdjusted(plan)) {
                    <span class="price-adjusted-label">
                      {{ msgs['plans.priceAdjustedLabel'] }}
                    </span>
                  }
                </div>

                <!-- Coverages (AC-02.1, RN-02.1) -->
                @if (plan.coverages.length > 0) {
                  <div class="plan-coverages">
                    <ul class="coverage-list">
                      @for (coverage of plan.coverages; track coverage.label) {
                        <li class="coverage-item">
                          <span class="coverage-label">{{ coverage.label }}</span>
                          @if (coverage.description) {
                            <span class="coverage-description">{{ coverage.description }}</span>
                          }
                        </li>
                      }
                    </ul>
                  </div>
                }

                <!-- Benefits (AC-02.1, RN-02.1) -->
                @if (plan.benefits.length > 0) {
                  <div class="plan-benefits">
                    <ul class="benefit-list">
                      @for (benefit of plan.benefits; track benefit.label) {
                        <li class="benefit-item">
                          <span class="benefit-label">{{ benefit.label }}</span>
                          @if (benefit.description) {
                            <span class="benefit-description">{{ benefit.description }}</span>
                          }
                        </li>
                      }
                    </ul>
                  </div>
                }

                <!-- Selection indicator (AC-02.5, AC-02.14) -->
                <div class="plan-select-indicator" aria-hidden="true">
                  @if (isSelected(plan)) {
                    <span class="indicator indicator--selected">{{ msgs['plans.selected'] }}</span>
                  } @else {
                    <span class="indicator indicator--unselected">{{ msgs['plans.select'] }}</span>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Navigation actions (AC-02.6, AC-02.8) -->
          <div class="plans-actions">
            <button
              type="button"
              class="btn btn--secondary"
              (click)="goBack()"
            >
              {{ msgs['plans.volver'] }}
            </button>
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="!hasSelection()"
              [attr.aria-disabled]="!hasSelection() ? 'true' : null"
              (click)="goNext()"
            >
              {{ msgs['plans.continuar'] }}
            </button>
          </div>
        }
      }
    </main>
  `,
  styles: [`
    .plans-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: var(--space-lg) var(--space-md);
    }

    .plans-title {
      font-size: var(--font-size-xl);
      margin-bottom: var(--space-lg);
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

    /* ---- Loading / Error / Empty states ---- */

    .state-loading,
    .state-error,
    .state-empty {
      padding: var(--space-lg);
      text-align: center;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto var(--space-md);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ---- Selection cleared notice ---- */

    .selection-cleared-notice {
      background: var(--color-warning-bg, #fff8e1);
      border: 1px solid var(--color-warning, #f59e0b);
      border-radius: var(--radius-sm);
      padding: var(--space-sm) var(--space-md);
      margin-bottom: var(--space-md);
      font-size: var(--font-size-sm, 0.875rem);
    }

    /* ---- Plans grid: 1 column on mobile, 3 columns on desktop (AC-02.15) ---- */

    .plans-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-md);
      margin-bottom: var(--space-xl);
    }

    /* ---- Plan card ---- */

    .plan-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-md, 8px);
      padding: var(--space-md);
      background: #fff;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
      outline: none;

      /* Ensure minimum touch target size (AC-02.15) */
      min-height: 44px;

      &:focus-visible {
        outline: 3px solid var(--color-primary);
        outline-offset: 2px;
      }

      &:hover {
        border-color: var(--color-primary);
      }
    }

    .plan-card--selected {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 1px var(--color-primary);
    }

    .plan-card--recommended {
      border-color: var(--color-secondary, #10b981);
    }

    .plan-card--recommended.plan-card--selected {
      border-color: var(--color-primary);
    }

    /* ---- Badge ---- */

    .badge {
      display: inline-block;
      padding: 2px var(--space-sm);
      border-radius: var(--radius-xs, 4px);
      font-size: var(--font-size-xs, 0.75rem);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge--recommended {
      background: var(--color-secondary-bg, #d1fae5);
      color: var(--color-secondary-text, #065f46);
    }

    /* ---- Plan header ---- */

    .plan-name {
      font-size: var(--font-size-lg, 1.125rem);
      font-weight: 700;
      margin: 0;
    }

    .plan-description {
      font-size: var(--font-size-sm, 0.875rem);
      color: var(--color-text-muted, #6b7280);
      margin: 0;
    }

    /* ---- Price (AC-02.2, AC-02.3) ---- */

    .plan-price {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .price-amount {
      font-size: var(--font-size-xl, 1.5rem);
      font-weight: 700;
      color: var(--color-primary);
    }

    .price-adjusted-label {
      font-size: var(--font-size-xs, 0.75rem);
      color: var(--color-warning-text, #92400e);
      font-style: italic;
    }

    /* ---- Coverages / Benefits ---- */

    .coverage-list,
    .benefit-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .coverage-item,
    .benefit-item {
      display: flex;
      flex-direction: column;
      font-size: var(--font-size-sm, 0.875rem);
    }

    .coverage-label,
    .benefit-label {
      font-weight: 600;

      /* Checkmark prefix for coverages */
      &::before {
        content: '✓ ';
        color: var(--color-secondary, #10b981);
      }
    }

    .coverage-description,
    .benefit-description {
      font-size: var(--font-size-xs, 0.75rem);
      color: var(--color-text-muted, #6b7280);
      padding-left: 1.25em;
    }

    /* ---- Select indicator ---- */

    .plan-select-indicator {
      margin-top: auto;
    }

    .indicator {
      display: inline-block;
      padding: var(--space-xs, 4px) var(--space-sm);
      border-radius: var(--radius-xs, 4px);
      font-size: var(--font-size-sm, 0.875rem);
      font-weight: 600;
    }

    .indicator--selected {
      background: var(--color-primary);
      color: #fff;
    }

    .indicator--unselected {
      background: transparent;
      color: var(--color-primary);
      border: 1px solid var(--color-primary);
    }

    /* ---- Actions ---- */

    .plans-actions {
      display: flex;
      justify-content: space-between;
      gap: var(--space-md);
      margin-top: var(--space-lg);
    }

    .btn {
      min-height: var(--touch-target-min, 44px);
      min-width: 120px;
      padding: var(--space-sm) var(--space-lg);
      border: none;
      border-radius: var(--radius-sm);
      font-size: var(--font-size-base);
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      &:focus-visible {
        outline: 3px solid var(--color-primary);
        outline-offset: 2px;
      }
    }

    .btn--primary {
      background: var(--color-primary);
      color: #fff;

      &:hover:not(:disabled) {
        background: var(--color-primary-dark);
      }
    }

    .btn--secondary {
      background: transparent;
      color: var(--color-primary);
      border: 2px solid var(--color-primary);

      &:hover:not(:disabled) {
        background: #eef4fc;
      }
    }

    /* ---- Responsive: 375px — single column, full-width buttons (AC-02.15) ---- */
    @media (max-width: 639px) {
      .plans-page {
        padding: var(--space-md) var(--space-sm);
      }

      .plans-actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
      }
    }

    /* ---- Responsive: 1280px+ — 3-column grid (AC-02.15) ---- */
    @media (min-width: 1280px) {
      .plans-page {
        padding: var(--space-xl) var(--space-lg);
      }

      .plans-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    /* ---- Intermediate breakpoint: tablet / 768px — 2 columns ---- */
    @media (min-width: 640px) and (max-width: 1279px) {
      .plans-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `],
})
export class PlansComponent implements OnInit, OnDestroy {
  readonly msgs = SYSTEM_MESSAGES;

  readonly #strapi = inject(StrapiClient);
  readonly #countryContext = inject(CountryContext);
  readonly #wizardStore = inject(WizardStore);
  readonly #router = inject(Router);

  readonly loadState = signal<LoadState>('loading');
  readonly plans = signal<Plan[]>([]);
  readonly selectionCleared = signal(false);

  /** Currently selected plan documentId (from WizardStore — AC-02.5, AC-02.7). */
  readonly selectedPlanId = computed(() => this.#wizardStore.selectedPlanId());

  /** Whether a plan is currently selected (AC-02.6). */
  readonly hasSelection = computed(() => this.selectedPlanId() !== null);

  /** aria-live announcement for screen readers (AC-02.10, AC-02.14). */
  readonly ariaStatusMessage = computed(() => {
    // 'loading' needs an announcement since the spinner has no meaningful text for AT.
    // 'empty' is handled by the visible role="status" container — no duplicate needed.
    return this.loadState() === 'loading' ? this.msgs['plans.loading'] : '';
  });

  #loadSub?: Subscription;

  ngOnInit(): void {
    this.loadPlans();
  }

  ngOnDestroy(): void {
    this.#loadSub?.unsubscribe();
  }

  loadPlans(): void {
    this.loadState.set('loading');
    this.selectionCleared.set(false);
    this.#loadSub?.unsubscribe();

    const country = this.#countryContext.country();

    this.#loadSub = this.#strapi.getPlans(country).subscribe({
      next: (plans) => {
        if (plans.length === 0) {
          this.loadState.set('empty');
          return;
        }

        this.plans.set(plans);

        // G-02.11: if stored selectedPlanId is no longer in the list, clear it
        const storedId = this.#wizardStore.selectedPlanId();
        if (storedId !== null) {
          const stillExists = plans.some((p) => p.documentId === storedId);
          if (!stillExists) {
            this.#wizardStore.clearPlan();
            this.selectionCleared.set(true);
          }
        }

        this.loadState.set('ready');
      },
      error: () => {
        this.loadState.set('error');
      },
    });
  }

  /** Returns whether this plan is currently selected (AC-02.5). */
  isSelected(plan: Plan): boolean {
    return this.selectedPlanId() === plan.documentId;
  }

  /** Selects a plan and stores it in WizardStore (AC-02.5, AC-02.7, RN-02.5). */
  selectPlan(plan: Plan): void {
    this.#wizardStore.selectPlan(plan);
    this.selectionCleared.set(false);
  }

  /** Handle Space key — prevent default scroll and select (AC-02.14). */
  onSpaceKey(event: Event, plan: Plan): void {
    event.preventDefault();
    this.selectPlan(plan);
  }

  /**
   * Computes the final displayed price for a plan.
   * Reads applicant from WizardStore for vehicleYear (AC-02.3, RN-02.4).
   */
  finalPrice(plan: Plan): string {
    const applicant = this.#wizardStore.applicant() ?? {};
    const price = calculateFinalPrice(plan.basePrice, applicant);
    return formatPrice(price, plan.currency);
  }

  /**
   * Returns true when the surcharge was applied (AC-02.3, RN-02.4).
   * Used to show the "precio ajustado" label (G-02.6).
   */
  isPriceAdjusted(plan: Plan): boolean {
    const applicant = this.#wizardStore.applicant() ?? {};
    const adjusted = calculateFinalPrice(plan.basePrice, applicant);
    return adjusted !== plan.basePrice;
  }

  /** Navigates to step 1 preserving state (AC-02.8, RN-02.9). */
  goBack(): void {
    const country = this.#countryContext.country().toLowerCase();
    this.#router.navigate([`/${country}/paso-1`]);
  }

  /**
   * Navigates to step 3 if a plan is selected (AC-02.6).
   * Button is disabled when no plan is selected, so this guard is defensive.
   */
  goNext(): void {
    if (!this.hasSelection()) return;
    const country = this.#countryContext.country().toLowerCase();
    this.#router.navigate([`/${country}/paso-3`]);
  }
}

