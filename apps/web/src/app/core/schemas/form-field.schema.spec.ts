/**
 * Tests for form-field.schema.ts (ADR-006).
 * AC-01.12 — tolerant parsing; unknown types discarded + logged.
 * AC-01.8  — select without options is discarded.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseFormFields } from './form-field.schema';
import * as logger from '../logger';

const validTextField = {
  documentId: 'doc1',
  key: 'fullName',
  label: 'Nombre',
  type: 'text',
  required: true,
  helpText: null,
  errorMessage: 'Campo requerido',
  order: 1,
  defaultValue: null,
  autocomplete: null,
  validations: [],
};

const validSelectField = {
  documentId: 'doc2',
  key: 'brand',
  label: 'Marca',
  type: 'select',
  required: false,
  helpText: null,
  errorMessage: 'Selecciona una marca',
  order: 2,
  defaultValue: null,
  autocomplete: null,
  validations: [],
  options: [
    { label: 'Toyota', value: 'toyota', order: 1 },
    { label: 'Ford', value: 'ford', order: 2 },
  ],
};

const unknownTypeField = {
  documentId: 'doc3',
  key: 'slider',
  label: 'Rating',
  type: 'slider', // unknown
  required: false,
  helpText: null,
  errorMessage: 'Error',
  order: 3,
  defaultValue: null,
  autocomplete: null,
  validations: [],
};

const selectWithoutOptions = {
  documentId: 'doc4',
  key: 'emptySelect',
  label: 'Empty',
  type: 'select',
  required: false,
  helpText: null,
  errorMessage: 'Error',
  order: 4,
  defaultValue: null,
  autocomplete: null,
  validations: [],
  options: [], // empty → invalid per schema
};

describe('AC-01.12 parseFormFields — tolerant parsing', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'logStructured').mockImplementation(() => undefined);
  });

  it('AC-01.12 returns empty array for invalid envelope', () => {
    const result = parseFormFields({ notData: [] });
    expect(result).toEqual([]);
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.formFields.envelopeInvalid',
      expect.any(Object),
    );
  });

  it('AC-01.12 discards field with unknown type and logs documentId', () => {
    const raw = { data: [validTextField, validSelectField, unknownTypeField] };
    const result = parseFormFields(raw);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.documentId)).not.toContain('doc3');
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.formFields.fieldDiscarded',
      expect.objectContaining({ documentId: 'doc3' }),
    );
  });

  it('AC-01.8 select without options is discarded', () => {
    const raw = { data: [validTextField, selectWithoutOptions] };
    const result = parseFormFields(raw);
    expect(result).toHaveLength(1);
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.formFields.fieldDiscarded',
      expect.objectContaining({ documentId: 'doc4' }),
    );
  });

  it('AC-01.12 valid fields are parsed and returned', () => {
    const raw = { data: [validTextField, validSelectField] };
    const result = parseFormFields(raw);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('fullName');
    expect(result[1].key).toBe('brand');
  });

  it('AC-01.1 results are sorted by order ascending', () => {
    const field3 = { ...validTextField, documentId: 'docA', key: 'z', order: 3 };
    const field1 = { ...validTextField, documentId: 'docB', key: 'a', order: 1 };
    const field2 = { ...validTextField, documentId: 'docC', key: 'm', order: 2 };
    const raw = { data: [field3, field1, field2] };
    const result = parseFormFields(raw);
    expect(result.map((f) => f.order)).toEqual([1, 2, 3]);
  });

  it('AC-01.12 unknown validation rule is discarded, field is kept', () => {
    const fieldWithBadValidation = {
      ...validTextField,
      documentId: 'doc5',
      validations: [
        { rule: 'unknownRule', params: null },
        { rule: 'required', params: {} },
      ],
    };
    const raw = { data: [fieldWithBadValidation] };
    const result = parseFormFields(raw);
    expect(result).toHaveLength(1);
    // 'required' was kept, 'unknownRule' was discarded
    expect(result[0].validations).toHaveLength(1);
    expect(result[0].validations[0].rule).toBe('required');
  });

  it('AC-01.12 returns empty array when envelope data is empty', () => {
    expect(parseFormFields({ data: [] })).toEqual([]);
  });
});
