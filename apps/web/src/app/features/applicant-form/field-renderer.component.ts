/**
 * FieldRendererComponent — renders a single form field by type.
 * Uses @switch (field().type) for discriminated narrowing (ADR-006, RN-01.10).
 * Sets aria-invalid and aria-describedby for accessibility (AC-01.13).
 * AC-01.2, AC-01.8, AC-01.13
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import type { FormField } from '../../core/schemas/form-field.schema';
import { FieldErrorComponent } from './field-error.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-field-renderer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FieldErrorComponent],
  template: `
    <div class="field-wrapper">
      @switch (field().type) {
        @case ('text') {
          <label [for]="fieldId()" class="field-label">
            {{ field().label }}
            @if (field().required) { <span aria-hidden="true" class="required-mark">*</span> }
          </label>
          <input
            #inputRef
            type="text"
            [id]="fieldId()"
            [formControl]="control"
            [attr.autocomplete]="field().autocomplete ?? null"
            [attr.aria-invalid]="isInvalid() ? 'true' : null"
            [attr.aria-describedby]="descriptionIds()"
            class="field-input"
          />
        }
        @case ('number') {
          <label [for]="fieldId()" class="field-label">
            {{ field().label }}
            @if (field().required) { <span aria-hidden="true" class="required-mark">*</span> }
          </label>
          <input
            #inputRef
            type="number"
            [id]="fieldId()"
            [formControl]="control"
            [attr.aria-invalid]="isInvalid() ? 'true' : null"
            [attr.aria-describedby]="descriptionIds()"
            class="field-input"
          />
        }
        @case ('date') {
          <label [for]="fieldId()" class="field-label">
            {{ field().label }}
            @if (field().required) { <span aria-hidden="true" class="required-mark">*</span> }
          </label>
          <input
            #inputRef
            type="date"
            [id]="fieldId()"
            [formControl]="control"
            [attr.aria-invalid]="isInvalid() ? 'true' : null"
            [attr.aria-describedby]="descriptionIds()"
            class="field-input"
          />
        }
        @case ('checkbox') {
          <div class="field-checkbox-wrapper">
            <input
              #inputRef
              type="checkbox"
              [id]="fieldId()"
              [formControl]="control"
              [attr.aria-invalid]="isInvalid() ? 'true' : null"
              [attr.aria-describedby]="descriptionIds()"
              class="field-checkbox"
            />
            <label [for]="fieldId()" class="field-label field-label--inline">
              {{ field().label }}
              @if (field().required) { <span aria-hidden="true" class="required-mark">*</span> }
            </label>
          </div>
        }
        @case ('select') {
          <label [for]="fieldId()" class="field-label">
            {{ field().label }}
            @if (field().required) { <span aria-hidden="true" class="required-mark">*</span> }
          </label>
          <select
            #inputRef
            [id]="fieldId()"
            [formControl]="control"
            [attr.aria-invalid]="isInvalid() ? 'true' : null"
            [attr.aria-describedby]="descriptionIds()"
            class="field-select"
          >
            <option value="">—</option>
            @for (opt of sortedOptions(); track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        }
      }

      @if (field().helpText) {
        <span [id]="helpId()" class="field-help">{{ field().helpText }}</span>
      }

      <app-field-error
        [errorId]="errorId()"
        [message]="errorMessage()"
      />
    </div>
  `,
  styles: [`
    .field-wrapper {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: var(--space-md);
    }

    .field-label {
      font-size: var(--font-size-base);
      font-weight: 500;
      color: var(--color-text);
    }

    .field-label--inline {
      display: inline;
      font-weight: normal;
    }

    .required-mark {
      margin-left: 2px;
      color: var(--color-error);
    }

    .field-input,
    .field-select {
      width: 100%;
      min-height: var(--touch-target-min);
      padding: var(--space-sm) var(--space-md);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-base);
      color: var(--color-text);
      background: var(--color-bg);
      transition: border-color 0.15s;

      &:focus-visible {
        outline: 3px solid var(--color-border-focus);
        outline-offset: 2px;
      }

      &[aria-invalid='true'] {
        border-color: var(--color-border-error);
        background: var(--color-error-bg);
      }
    }

    .field-checkbox-wrapper {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .field-checkbox {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      cursor: pointer;
    }

    .field-help {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }
  `],
})
export class FieldRendererComponent implements OnInit, OnDestroy {
  readonly field = input.required<FormField>();
  readonly formGroup = input.required<FormGroup>();

  readonly inputRef = viewChild<ElementRef<HTMLElement>>('inputRef');

  readonly fieldId = computed(() => `field-${this.field().key}`);
  readonly errorId = computed(() => `error-${this.field().key}`);
  readonly helpId = computed(() => `help-${this.field().key}`);

  readonly descriptionIds = computed(() => {
    const ids: string[] = [];
    if (this.field().helpText) ids.push(this.helpId());
    if (this.isInvalid()) ids.push(this.errorId());
    return ids.length > 0 ? ids.join(' ') : null;
  });

  readonly #elementRef = inject(ElementRef);

  readonly isInvalid = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Returns the current FormControl for this field.
   * Not a computed() because FormGroup.setControl() mutates the group without
   * changing the signal reference — a computed would return a stale value.
   * Always read via this method instead.
   */
  get control(): FormControl {
    const ctrl = this.formGroup().get(this.field().key);
    if (!ctrl) {
      throw new Error(`[FieldRenderer] No control found for key: ${this.field().key}`);
    }
    return ctrl as FormControl;
  }

  readonly sortedOptions = computed(() => {
    const f = this.field();
    if (f.type !== 'select') return [];
    return [...f.options].sort((a, b) => a.order - b.order);
  });

  #statusSub?: Subscription;
  #hasShownError = false;

  ngOnInit(): void {
    this.#watchStatus();
  }

  ngOnDestroy(): void {
    this.#statusSub?.unsubscribe();
  }

  #watchStatus(): void {
    const ctrl = this.control;

    this.#statusSub = ctrl.statusChanges.subscribe(() => {
      this.#updateErrorState();

      // RN-01.14: once first error appears, switch to 'change' mode
      if (!this.#hasShownError && ctrl.invalid && ctrl.touched) {
        this.#hasShownError = true;
        this.#promoteToChangeMode();
      }
    });

    // Initial state
    this.#updateErrorState();
  }

  #updateErrorState(): void {
    const ctrl = this.control;
    const invalid = ctrl.invalid && (ctrl.touched || ctrl.dirty);
    this.isInvalid.set(invalid);

    if (invalid && ctrl.errors) {
      this.errorMessage.set(this.#resolveErrorMessage());
    } else {
      this.errorMessage.set(null);
    }
  }

  /**
   * Resolves the error message in priority order:
   * 1. errorMessage from the specific validation rule that failed
   * 2. field.errorMessage (generic)
   * ADR-004 §Message de error
   */
  #resolveErrorMessage(): string {
    const ctrl = this.control;
    const field = this.field();

    if (ctrl.errors) {
      const failedKey = Object.keys(ctrl.errors)[0];
      const matchingValidation = field.validations.find((v) => v.rule === failedKey);
      if (matchingValidation?.errorMessage) {
        return matchingValidation.errorMessage;
      }
    }

    return field.errorMessage;
  }

  /**
   * Replaces the current control with a 'change' updateOn mode control.
   * This is needed because updateOn cannot be changed on an existing control.
   * ADR-004 §Estrategia blur → change tras error.
   */
  #promoteToChangeMode(): void {
    const ctrl = this.control;
    const group = this.formGroup();
    const key = this.field().key;

    const newCtrl = new FormControl(ctrl.value, {
      validators: ctrl.validator ?? undefined,
      updateOn: 'change',
    });

    // Preserve touched/dirty state
    if (ctrl.touched) newCtrl.markAsTouched();
    if (ctrl.dirty) newCtrl.markAsDirty();

    group.setControl(key, newCtrl);

    // Re-subscribe to the new control
    this.#statusSub?.unsubscribe();
    this.#statusSub = newCtrl.statusChanges.subscribe(() => {
      this.#updateErrorState();
    });
  }

  focus(): void {
    const ref = this.inputRef();
    if (ref?.nativeElement) {
      ref.nativeElement.focus();
    } else {
      // Fallback: find the first focusable element
      const el = this.#elementRef.nativeElement.querySelector(
        'input, select, textarea',
      ) as HTMLElement | null;
      el?.focus();
    }
  }
}
