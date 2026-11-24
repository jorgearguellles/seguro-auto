/**
 * Zod schema for Strapi plan response.
 * Tolerant parsing: invalid plans are discarded + logged (AC-02.13).
 * currency ↔ country coherence validated (AC-02.16, ADR-007).
 * Sorts by order ascending, ties resolved by documentId (RN-02.7).
 * AC-02.1, AC-02.13, AC-02.16
 */
import { z } from 'zod';
import { logStructured } from '../logger';

// ---- Country code (re-exported for reuse) ----
export const countryCodeSchema = z.enum(['CO', 'CL']);
export type CountryCode = z.infer<typeof countryCodeSchema>;

// ---- Currency (AC-02.16, ADR-007 G-02.2) ----
export const currencySchema = z.enum(['COP', 'CLP']);
export type Currency = z.infer<typeof currencySchema>;

/** Map from country code to expected currency (AC-02.16). */
const EXPECTED_CURRENCY_BY_COUNTRY: Record<CountryCode, Currency> = {
  CO: 'COP',
  CL: 'CLP',
};

// ---- Coverage / Benefit component (ADR-007 D1-A) ----
const planCoverageSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional().nullable(),
  order: z.number().int().default(0),
});

const planBenefitSchema = planCoverageSchema; // same shape (ADR-007 D1-A)

export type PlanCoverage = z.infer<typeof planCoverageSchema>;
export type PlanBenefit = z.infer<typeof planBenefitSchema>;

// ---- Plan schema (ADR-007 §Esquema concreto) ----
export const planSchema = z
  .object({
    documentId: z.string().min(1),
    name: z.string().min(1),
    shortDescription: z.string().min(1),
    basePrice: z.number().int().nonnegative(),
    currency: currencySchema,
    coverages: z.array(planCoverageSchema).min(1), // AC-02.13: plan without coverages is discarded
    benefits: z.array(planBenefitSchema).default([]),
    order: z.number().int(),
    recommended: z.boolean(),
    active: z.literal(true), // defence in depth — query already filters (ADR-007)
    country: z.object({ code: countryCodeSchema }),
  })
  .refine(
    (plan) => plan.currency === EXPECTED_CURRENCY_BY_COUNTRY[plan.country.code],
    { message: 'currency does not match country', path: ['currency'] },
  ); // AC-02.16

export type Plan = z.infer<typeof planSchema>;

// ---- Tolerant top-level parser (AC-02.13) ----

const envelopeSchema = z.object({
  data: z.array(z.unknown()),
});

/**
 * parsePlans — parses the Strapi `{ data: [...] }` envelope tolerantly.
 * - Invalid envelope → returns [] and logs.
 * - Each item is safeParsed individually; failures → log + skip (AC-02.13).
 * - currency ↔ country mismatch → log + skip (AC-02.16).
 * - Result sorted by order asc; ties resolved by documentId asc (RN-02.7, ADR-007).
 */
export function parsePlans(raw: unknown): Plan[] {
  const envelopeResult = envelopeSchema.safeParse(raw);
  if (!envelopeResult.success) {
    logStructured('strapi.plans.envelopeInvalid', {
      issues: envelopeResult.error.issues,
    });
    return [];
  }

  const plans: Plan[] = [];

  for (const item of envelopeResult.data.data) {
    const result = planSchema.safeParse(item);
    if (!result.success) {
      const documentId =
        (item as { documentId?: string } | null)?.documentId ?? 'unknown';
      logStructured('strapi.plans.planDiscarded', {
        documentId,
        issues: result.error.issues.map((i) => ({
          path: i.path,
          code: i.code,
          message: i.message,
        })),
      });
      continue;
    }
    plans.push(result.data);
  }

  // RN-02.7: sort by order asc; ties resolved by documentId asc (ADR-007)
  return plans.sort((a, b) =>
    a.order !== b.order ? a.order - b.order : a.documentId.localeCompare(b.documentId),
  );
}
