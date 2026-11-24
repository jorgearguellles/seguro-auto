/**
 * WizardStore — in-memory state for the multi-step wizard.
 * Uses @ngrx/signals SignalStore; provied at the /:country route level.
 * No localStorage / sessionStorage — PII data (RUT, cédula, DOB). ADR-005, RN-01.13.
 * AC-01.5, AC-02.5, AC-02.7
 */
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import type { Plan } from '../core/schemas/plan.schema';
import type { FormField } from '../core/schemas/form-field.schema';

export interface WizardState {
  /** Raw form values from step 1. Dynamic shape from Strapi (ADR-004). */
  applicant: Record<string, unknown> | null;
  /**
   * Full FormField objects captured when applicant was saved.
   * Provides label + section for SummaryComponent (F-03-1.3, RN-03.1).
   * Replaces the previous `string[]` snapshot — still used for detecting
   * Strapi config changes (AC-01.5, AC-01.4).
   */
  applicantFieldsSnapshot: FormField[] | null;
  /** Selected plan documentId from step 2 (RN-02.5, AC-02.5). */
  selectedPlanId: string | null;
  /** Selected plan object from step 2 (AC-02.5, AC-02.7). */
  selectedPlan: Plan | null;
  /** Quote draft from step 3. */
  quote: null;
  /** Simulated quote number after successful payment (ADR-010 D3-A, AC-03.5, AC-03.17). */
  quoteNumber: string | null;
}

export const WizardStore = signalStore(
  withState<WizardState>({
    applicant: null,
    applicantFieldsSnapshot: null,
    selectedPlanId: null,
    selectedPlan: null,
    quote: null,
    quoteNumber: null,
  }),
  withMethods((store) => ({
    /** Saves applicant form values and the full FormField objects (label + section) for SummaryComponent (F-03-1.3). */
    setApplicant(values: Record<string, unknown>, fields: FormField[]): void {
      patchState(store, {
        applicant: values,
        applicantFieldsSnapshot: fields,
      });
    },
    clearApplicant(): void {
      patchState(store, {
        applicant: null,
        applicantFieldsSnapshot: null,
      });
    },
    /** Persists selected plan to store (AC-02.5, AC-02.7, RN-02.5). */
    selectPlan(plan: Plan): void {
      patchState(store, {
        selectedPlanId: plan.documentId,
        selectedPlan: plan,
      });
    },
    /** Clears selected plan — called when plan no longer in list (G-02.11). */
    clearPlan(): void {
      patchState(store, {
        selectedPlanId: null,
        selectedPlan: null,
      });
    },
    /** Persists the simulated quote number after a successful payment (ADR-010 D3-A, AC-03.5). */
    setQuoteNumber(quoteNumber: string): void {
      patchState(store, { quoteNumber });
    },
    reset(): void {
      patchState(store, {
        applicant: null,
        applicantFieldsSnapshot: null,
        selectedPlanId: null,
        selectedPlan: null,
        quote: null,
        quoteNumber: null,
      });
    },
  })),
);
