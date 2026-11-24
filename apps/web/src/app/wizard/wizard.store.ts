/**
 * WizardStore — in-memory state for the multi-step wizard.
 * Uses @ngrx/signals SignalStore; provied at the /:country route level.
 * No localStorage / sessionStorage — PII data (RUT, cédula, DOB). ADR-005, RN-01.13.
 * AC-01.5
 */
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

export interface WizardState {
  /** Raw form values from step 1. Dynamic shape from Strapi (ADR-004). */
  applicant: Record<string, unknown> | null;
  /** Keys present when applicant was saved — used to detect Strapi config changes (AC-01.5, AC-01.4). */
  applicantFieldsSnapshot: string[] | null;
  /** Selected plan documentId from step 2. */
  selectedPlanId: string | null;
  /** Quote draft from step 3. */
  quote: null;
}

export const WizardStore = signalStore(
  withState<WizardState>({
    applicant: null,
    applicantFieldsSnapshot: null,
    selectedPlanId: null,
    quote: null,
  }),
  withMethods((store) => ({
    setApplicant(values: Record<string, unknown>, fieldKeys: string[]): void {
      patchState(store, {
        applicant: values,
        applicantFieldsSnapshot: fieldKeys,
      });
    },
    clearApplicant(): void {
      patchState(store, {
        applicant: null,
        applicantFieldsSnapshot: null,
      });
    },
    reset(): void {
      patchState(store, {
        applicant: null,
        applicantFieldsSnapshot: null,
        selectedPlanId: null,
        quote: null,
      });
    },
  })),
);
