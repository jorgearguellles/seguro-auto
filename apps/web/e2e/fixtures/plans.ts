/**
 * Reusable mock payloads for Strapi plans responses.
 * All data is fictional (US-02 / SPEC-02).
 */

/** Three valid, active, published CO plans — baseline for most tests. */
export const CO_PLANS_RESPONSE = {
  data: [
    {
      documentId: 'plan-1',
      name: 'Básico',
      shortDescription: 'Cobertura básica',
      basePrice: 800000,
      currency: 'COP',
      coverages: [{ label: 'RT', description: 'Responsabilidad civil', order: 0 }],
      benefits: [{ label: 'Asistencia', order: 0 }],
      order: 1,
      recommended: false,
      active: true,
      country: { code: 'CO' },
    },
    {
      documentId: 'plan-2',
      name: 'Estándar',
      shortDescription: 'La mejor opción',
      basePrice: 1200000,
      currency: 'COP',
      coverages: [
        { label: 'RT', order: 0 },
        { label: 'Daños', order: 1 },
      ],
      benefits: [{ label: 'Asistencia', order: 0 }],
      order: 2,
      recommended: true,
      active: true,
      country: { code: 'CO' },
    },
    {
      documentId: 'plan-3',
      name: 'Premium',
      shortDescription: 'Todo incluido',
      basePrice: 1800000,
      currency: 'COP',
      coverages: [{ label: 'RT', order: 0 }],
      benefits: [{ label: 'Asistencia', order: 0 }],
      order: 3,
      recommended: false,
      active: true,
      country: { code: 'CO' },
    },
  ],
};

/** One plan with a known basePrice for price-adjustment arithmetic (AC-02.3). */
export const CO_PLANS_KNOWN_PRICE_RESPONSE = {
  data: [
    {
      documentId: 'plan-price-test',
      name: 'Plan Precio',
      shortDescription: 'Para verificar ajuste',
      basePrice: 1000000,
      currency: 'COP',
      coverages: [{ label: 'RT', description: 'Responsabilidad civil', order: 0 }],
      benefits: [],
      order: 1,
      recommended: false,
      active: true,
      country: { code: 'CO' },
    },
  ],
};

/** Plans with one inactive (active=false) entry — it must NOT appear (AC-02.7). */
export const CO_PLANS_WITH_INACTIVE_RESPONSE = {
  data: [
    ...CO_PLANS_RESPONSE.data,
    {
      documentId: 'plan-inactive',
      name: 'Plan Oculto',
      shortDescription: 'No debería mostrarse',
      basePrice: 500000,
      currency: 'COP',
      coverages: [{ label: 'RT', order: 0 }],
      benefits: [],
      order: 4,
      recommended: false,
      active: false,
      country: { code: 'CO' },
    },
  ],
};

/** Empty plans list — empty state test (AC-02.11, AC-02.12). */
export const EMPTY_PLANS_RESPONSE = { data: [] };

/**
 * Plan whose coverages array is empty.
 * zod schema requires coverages.min(1) so this plan must be discarded (AC-02.13).
 */
export const CO_PLANS_NO_COVERAGES_RESPONSE = {
  data: [
    {
      documentId: 'plan-no-coverages',
      name: 'Plan Sin Coberturas',
      shortDescription: 'Inválido por zod',
      basePrice: 600000,
      currency: 'COP',
      coverages: [],
      benefits: [],
      order: 1,
      recommended: false,
      active: true,
      country: { code: 'CO' },
    },
    // A valid plan alongside the invalid one
    {
      documentId: 'plan-valid',
      name: 'Plan Válido',
      shortDescription: 'Pasa la validación',
      basePrice: 900000,
      currency: 'COP',
      coverages: [{ label: 'RT', order: 0 }],
      benefits: [],
      order: 2,
      recommended: false,
      active: true,
      country: { code: 'CO' },
    },
  ],
};

/**
 * CO plan with currency='CLP' — incoherent currency for country (AC-02.16).
 * zod refine rejects it; plan must NOT appear.
 */
export const CO_PLANS_WRONG_CURRENCY_RESPONSE = {
  data: [
    {
      documentId: 'plan-wrong-currency',
      name: 'Plan Moneda Incorrecta',
      shortDescription: 'currency no coincide con país',
      basePrice: 50000,
      currency: 'CLP', // wrong: CO should use COP
      coverages: [{ label: 'RT', order: 0 }],
      benefits: [],
      order: 1,
      recommended: false,
      active: true,
      country: { code: 'CO' },
    },
    // A valid plan to confirm the list still renders
    {
      documentId: 'plan-valid-currency',
      name: 'Plan Válido',
      shortDescription: 'Moneda correcta',
      basePrice: 900000,
      currency: 'COP',
      coverages: [{ label: 'RT', order: 0 }],
      benefits: [],
      order: 2,
      recommended: false,
      active: true,
      country: { code: 'CO' },
    },
  ],
};
