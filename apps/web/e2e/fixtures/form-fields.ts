/**
 * Reusable mock payloads for Strapi form-fields responses.
 * All data is fictional (RUTs, cédulas, plates follow real format rules).
 */

/** Minimal valid CO fields for most tests. */
export const CO_FIELDS_RESPONSE = {
  data: [
    {
      documentId: 'co-doc-name',
      key: 'fullName',
      label: 'Nombre completo',
      type: 'text',
      required: true,
      helpText: 'Tal como aparece en su cédula',
      errorMessage: 'El nombre es obligatorio',
      order: 1,
      defaultValue: null,
      autocomplete: 'name',
      validations: [],
    },
    {
      documentId: 'co-doc-cedula',
      key: 'documentNumber',
      label: 'Número de cédula',
      type: 'text',
      required: true,
      helpText: null,
      errorMessage: 'Cédula inválida (6–10 dígitos)',
      order: 2,
      defaultValue: null,
      autocomplete: null,
      validations: [{ rule: 'cedula_co', params: {} }],
    },
    {
      documentId: 'co-doc-plate',
      key: 'plate',
      label: 'Placa del vehículo',
      type: 'text',
      required: true,
      helpText: null,
      errorMessage: 'Placa inválida (ej. ABC123)',
      order: 3,
      defaultValue: null,
      autocomplete: null,
      validations: [{ rule: 'placa_co', params: {} }],
    },
    {
      documentId: 'co-doc-year',
      key: 'vehicleYear',
      label: 'Año del vehículo',
      type: 'number',
      required: true,
      helpText: null,
      errorMessage: 'Año fuera de rango permitido',
      order: 4,
      defaultValue: null,
      autocomplete: null,
      validations: [{ rule: 'anio_vehiculo', params: {} }],
    },
    {
      documentId: 'co-doc-brand',
      key: 'brand',
      label: 'Marca del vehículo',
      type: 'select',
      required: true,
      helpText: null,
      errorMessage: 'Seleccione una marca',
      order: 5,
      defaultValue: null,
      autocomplete: null,
      validations: [],
      options: [
        { label: 'Toyota', value: 'toyota', order: 1 },
        { label: 'Renault', value: 'renault', order: 2 },
        { label: 'Chevrolet', value: 'chevrolet', order: 3 },
      ],
    },
  ],
};

/** Minimal valid CL fields for country-switch tests. */
export const CL_FIELDS_RESPONSE = {
  data: [
    {
      documentId: 'cl-doc-name',
      key: 'fullName',
      label: 'Nombre completo',
      type: 'text',
      required: true,
      helpText: null,
      errorMessage: 'El nombre es obligatorio',
      order: 1,
      defaultValue: null,
      autocomplete: 'name',
      validations: [],
    },
    {
      documentId: 'cl-doc-rut',
      key: 'rut',
      label: 'RUT',
      type: 'text',
      required: true,
      helpText: 'Ej. 12345678-5',
      errorMessage: 'RUT inválido',
      order: 2,
      defaultValue: null,
      autocomplete: null,
      validations: [{ rule: 'rut', params: {} }],
    },
    {
      documentId: 'cl-doc-plate',
      key: 'plate',
      label: 'Patente del vehículo',
      type: 'text',
      required: true,
      helpText: null,
      errorMessage: 'Patente inválida (ej. BB1234)',
      order: 3,
      defaultValue: null,
      autocomplete: null,
      validations: [{ rule: 'patente_cl', params: {} }],
    },
  ],
};

/** CO fields plus one extra field (simulates AC-01.4: new Strapi field). */
export const CO_FIELDS_WITH_EXTRA = {
  data: [
    ...CO_FIELDS_RESPONSE.data,
    {
      documentId: 'co-doc-extra',
      key: 'city',
      label: 'Ciudad de residencia',
      type: 'text',
      required: false,
      helpText: 'Ciudad donde reside actualmente',
      errorMessage: 'Campo inválido',
      order: 6,
      defaultValue: null,
      autocomplete: null,
      validations: [],
    },
  ],
};

/** Empty response for AC-01.11. */
export const EMPTY_FIELDS_RESPONSE = { data: [] };
