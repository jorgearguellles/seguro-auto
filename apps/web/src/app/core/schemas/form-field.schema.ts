/**
 * Zod schema for Strapi form-field response.
 * Uses discriminatedUnion by `type` for precise inference (ADR-006).
 * Tolerant parsing: unknown fields are discarded + logged (AC-01.12).
 */
import { z } from 'zod';
import { logStructured } from '../logger';

// ---- Validation rules (RN-01.11, RN-01.12, ADR-004) ----

export const validationRuleSchema = z.enum([
  'required',
  'min',
  'max',
  'minLength',
  'maxLength',
  'pattern',
  'rut',
  'cedula_co',
  'placa_co',
  'patente_cl',
  'mayor_edad',
  'anio_vehiculo',
]);

export type ValidationRule = z.infer<typeof validationRuleSchema>;

const paramsByRule: Record<ValidationRule, z.ZodTypeAny> = {
  required: z.object({}).passthrough().optional(),
  min: z.object({ value: z.number() }),
  max: z.object({ value: z.number() }),
  minLength: z.object({ value: z.number().int().nonnegative() }),
  maxLength: z.object({ value: z.number().int().nonnegative() }),
  pattern: z.object({ regex: z.string().min(1) }),
  rut: z.object({}).passthrough().optional(),
  cedula_co: z.object({}).passthrough().optional(),
  placa_co: z.object({}).passthrough().optional(),
  patente_cl: z.object({}).passthrough().optional(),
  mayor_edad: z.object({}).passthrough().optional(),
  anio_vehiculo: z.object({}).passthrough().optional(),
};

export interface ParsedValidation {
  rule: ValidationRule;
  params: unknown;
  errorMessage?: string;
}

function sanitizeValidations(raw: unknown[], fieldDocumentId: string): ParsedValidation[] {
  const out: ParsedValidation[] = [];

  for (const entry of raw) {
    const base = z
      .object({
        rule: z.unknown(),
        params: z.unknown().optional(),
        errorMessage: z.string().optional().nullable(),
      })
      .safeParse(entry);

    if (!base.success) {
      logStructured('strapi.formFields.validationDiscarded', { fieldDocumentId, reason: 'shape' });
      continue;
    }

    const ruleParsed = validationRuleSchema.safeParse(base.data.rule);
    if (!ruleParsed.success) {
      logStructured('strapi.formFields.validationDiscarded', {
        fieldDocumentId,
        rule: base.data.rule,
        reason: 'unknownRule',
      });
      continue;
    }

    const paramsSchema = paramsByRule[ruleParsed.data];
    const paramsParsed = paramsSchema.safeParse(base.data.params ?? {});
    if (!paramsParsed.success) {
      logStructured('strapi.formFields.validationDiscarded', {
        fieldDocumentId,
        rule: ruleParsed.data,
        reason: 'invalidParams',
      });
      continue;
    }

    out.push({
      rule: ruleParsed.data,
      params: paramsParsed.data,
      errorMessage: base.data.errorMessage ?? undefined,
    });
  }

  return out;
}

// ---- Field option (for select type) ----

export const optionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  order: z.number().int().default(0),
});

export type FieldOption = z.infer<typeof optionSchema>;

// ---- Base schema shared by all field types ----

const fieldBaseSchema = z.object({
  documentId: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean(),
  /** Section the field belongs to — used by SummaryComponent to split blocks (F-03-1.3, RN-03.1). */
  section: z.enum(['applicant', 'vehicle']).optional().nullable(),
  helpText: z.string().optional().nullable(),
  errorMessage: z.string().min(1),
  order: z.number().int(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional().nullable(),
  autocomplete: z.string().optional().nullable(),
  // validations parsed element-by-element in parseFormFields
  validations: z.array(z.unknown()).optional().default([]),
});

// ---- Discriminated union by type (RN-01.10, ADR-006) ----

const textFieldSchema = fieldBaseSchema.extend({ type: z.literal('text') });
const numberFieldSchema = fieldBaseSchema.extend({ type: z.literal('number') });
const dateFieldSchema = fieldBaseSchema.extend({ type: z.literal('date') });
const checkboxFieldSchema = fieldBaseSchema.extend({ type: z.literal('checkbox') });
// select requires at least 1 option (AC-01.8)
const selectFieldSchema = fieldBaseSchema.extend({
  type: z.literal('select'),
  options: z.array(optionSchema).min(1),
});

export const formFieldSchema = z.discriminatedUnion('type', [
  textFieldSchema,
  numberFieldSchema,
  dateFieldSchema,
  checkboxFieldSchema,
  selectFieldSchema,
]);

type RawFormField = z.infer<typeof formFieldSchema>;

/**
 * FormField is the domain type used by the renderer and form-builder.
 * validations is re-typed to ParsedValidation[] after sanitization.
 * Uses a mapped type over each variant to preserve the discriminated union
 * so TypeScript can narrow f.options after `if (f.type !== 'select')`.
 */
export type FormField = {
  [K in RawFormField['type']]: Omit<Extract<RawFormField, { type: K }>, 'validations'> & {
    validations: ParsedValidation[];
  };
}[RawFormField['type']];

// ---- Tolerant top-level parser (AC-01.12) ----

const envelopeSchema = z.object({
  data: z.array(z.unknown()),
});

/**
 * parseFormFields — parses Strapi envelope tolerantly.
 * - Invalid envelope → returns [] and logs.
 * - Each item is safeParsed individually; failures → log + skip (AC-01.12).
 * - Result is sorted by `order` ascending (AC-01.1).
 * - Only published items are returned (Strapi query uses publicationState=live — AC-01.15).
 */
export function parseFormFields(raw: unknown): FormField[] {
  const envelopeResult = envelopeSchema.safeParse(raw);
  if (!envelopeResult.success) {
    logStructured('strapi.formFields.envelopeInvalid', {
      issues: envelopeResult.error.issues,
    });
    return [];
  }

  const fields: FormField[] = [];

  for (const item of envelopeResult.data.data) {
    const result = formFieldSchema.safeParse(item);
    if (!result.success) {
      const documentId =
        (item as { documentId?: string } | null)?.documentId ?? 'unknown';
      logStructured('strapi.formFields.fieldDiscarded', {
        documentId,
        issues: result.error.issues.map((i) => ({
          path: i.path,
          code: i.code,
          message: i.message,
        })),
      });
      continue;
    }

    const sanitizedValidations = sanitizeValidations(
      result.data.validations,
      result.data.documentId,
    );

    fields.push({
      ...result.data,
      validations: sanitizedValidations,
    } as FormField);
  }

  return fields.sort((a, b) => a.order - b.order);
}
