/**
 * ApplicantFormComponent — Step 1 of the wizard.
 * Dynamically renders form fields configured in Strapi (RN-01.1, RN-01.7).
 * Implements loading (AC-01.9), error (AC-01.10), empty (AC-01.11) states.
 * Persists to WizardStore on valid advance (AC-01.5).
 * Focuses first invalid field on submit attempt (AC-01.3).
 * AC-01.1, AC-01.2, AC-01.3, AC-01.4, AC-01.5, AC-01.8, AC-01.9, AC-01.10, AC-01.11, AC-01.12, AC-01.13, AC-01.14, AC-01.15
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import type { FormField } from '../../core/schemas/form-field.schema';
import { StrapiClient } from '../../core/strapi.client';
import { SYSTEM_MESSAGES } from '../../core/system-messages';
import { CountryContext } from '../../country/country.context';
import { WizardStore } from '../../wizard/wizard.store';
import { buildValidators } from './validator-registry';
import { FieldRendererComponent } from './field-renderer.component';

type LoadState = 'loading' | 'error' | 'empty' | 'ready';

@Component({
  selector: 'app-applicant-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FieldRendererComponent],
  template: `
    <main class="form-page" aria-labelledby="form-title">
      <h1 id="form-title" class="form-title" tabindex="-1">
        {{ msgs['wizard.step1.title'] }}
      </h1>

      <!-- Single persistent aria-live region for state announcements (F-01-1.3) -->
      <div role="status" aria-live="polite" aria-atomic="true" class="visually-hidden">
        {{ ariaStatusMessage() }}
      </div>

      @switch (loadState()) {
        @case ('loading') {
          <div class="state-loading" aria-hidden="true">
            <div class="loading-spinner"></div>
            <p>{{ msgs['form.loading'] }}</p>
          </div>
        }

        @case ('error') {
          <div role="alert" class="state-error">
            <p>{{ msgs['form.loadError'] }}</p>
            <button
              type="button"
              class="btn btn--secondary"
              (click)="loadFields()"
            >
              {{ msgs['form.retry'] }}
            </button>
          </div>
        }

        @case ('empty') {
          <div class="state-empty" aria-hidden="true">
            <p>{{ msgs['form.empty'] }}</p>
          </div>
        }

        @case ('ready') {
          <form
            [formGroup]="form()"
            (ngSubmit)="onSubmit()"
            novalidate
            class="applicant-form"
          >
            @for (field of fields(); track field.documentId) {
              <app-field-renderer
                [field]="field"
                [formGroup]="form()"
              />
            }

            <div class="form-actions">
              <button
                type="submit"
                class="btn btn--primary"
                [disabled]="isSubmitting() || formInvalid()"
                [attr.aria-busy]="isSubmitting() ? 'true' : null"
              >
                Continuar
              </button>
            </div>
          </form>
        }
      }
    </main>
  `,
  styles: [`
    .form-page {
      max-width: 600px;
      margin: 0 auto;
      padding: var(--space-lg) var(--space-md);
    }

    .form-title {
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

    .applicant-form {
      display: flex;
      flex-direction: column;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: var(--space-lg);
    }

    .btn {
      min-height: var(--touch-target-min);
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

    // Responsive (AC-01.14) — 375px
    @media (max-width: 639px) {
      .form-page {
        padding: var(--space-md) var(--space-sm);
      }

      .btn {
        width: 100%;
      }

      .form-actions {
        justify-content: stretch;
      }
    }

    // 1280px+ — form gets some breathing room
    @media (min-width: 1280px) {
      .form-page {
        padding: var(--space-xl) var(--space-lg);
      }
    }
  `],
})
export class ApplicantFormComponent implements OnInit, OnDestroy {
  readonly msgs = SYSTEM_MESSAGES;

  readonly #strapi = inject(StrapiClient);
  readonly #countryContext = inject(CountryContext);
  readonly #wizardStore = inject(WizardStore);
  readonly #router = inject(Router);

  readonly fieldRenderers = viewChildren(FieldRendererComponent);

  readonly loadState = signal<LoadState>('loading');
  readonly fields = signal<FormField[]>([]);
  readonly form = signal<FormGroup>(new FormGroup({}));
  readonly isSubmitting = signal(false);
  readonly formInvalid = signal(true);

  readonly ariaStatusMessage = computed(() => {
    switch (this.loadState()) {
      case 'loading': return this.msgs['form.loading'];
      case 'empty': return this.msgs['form.empty'];
      default: return '';
    }
  });

  #loadSub?: Subscription;
  #statusSub?: Subscription;

  ngOnInit(): void {
    this.loadFields();
  }

  ngOnDestroy(): void {
    this.#loadSub?.unsubscribe();
    this.#statusSub?.unsubscribe();
    // Save to store on unmount if form is valid (AC-01.5)
    if (this.loadState() === 'ready' && this.form().valid) {
      const values = this.form().getRawValue() as Record<string, unknown>;
      const keys = this.fields().map((f) => f.key);
      this.#wizardStore.setApplicant(values, keys);
    }
  }

  loadFields(): void {
    this.loadState.set('loading');
    this.#loadSub?.unsubscribe();
    this.#statusSub?.unsubscribe();

    const country = this.#countryContext.country();

    this.#loadSub = this.#strapi.getFormFields(country).subscribe({
      next: (fields) => {
        if (fields.length === 0) {
          this.loadState.set('empty');
          return;
        }

        this.fields.set(fields);
        const builtForm = this.#buildForm(fields);
        this.form.set(builtForm);
        this.#hydrateFormFromStore(fields);

        // Track form validity for the submit button (F-01-1.2)
        this.formInvalid.set(builtForm.invalid);
        this.#statusSub = builtForm.statusChanges.subscribe(() => {
          this.formInvalid.set(this.form().invalid);
        });

        this.loadState.set('ready');
      },
      error: () => {
        this.loadState.set('error');
      },
    });
  }

  onSubmit(): void {
    if (this.isSubmitting()) return;

    const f = this.form();
    f.markAllAsTouched();
    // Force validators to run individually — markAllAsTouched alone does not
    // re-evaluate controls with updateOn:'blur' that haven't been interacted with (F-01-1.4)
    for (const ctrl of Object.values(f.controls)) {
      ctrl.updateValueAndValidity({ emitEvent: true });
    }

    if (f.invalid) {
      this.#focusFirstInvalidField();
      return;
    }

    this.isSubmitting.set(true);

    const values = f.getRawValue() as Record<string, unknown>;
    const keys = this.fields().map((field) => field.key);
    this.#wizardStore.setApplicant(values, keys);

    const country = this.#countryContext.country().toLowerCase();
    this.#router.navigate([`/${country}/paso-2`]).finally(() => {
      this.isSubmitting.set(false);
    });
  }

  #buildForm(fields: FormField[]): FormGroup {
    const controls: Record<string, FormControl> = {};

    for (const field of fields) {
      const validators = buildValidators(field.required, field.validations);
      const defaultValue = field.defaultValue ?? (field.type === 'checkbox' ? false : '');

      controls[field.key] = new FormControl(defaultValue, {
        validators,
        updateOn: 'blur', // RN-01.14: validate on blur initially
      });
    }

    return new FormGroup(controls);
  }

  /**
   * Restores previously entered values from WizardStore (AC-01.5, RN-01.8).
   * Keys that no longer exist in Strapi are silently ignored (AC-01.4).
   * Error messages are not shown until user re-interacts (AC-01.5).
   */
  #hydrateFormFromStore(fields: FormField[]): void {
    const stored = this.#wizardStore.applicant();
    const snapshot = this.#wizardStore.applicantFieldsSnapshot();

    if (stored === null || snapshot === null) return;

    const currentKeys = new Set(fields.map((f) => f.key));
    const form = this.form();

    for (const key of snapshot) {
      if (currentKeys.has(key) && stored[key] !== undefined) {
        const ctrl = form.get(key);
        if (ctrl) {
          ctrl.setValue(stored[key], { emitEvent: false });
          // Do not mark as touched — errors should not show until user re-interacts (AC-01.5)
        }
      }
    }
  }

  /**
   * Focuses the first invalid control in field order (AC-01.3, AC-01.13).
   */
  #focusFirstInvalidField(): void {
    const orderedFields = this.fields();
    const form = this.form();
    const renderers = this.fieldRenderers();

    for (const field of orderedFields) {
      const ctrl = form.get(field.key);
      if (ctrl?.invalid) {
        const renderer = renderers.find((r) => r.field().key === field.key);
        renderer?.focus();
        break;
      }
    }
  }
}
