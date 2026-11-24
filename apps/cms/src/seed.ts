/**
 * Idempotent seed for CO and CL.
 * [AC-01.1] Fields per country, ordered.
 * [AC-01.5] Only published entries consumed by the front.
 * [AC-01.8] Select options populated from Strapi.
 * [AC-01.15] Draft fields are not exposed by REST.
 * [AC-02.1] Plans per country published and active.
 * [AC-02.2] basePrice as integer (COP/CLP use no decimals).
 * [AC-02.4] recommended boolean per plan.
 * [ADR-007] vehicleYear key contract — pricing.ts reads applicant.vehicleYear.
 *
 * Key natural:
 *   country    → code
 *   form-field → key (unique by DB constraint)
 *   plan       → name + country.code (composite natural key for idempotency)
 *
 * Pattern: findFirst({ filters }) → if not found, create({ data, status: 'published' })
 * Never overwrites entries already modified by the business team in the admin.
 *
 * NOTE (ADR-007 §VEHICLE_YEAR_FIELD_KEY): the vehicleYear form-field key must be
 * exactly 'vehicleYear' for both CO and CL. The unique constraint on form-field.key
 * prevents two entries with the same key; this requires either a unique-per-country
 * scoping or relaxing the global unique. See handoff pending question P-02.1.
 */

import type { Core } from '@strapi/strapi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationRule {
  rule:
    | 'required'
    | 'min'
    | 'max'
    | 'minLength'
    | 'maxLength'
    | 'pattern'
    | 'rut'
    | 'cedula_co'
    | 'placa_co'
    | 'patente_cl'
    | 'anio_vehiculo'
    | 'mayor_edad';
  params?: Record<string, unknown> | null;
  errorMessage?: string;
}

interface FieldOption {
  value: string;
  label: string;
  order: number;
}

interface FormFieldSeed {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'checkbox';
  section: 'applicant' | 'vehicle';
  required: boolean;
  helpText?: string;
  errorMessage: string;
  order: number;
  defaultValue?: string;
  autocomplete?: string;
  options?: FieldOption[];
  validations?: ValidationRule[];
}

// ---------------------------------------------------------------------------
// Country data
// ---------------------------------------------------------------------------
//
// SECURITY NOTE (F-01-1.5 / ADR-003 D5):
// country.termsAndConditions is type 'blocks' (Strapi rich text).
// The front-end MUST render it with a safe blocks renderer — never innerHTML
// without DomSanitizer. Renderer to be specified and reviewed in the US-03 ADR.
// ---------------------------------------------------------------------------

const COUNTRIES = [
  {
    code: 'CO' as const,
    name: 'Colombia',
    locale: 'es-CO',
    currency: 'COP' as const,
  },
  {
    code: 'CL' as const,
    name: 'Chile',
    locale: 'es-CL',
    currency: 'CLP' as const,
  },
] as const;

// ---------------------------------------------------------------------------
// Form fields — Colombia (CO)
// ---------------------------------------------------------------------------

