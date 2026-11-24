/**
 * FieldErrorComponent — renders the error message for a form control.
 * Associates with the control via aria-describedby (AC-01.2, AC-01.13).
 */
import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

@Component({
  selector: 'app-field-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message()) {
      <span
        [id]="errorId()"
        class="field-error"
        role="alert"
        aria-live="polite"
      >{{ message() }}</span>
    }
  `,
  styles: [`
    .field-error {
      display: block;
      margin-top: 4px;
      font-size: var(--font-size-sm);
      color: var(--color-error);
    }
  `],
})
export class FieldErrorComponent {
  readonly errorId = input.required<string>();
  readonly message = input<string | null>(null);
}
