/**
 * Additional unit tests for form-field.schema.ts edge cases.
 * AC-01.11 — empty array response is treated as "no fields".
 * AC-01.15 — only published (live) fields are consumed; draft filtering
 *            is enforced by Strapi query (publicationState=live), so from
 *            the front's perspective the parsed result never includes draft
 *            fields; we verify the schema does not add drafts via envelope.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseFormFields } from './form-field.schema';
import * as logger from '../logger';

const baseField = {
  documentId: 'doc1',
  key: 'fullName',
  label: 'Nombre completo',
  type: 'text',
  required: true,
  helpText: null,
  errorMessage: 'Campo requerido',
  order: 1,
  defaultValue: null,
  autocomplete: null,
  validations: [],
};

describe('AC-01.11 parseFormFields — empty data array', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'logStructured').mockImplementation(() => undefined);
  });

  it('AC-01.11 returns empty array when Strapi sends { data: [] }', () => {
    const result = parseFormFields({ data: [] });
    expect(result).toEqual([]);
  });

  it('AC-01.11 does not log when envelope is valid but data is empty', () => {
    parseFormFields({ data: [] });
    expect(logger.logStructured).not.toHaveBeenCalled();
  });

  it('AC-01.11 returns empty array for null envelope', () => {
    const result = parseFormFields(null);
    expect(result).toEqual([]);
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.formFields.envelopeInvalid',
      expect.any(Object),
    );
  });

  it('AC-01.11 returns empty array for undefined envelope', () => {
    expect(parseFormFields(undefined)).toEqual([]);
  });

  it('AC-01.11 returns empty array when data is not an array', () => {
    expect(parseFormFields({ data: 'not-an-array' })).toEqual([]);
    expect(logger.logStructured).toHaveBeenCalled();
  });
});

describe('AC-01.15 parseFormFields — only published fields consumed', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'logStructured').mockImplementation(() => undefined);
  });

  /**
   * AC-01.15: Strapi's publicationState=live filter means only published
   * documents reach the client. The front-end schema has no "publishedAt"
   * awareness — it trusts Strapi to filter. We verify the front does NOT
   * add a publishedAt field to the envelope schema (i.e., a field that
   * happens to have publishedAt=null still gets parsed if it passes the
   * field schema, because Strapi guarantees only live docs are returned).
   * What we CAN test: a field object missing required fields (which a draft
   * might have) is discarded by the schema.
   */
  it('AC-01.15 field missing required "label" is discarded (incomplete draft)', () => {
    const incompleteField = { ...baseField, label: '' }; // empty label fails z.string().min(1)
    const result = parseFormFields({ data: [incompleteField] });
    expect(result).toEqual([]);
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.formFields.fieldDiscarded',
      expect.objectContaining({ documentId: 'doc1' }),
    );
  });

  it('AC-01.15 field missing required "errorMessage" is discarded', () => {
    const noErrorMsg = { ...baseField, errorMessage: '' };
    const result = parseFormFields({ data: [noErrorMsg] });
    expect(result).toEqual([]);
  });

  it('AC-01.15 field missing required "documentId" is discarded', () => {
    const noDocId = { ...baseField, documentId: '' };
    const result = parseFormFields({ data: [noDocId] });
    expect(result).toEqual([]);
  });

  it('AC-01.15 valid published field is included', () => {
    const result = parseFormFields({ data: [baseField] });
    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe('doc1');
  });

  it('AC-01.15 mix of valid and incomplete fields: only valid ones appear', () => {
    const incompleteField = { ...baseField, documentId: 'doc2', label: '' };
    const result = parseFormFields({ data: [baseField, incompleteField] });
    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe('doc1');
  });
});

describe('AC-01.12 parseFormFields — unknown type discarded, rest normalized', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'logStructured').mockImplementation(() => undefined);
  });

  it('AC-01.12 "slider" type is not in the enum and gets discarded', () => {
    const sliderField = { ...baseField, documentId: 'docSlider', type: 'slider' };
    const result = parseFormFields({ data: [baseField, sliderField] });
    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe('doc1');
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.formFields.fieldDiscarded',
      expect.objectContaining({ documentId: 'docSlider' }),
    );
  });

  it('AC-01.12 "range" type is discarded', () => {
    const rangeField = { ...baseField, documentId: 'docRange', type: 'range' };
    expect(parseFormFields({ data: [rangeField] })).toEqual([]);
  });

  it('AC-01.12 "file" type is discarded', () => {
    const fileField = { ...baseField, documentId: 'docFile', type: 'file' };
    expect(parseFormFields({ data: [fileField] })).toEqual([]);
  });

  it('AC-01.12 all 5 valid types are accepted', () => {
    const textField = { ...baseField, documentId: 'd1', type: 'text', order: 1 };
    const numberField = { ...baseField, documentId: 'd2', type: 'number', order: 2 };
    const dateField = { ...baseField, documentId: 'd3', type: 'date', order: 3 };
    const checkboxField = { ...baseField, documentId: 'd4', type: 'checkbox', order: 4, required: false };
    const selectField = {
      ...baseField,
      documentId: 'd5',
      type: 'select',
      order: 5,
      options: [{ label: 'Toyota', value: 'toyota', order: 1 }],
    };
    const result = parseFormFields({
      data: [textField, numberField, dateField, checkboxField, selectField],
    });
    expect(result).toHaveLength(5);
    expect(result.map((f) => f.type)).toEqual(['text', 'number', 'date', 'checkbox', 'select']);
  });

  it('AC-01.12 select type requires at least 1 option — empty options discarded', () => {
    const noOptions = {
      ...baseField,
      documentId: 'docNoOpts',
      type: 'select',
      options: [],
    };
    expect(parseFormFields({ data: [noOptions] })).toEqual([]);
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.formFields.fieldDiscarded',
      expect.objectContaining({ documentId: 'docNoOpts' }),
    );
  });
});