const FIELDS_CO: FormFieldSeed[] = [
  {
    key: 'firstName_CO',
    label: 'Nombres',
    type: 'text',
    section: 'applicant',
    required: true,
    helpText: 'Ingresa tus nombres tal como aparecen en tu documento.',
    errorMessage: 'El nombre es obligatorio.',
    order: 1,
    autocomplete: 'given-name',
  },
  {
    key: 'lastName_CO',
    label: 'Apellidos',
    type: 'text',
    section: 'applicant',
    required: true,
    helpText: 'Ingresa tus apellidos tal como aparecen en tu documento.',
    errorMessage: 'El apellido es obligatorio.',
    order: 2,
    autocomplete: 'family-name',
  },
  {
    key: 'documentType_CO',
    label: 'Tipo de documento',
    type: 'select',
    section: 'applicant',
    required: true,
    errorMessage: 'Selecciona un tipo de documento.',
    order: 3,
    options: [
      { value: 'CC', label: 'Cédula de Ciudadanía', order: 1 },
      { value: 'CE', label: 'Cédula de Extranjería', order: 2 },
    ],
  },
  {
    key: 'documentNumber_CO',
    label: 'Número de documento',
    type: 'text',
    section: 'applicant',
    required: true,
    helpText: 'Solo números, sin puntos ni espacios.',
    errorMessage: 'Número de cédula inválido (6 a 10 dígitos).',
    order: 4,
    autocomplete: 'off',
    validations: [
      {
        rule: 'cedula_co',
        errorMessage: 'El número de cédula debe tener entre 6 y 10 dígitos.',
      },
    ],
  },
  {
    key: 'birthDate_CO',
    label: 'Fecha de nacimiento',
    type: 'date',
    section: 'applicant',
    required: true,
    helpText: 'Debes ser mayor de edad para cotizar.',
    errorMessage: 'Debes tener al menos 18 años.',
    order: 5,
    autocomplete: 'bday',
    validations: [
      {
        rule: 'mayor_edad',
        params: { value: 18 },
        errorMessage: 'Debes tener al menos 18 años para cotizar.',
      },
    ],
  },
  {
    key: 'plate_CO',
    label: 'Placa del vehículo',
    type: 'text',
    section: 'vehicle',
    required: true,
    helpText: 'Ejemplo: ABC123 o ABC12D.',
    errorMessage: 'Placa inválida. Usa el formato ABC123 o ABC12D.',
    order: 6,
    autocomplete: 'off',
    validations: [
      {
        rule: 'placa_co',
        errorMessage: 'Formato de placa inválido. Debe ser ABC123 o ABC12D.',
      },
    ],
  },
  {
    // ADR-007 §VEHICLE_YEAR_FIELD_KEY: key must be exactly 'vehicleYear'
    // so pricing.ts can read applicant.vehicleYear from WizardStore (G-02.5, RN-02.4).
    key: 'vehicleYear',
    label: 'Año del vehículo',
    type: 'number',
    section: 'vehicle',
    required: true,
    helpText: 'Año de fabricación entre el año actual y los últimos 20 años.',
    errorMessage: 'El año del vehículo está fuera del rango permitido.',
    order: 7,
    validations: [
      {
        rule: 'anio_vehiculo',
        errorMessage: 'El año debe estar entre los últimos 20 años y el próximo año.',
      },
    ],
  },
  {
    key: 'vehicleBrand_CO',
    label: 'Marca del vehículo',
    type: 'select',
    section: 'vehicle',
    required: true,
    errorMessage: 'Selecciona una marca.',
    order: 8,
    options: [
      { value: 'chevrolet', label: 'Chevrolet', order: 1 },
      { value: 'renault', label: 'Renault', order: 2 },
      { value: 'mazda', label: 'Mazda', order: 3 },
      { value: 'toyota', label: 'Toyota', order: 4 },
      { value: 'kia', label: 'Kia', order: 5 },
      { value: 'nissan', label: 'Nissan', order: 6 },
      { value: 'ford', label: 'Ford', order: 7 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Form fields — Chile (CL)
// ---------------------------------------------------------------------------

const FIELDS_CL: FormFieldSeed[] = [
  {
    key: 'firstName_CL',
    label: 'Nombres',
    type: 'text',
    section: 'applicant',
    required: true,
    helpText: 'Ingresa tus nombres tal como aparecen en tu RUT.',
    errorMessage: 'El nombre es obligatorio.',
    order: 1,
    autocomplete: 'given-name',
  },
  {
    key: 'lastName_CL',
    label: 'Apellidos',
    type: 'text',
    section: 'applicant',
    required: true,
    helpText: 'Ingresa tus apellidos tal como aparecen en tu RUT.',
    errorMessage: 'El apellido es obligatorio.',
    order: 2,
    autocomplete: 'family-name',
  },
  {
    key: 'rut_CL',
    label: 'RUT',
    type: 'text',
    section: 'applicant',
    required: true,
    helpText: 'Ejemplo: 12345678-9 o 12345678-K.',
    errorMessage: 'RUT inválido.',
    order: 3,
    autocomplete: 'off',
    validations: [
      {
        rule: 'rut',
        errorMessage: 'RUT inválido. Verifica el dígito verificador.',
      },
    ],
  },
  {
    key: 'birthDate_CL',
    label: 'Fecha de nacimiento',
    type: 'date',
    section: 'applicant',
    required: true,
    helpText: 'Debes ser mayor de edad para cotizar.',
    errorMessage: 'Debes tener al menos 18 años.',
    order: 4,
    autocomplete: 'bday',
    validations: [
      {
        rule: 'mayor_edad',
        params: { value: 18 },
        errorMessage: 'Debes tener al menos 18 años para cotizar.',
      },
    ],
  },
  {
    key: 'plate_CL',
    label: 'Patente del vehículo',
    type: 'text',
    section: 'vehicle',
    required: true,
    helpText: 'Ejemplo: AB1234 (pre-2007) o ABCD12 (post-2007).',
    errorMessage: 'Patente inválida.',
    order: 5,
    autocomplete: 'off',
    validations: [
      {
        rule: 'patente_cl',
        errorMessage: 'Formato de patente inválido. Usa AB1234 o ABCD12.',
      },
    ],
  },
  {
    // ADR-007 §VEHICLE_YEAR_FIELD_KEY: key must be exactly 'vehicleYear'
    // so pricing.ts can read applicant.vehicleYear from WizardStore (G-02.5, RN-02.4).
    key: 'vehicleYear',
    label: 'Año del vehículo',
    type: 'number',
    section: 'vehicle',
    required: true,
    helpText: 'Año de fabricación entre el año actual y los últimos 20 años.',
    errorMessage: 'El año del vehículo está fuera del rango permitido.',
    order: 6,
    validations: [
      {
        rule: 'anio_vehiculo',
        errorMessage: 'El año debe estar entre los últimos 20 años y el próximo año.',
      },
    ],
  },
  {
    key: 'vehicleBrand_CL',
    label: 'Marca del vehículo',
    type: 'select',
    section: 'vehicle',
    required: true,
    errorMessage: 'Selecciona una marca.',
    order: 7,
    options: [
      { value: 'chevrolet', label: 'Chevrolet', order: 1 },
      { value: 'suzuki', label: 'Suzuki', order: 2 },
      { value: 'hyundai', label: 'Hyundai', order: 3 },
      { value: 'toyota', label: 'Toyota', order: 4 },
      { value: 'kia', label: 'Kia', order: 5 },
      { value: 'nissan', label: 'Nissan', order: 6 },
      { value: 'mazda', label: 'Mazda', order: 7 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Plan data — Colombia (CO)
// ---------------------------------------------------------------------------

interface PlanCoverage {
  label: string;
  description?: string;
  order: number;
}

interface PlanBenefit {
  label: string;
  description?: string;
  order: number;
}

interface PlanSeed {
  name: string;
  shortDescription: string;
  basePrice: number;
  currency: 'COP' | 'CLP';
  coverages: PlanCoverage[];
  benefits: PlanBenefit[];
  order: number;
  recommended: boolean;
  active: boolean;
}

const PLANS_CO: PlanSeed[] = [
  {
    name: 'Básico',
    shortDescription: 'Protección esencial para tu vehículo en Colombia.',
    basePrice: 800000,
    currency: 'COP',
    coverages: [
      { label: 'Responsabilidad Civil Extracontractual', description: 'Cubre daños a terceros por accidente de tránsito.', order: 1 },
      { label: 'Daños parciales por colisión', description: 'Repara daños menores causados por choque.', order: 2 },
    ],
    benefits: [
      { label: 'Asistencia vial 24/7', description: 'Grúa y auxilio mecánico en cualquier punto del país.', order: 1 },
      { label: 'Reposición de llanta', description: 'Cambio de llanta en carretera sin costo adicional.', order: 2 },
    ],
    order: 1,
    recommended: false,
    active: true,
  },
  {
    name: 'Estándar',
    shortDescription: 'Cobertura amplia para conductores frecuentes en Colombia.',
    basePrice: 1200000,
    currency: 'COP',
    coverages: [
      { label: 'Responsabilidad Civil Extracontractual', description: 'Cubre daños a terceros por accidente de tránsito.', order: 1 },
      { label: 'Daños totales y parciales por colisión', description: 'Repara o repone el vehículo según el nivel del daño.', order: 2 },
    ],
    benefits: [
      { label: 'Asistencia vial 24/7', description: 'Grúa y auxilio mecánico en cualquier punto del país.', order: 1 },
      { label: 'Vehículo de reemplazo', description: 'Automóvil sustituto por hasta 10 días hábiles.', order: 2 },
    ],
    order: 2,
    recommended: true,
    active: true,
  },
  {
    name: 'Premium',
    shortDescription: 'Protección total con beneficios exclusivos en Colombia.',
    basePrice: 1800000,
    currency: 'COP',
    coverages: [
      { label: 'Cobertura todo riesgo', description: 'Protege contra robo, daños parciales, totales y fenómenos naturales.', order: 1 },
      { label: 'Responsabilidad Civil ampliada', description: 'Mayor límite de indemnización a terceros.', order: 2 },
    ],
    benefits: [
      { label: 'Asistencia vial premium 24/7', description: 'Grúa, auxilio mecánico y cerrajería sin límite.', order: 1 },
      { label: 'Vehículo de reemplazo extendido', description: 'Automóvil sustituto por hasta 20 días hábiles.', order: 2 },
    ],
    order: 3,
    recommended: false,
    active: true,
  },
];

// ---------------------------------------------------------------------------
// Plan data — Chile (CL)
// ---------------------------------------------------------------------------

const PLANS_CL: PlanSeed[] = [
  {
    name: 'Básico',
    shortDescription: 'Protección esencial para tu vehículo en Chile.',
    basePrice: 180000,
    currency: 'CLP',
    coverages: [
      { label: 'Responsabilidad Civil', description: 'Cubre daños a terceros según la Ley de Tránsito chilena.', order: 1 },
      { label: 'Daños parciales por colisión', description: 'Repara daños menores causados por choque.', order: 2 },
    ],
    benefits: [
      { label: 'Asistencia en ruta 24/7', description: 'Grúa y auxilio mecánico en todo Chile continental.', order: 1 },
      { label: 'Reposición de neumático', description: 'Cambio de neumático en carretera sin costo adicional.', order: 2 },
    ],
    order: 1,
    recommended: false,
    active: true,
  },
  {
    name: 'Estándar',
    shortDescription: 'Cobertura amplia para conductores frecuentes en Chile.',
    basePrice: 280000,
    currency: 'CLP',
    coverages: [
      { label: 'Responsabilidad Civil ampliada', description: 'Mayor límite de indemnización a terceros según normativa.', order: 1 },
      { label: 'Daños totales y parciales por colisión', description: 'Repara o repone el vehículo según nivel del daño.', order: 2 },
    ],
    benefits: [
      { label: 'Asistencia en ruta 24/7', description: 'Grúa y auxilio mecánico en todo Chile continental.', order: 1 },
      { label: 'Auto de reemplazo', description: 'Vehículo sustituto por hasta 10 días hábiles.', order: 2 },
    ],
    order: 2,
    recommended: true,
    active: true,
  },
  {
    name: 'Premium',
    shortDescription: 'Protección total con beneficios exclusivos en Chile.',
    basePrice: 420000,
    currency: 'CLP',
    coverages: [
      { label: 'Cobertura todo riesgo', description: 'Protege contra robo, daños parciales, totales y eventos naturales.', order: 1 },
      { label: 'Responsabilidad Civil premium', description: 'El mayor límite de indemnización disponible en el plan.', order: 2 },
    ],
    benefits: [
      { label: 'Asistencia premium en ruta 24/7', description: 'Grúa, auxilio mecánico y cerrajería sin límite de llamadas.', order: 1 },
      { label: 'Auto de reemplazo extendido', description: 'Vehículo sustituto por hasta 20 días hábiles.', order: 2 },
    ],
    order: 3,
    recommended: false,
    active: true,
  },
];

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedCountries(strapi: Core.Strapi): Promise<Map<string, string>> {
  const countryDocIds = new Map<string, string>();

  for (const country of COUNTRIES) {
    const existing = await strapi.documents('api::country.country').findFirst({
      filters: { code: { $eq: country.code } },
    });

    if (existing) {
      strapi.log.info(`[seed] country ${country.code} already exists (documentId: ${existing.documentId}), skipping.`);
      countryDocIds.set(country.code, existing.documentId);
    } else {
      const created = await strapi.documents('api::country.country').create({
        data: {
          code: country.code,
          name: country.name,
          locale: country.locale,
          currency: country.currency,
        },
      });
      strapi.log.info(`[seed] country ${country.code} created (documentId: ${created.documentId}).`);
      countryDocIds.set(country.code, created.documentId);
    }
  }

  return countryDocIds;
}

async function seedFormFields(
  strapi: Core.Strapi,
  fields: FormFieldSeed[],
  countryDocId: string,
  countryCode: string
): Promise<void> {
  for (const field of fields) {
    // Idempotency check by key + country (ADR-007: vehicleYear is shared across countries).
    const existing = await strapi.documents('api::form-field.form-field').findFirst({
      filters: { key: { $eq: field.key }, country: { $eq: countryDocId } },
      status: 'published',
    });

    if (existing) {
      strapi.log.info(`[seed] form-field "${field.key}" (${countryCode}) already exists, skipping.`);
      continue;
    }

    // Also check drafts to avoid creating a published duplicate over a draft
    const existingDraft = await strapi.documents('api::form-field.form-field').findFirst({
      filters: { key: { $eq: field.key }, country: { $eq: countryDocId } },
      status: 'draft',
    });

    if (existingDraft) {
      strapi.log.info(`[seed] form-field "${field.key}" (${countryCode}) exists as draft, skipping.`);
      continue;
    }

    const data: Record<string, unknown> = {
      key: field.key,
      label: field.label,
      type: field.type,
      section: field.section,
      required: field.required,
      errorMessage: field.errorMessage,
      order: field.order,
      country: countryDocId,
    };

    if (field.helpText !== undefined) {
      data['helpText'] = field.helpText;
    }
    if (field.defaultValue !== undefined) {
      data['defaultValue'] = field.defaultValue;
    }
    if (field.autocomplete !== undefined) {
      data['autocomplete'] = field.autocomplete;
    }
    if (field.options !== undefined && field.options.length > 0) {
      data['options'] = field.options;
    }
    if (field.validations !== undefined && field.validations.length > 0) {
      data['validations'] = field.validations;
    }

    await strapi.documents('api::form-field.form-field').create({
      data,
      status: 'published',
    });

    strapi.log.info(`[seed] form-field "${field.key}" (${countryCode}) created and published.`);
  }
}

async function seedPlans(
  strapi: Core.Strapi,
  plans: PlanSeed[],
  countryDocId: string,
  countryCode: string
): Promise<void> {
  for (const plan of plans) {
    // Idempotency: find by name + country (ADR-007 — composite natural key).
    const existing = await strapi.documents('api::plan.plan').findFirst({
      filters: {
        name: { $eq: plan.name },
        country: { $eq: countryDocId },
      },
      status: 'published',
    });

    if (existing) {
      strapi.log.info(`[seed] plan "${plan.name}" (${countryCode}) already published, skipping.`);
      continue;
    }

    // Also check drafts.
    const existingDraft = await strapi.documents('api::plan.plan').findFirst({
      filters: {
        name: { $eq: plan.name },
        country: { $eq: countryDocId },
      },
      status: 'draft',
    });

    if (existingDraft) {
      strapi.log.info(`[seed] plan "${plan.name}" (${countryCode}) exists as draft, skipping.`);
      continue;
    }

    const created = await strapi.documents('api::plan.plan').create({
      data: {
        name: plan.name,
        shortDescription: plan.shortDescription,
        basePrice: plan.basePrice,
        currency: plan.currency,
        coverages: plan.coverages,
        benefits: plan.benefits,
        order: plan.order,
        recommended: plan.recommended,
        active: plan.active,
        country: countryDocId,
      },
    });

    await strapi.documents('api::plan.plan').publish({ documentId: created.documentId });

    strapi.log.info(`[seed] plan "${plan.name}" (${countryCode}) created and published (documentId: ${created.documentId}).`);
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function seed(strapi: Core.Strapi): Promise<void> {
  strapi.log.info('[seed] Starting idempotent seed for CO and CL...');

  const countryDocIds = await seedCountries(strapi);

  const coDocId = countryDocIds.get('CO');
  const clDocId = countryDocIds.get('CL');

  if (!coDocId) {
    strapi.log.error('[seed] Could not find or create CO country. Skipping CO form fields and plans.');
  } else {
    await seedFormFields(strapi, FIELDS_CO, coDocId, 'CO');
    await seedPlans(strapi, PLANS_CO, coDocId, 'CO');
  }

  if (!clDocId) {
    strapi.log.error('[seed] Could not find or create CL country. Skipping CL form fields and plans.');
  } else {
    await seedFormFields(strapi, FIELDS_CL, clDocId, 'CL');
    await seedPlans(strapi, PLANS_CL, clDocId, 'CL');
  }

  strapi.log.info('[seed] Seed complete.');
}
