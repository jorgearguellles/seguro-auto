/**
 * Pricing logic for the plan list (Step 2).
 * Simulated price adjustment based on vehicle age (RN-02.4, G-02.3, G-02.5, ADR-007).
 * AC-02.2, AC-02.3
 */

/** Strapi `key` for the vehicle year field — contract with the seed (ADR-007 G-02.5). */
export const VEHICLE_YEAR_FIELD_KEY = 'vehicleYear';

/** Number of years before a vehicle is considered "old" (G-02.3, ADR-007). */
export const PRICE_ADJUST_THRESHOLD_YEARS = 5;

/** Surcharge fraction applied when vehicle exceeds the threshold (G-02.3, ADR-007). */
export const PRICE_ADJUST_SURCHARGE = 0.1;

/**
 * Calculates the final price for a plan.
 * If applicant.vehicleYear is a number and currentYear - value > PRICE_ADJUST_THRESHOLD_YEARS,
 * applies a 10% surcharge (RN-02.4, G-02.3).
 * Falls back to basePrice if vehicleYear is absent or not a number (G-02.4, G-02.5).
 *
 * AC-02.3
 */
export function calculateFinalPrice(
  basePrice: number,
  applicant: Record<string, unknown>,
): number {
  const year = applicant[VEHICLE_YEAR_FIELD_KEY];
  if (typeof year !== 'number') return basePrice;

  const currentYear = new Date().getFullYear();
  if (currentYear - year > PRICE_ADJUST_THRESHOLD_YEARS) {
    return Math.round(basePrice * (1 + PRICE_ADJUST_SURCHARGE));
  }
  return basePrice;
}

/**
 * Formats a price as a locale-aware currency string.
 * CO → 'es-CO', COP, no decimals.
 * CL → 'es-CL', CLP, no decimals.
 * Both currencies are conventionally shown without decimal places (RN-02.3, AC-02.2).
 *
 * AC-02.2
 */
export function formatPrice(price: number, currency: 'COP' | 'CLP'): string {
  const locale = currency === 'COP' ? 'es-CO' : 'es-CL';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}
