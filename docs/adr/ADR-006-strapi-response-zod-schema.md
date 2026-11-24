---
id: ADR-006
title: Validación de respuestas de Strapi con zod — discriminated union por `type` y campos desconocidos tolerantes
status: accepted
date: 2026-11-23
deciders: Jorge Argüelles
supersedes:
related: [SPEC-01, RN-01.10, RN-01.11, AC-01.8, AC-01.12, AC-01.15]
---

# ADR-006 — Validación de respuestas de Strapi con zod — discriminated union por `type` y campos desconocidos tolerantes

## Contexto y problema

CLAUDE.md §7 obliga a validar con zod toda respuesta de Strapi antes de usarla; §2 prohíbe `any`. SPEC-01 define:

- 5 tipos cerrados de campo (RN-01.10): `text`, `number`, `select`, `date`, `checkbox`.
- Un objeto `validations` con 7 claves posibles (RN-01.11) y un `custom` restringido a un enum de 6 valores (RN-01.12); en ADR-001 este objeto se aplanó a un array de `{rule, params, errorMessage?}`.
- AC-01.12 obliga a que, si llega un `type` desconocido, el campo se **omita** del renderizado y se **loguee** con `documentId`. La app no debe romper.
- AC-01.8 obliga a que los `select` tengan `options` disponibles tras el parseo.
- AC-01.15 (consumir solo publicados) no es trabajo de zod sino de la query, pero el schema debe reflejarlo.

Hay que decidir:

1. **Qué librería** valida en runtime (zod ya está fijado por CLAUDE.md §2, pero documentamos por qué entre alternativas).
2. **Cómo** se modela la unión de tipos de campo (discriminated union vs union simple vs schema plano con narrowing manual).
3. **Qué hace** el schema ante un campo con `type` o `rule` desconocido (fallar / descartar el campo / descartar la regla).
4. **Dónde vive** el schema en el repo y cómo se integra con el cliente HTTP.

## Factores de decisión

- CLAUDE.md §7: "toda respuesta pasa por un schema zod; un tipo de campo desconocido se ignora y se registra en log, no rompe la app". Es directiva vinculante.
- AC-01.12: campo desconocido omitido + log con `documentId`.
- RN-01.10: enum cerrado para v1; agregar un tipo = nueva spec.
- Sin `any` (CLAUDE.md §2).
- El schema debe producir un tipo (`z.infer`) consumible directamente por el renderer y el `form-builder` (ADR-004).
- La inferencia debe ser **útil**: dentro de un `case 'select'`, TypeScript debe saber que `options` existe.
- Trazabilidad: `grep` del `documentId` en logs debe permitir identificar el campo descartado en Strapi.

## Opciones consideradas

1. **Opción A — zod con `z.discriminatedUnion('type', [...])` para `FormField`, parseo por elemento con `safeParse` por campo + log de los que fallan.** El array completo no se parsea con `.parse()`, sino que cada elemento del `data` de la respuesta se intenta con `safeParse`; los que fallan se descartan y se loguean con su `documentId`. El schema de `validations` es un array de uniones discriminadas por `rule`, con el mismo tratamiento tolerante.
2. **Opción B — zod con un schema "amplio" (campos todos opcionales, `type` como `z.string()`) y narrowing manual en el renderer.** No hay discriminated union; el renderer hace `switch` sobre `type` y valida ad-hoc las propiedades que necesita.
3. **Opción C — `class-transformer` + `class-validator`** (TS decorators) en lugar de zod.
4. **Opción D — Validación manual (`type guards` escritos a mano)** sin librería.

## Decisión

Opción elegida: **Opción A — zod con `discriminatedUnion` por `type` + parseo por elemento tolerante**, porque:

- `discriminatedUnion` da inferencia precisa (`FormField & { type: 'select' }` ⇒ `options` requerido) → el renderer puede usar `@switch (field.type)` sin casts.
- El parseo por elemento es la forma más directa de cumplir AC-01.12 sin perder el resto de la respuesta: `.parse()` del array completo rompería ante un elemento inválido; `safeParse` por elemento permite log + descarte individual.
- El mismo patrón aplica a `validations[]`: una regla con `rule` fuera del enum se descarta y se loguea; el resto del campo sigue válido.
- `zod` ya está en CLAUDE.md §2. Opción C y D saldrían del stack o reinventarían la rueda.

### Diseño concreto

**Ubicación:** `apps/web/src/app/core/schemas/form-field.schema.ts` (coherente con `angular-conventions` §1).

**Schema (resumido):**

```ts
import { z } from 'zod';

export const countryCodeSchema = z.enum(['CO', 'CL']);

const fieldBaseSchema = z.object({
  documentId: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean(),
  helpText: z.string().optional().nullable(),
  errorMessage: z.string().min(1),
  order: z.number().int(),
  defaultValue: z.string().optional().nullable(),
  autocomplete: z.string().optional().nullable(),
  country: z.object({ code: countryCodeSchema }),
  validations: z.array(z.unknown()).optional().default([]), // se parsea elemento-a-elemento (ver abajo)
});

const optionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  order: z.number().int().default(0),
});

const textFieldSchema      = fieldBaseSchema.extend({ type: z.literal('text') });
const numberFieldSchema    = fieldBaseSchema.extend({ type: z.literal('number') });
const dateFieldSchema      = fieldBaseSchema.extend({ type: z.literal('date') });
const checkboxFieldSchema  = fieldBaseSchema.extend({ type: z.literal('checkbox') });
const selectFieldSchema    = fieldBaseSchema.extend({
  type: z.literal('select'),
  options: z.array(optionSchema).min(1), // AC-01.8: un select sin opciones es inválido
});

export const formFieldSchema = z.discriminatedUnion('type', [
  textFieldSchema, numberFieldSchema, dateFieldSchema, checkboxFieldSchema, selectFieldSchema,
]);
export type FormField = z.infer<typeof formFieldSchema>;

// --- validations ---
const validationRuleSchema = z.enum([
  'required', 'min', 'max', 'minLength', 'maxLength', 'pattern',
  'rut', 'cedula_co', 'placa_co', 'patente_cl', 'mayor_edad', 'anio_vehiculo',
]);
const paramsByRule: Record<z.infer<typeof validationRuleSchema>, z.ZodTypeAny> = {
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
```

**Función de parseo tolerante** (la pieza crítica para AC-01.12):

```ts
export function parseFormFields(raw: unknown): FormField[] {
  const envelopeSchema = z.object({ data: z.array(z.unknown()) });
  const parsedEnvelope = envelopeSchema.safeParse(raw);
  if (!parsedEnvelope.success) {
    logStructured('strapi.formFields.envelopeInvalid', { issues: parsedEnvelope.error.issues });
    return [];
  }

  const fields: FormField[] = [];
  for (const item of parsedEnvelope.data.data) {
    const result = formFieldSchema.safeParse(item);
    if (!result.success) {
      const documentId = (item as { documentId?: string } | null)?.documentId ?? 'unknown';
      logStructured('strapi.formFields.fieldDiscarded', {
        documentId,
        issues: result.error.issues.map((i) => ({ path: i.path, code: i.code, message: i.message })),
      });
      continue;
    }
    const sanitizedValidations = sanitizeValidations(result.data.validations, result.data.documentId);
    fields.push({ ...result.data, validations: sanitizedValidations });
  }
  return fields.sort((a, b) => a.order - b.order);
}

function sanitizeValidations(raw: unknown[], fieldDocumentId: string): Array<{ rule: ValidationRule; params: unknown; errorMessage?: string }> {
  const out: Array<{ rule: ValidationRule; params: unknown; errorMessage?: string }> = [];
  for (const entry of raw) {
    const base = z.object({ rule: z.unknown(), params: z.unknown().optional(), errorMessage: z.string().optional() }).safeParse(entry);
    if (!base.success) {
      logStructured('strapi.formFields.validationDiscarded', { fieldDocumentId, reason: 'shape' });
      continue;
    }
    const ruleParsed = validationRuleSchema.safeParse(base.data.rule);
    if (!ruleParsed.success) {
      logStructured('strapi.formFields.validationDiscarded', { fieldDocumentId, rule: base.data.rule, reason: 'unknownRule' });
      continue;
    }
    const paramsSchema = paramsByRule[ruleParsed.data];
    const paramsParsed = paramsSchema.safeParse(base.data.params ?? {});
    if (!paramsParsed.success) {
      logStructured('strapi.formFields.validationDiscarded', { fieldDocumentId, rule: ruleParsed.data, reason: 'invalidParams' });
      continue;
    }
    out.push({ rule: ruleParsed.data, params: paramsParsed.data, errorMessage: base.data.errorMessage });
  }
  return out;
}
```

**Integración con HTTP:** el cliente de Strapi en `core/` llama a `/api/form-fields?...` y pasa la respuesta por `parseFormFields` antes de devolver. El tipo de retorno es `FormField[]`; no hay `unknown` escapando de `core/`.

**Logs:** `logStructured(event, payload)` escribe `console.warn` en dev y eventualmente un sink remoto en prod (no en v1). El `event` es un identificador estable para `grep`.

### Consecuencias

- ✅ Positiva: Inferencia precisa en el renderer — `@switch (field.type)` con autocomplete y narrowing correcto, sin `any` ni casts.
- ✅ Positiva: Tolerancia a datos corruptos — un campo roto no tira el formulario (AC-01.12), una regla rota no tira el campo.
- ✅ Positiva: Logs estructurados con `documentId` → operador puede abrir Strapi y corregir.
- ✅ Positiva: Reutilizable para US-02 (plans) y US-03 (country / T&C) con el mismo patrón `safeParse` por elemento.
- ⚠️ Negativa: **Tolerancia significa silencio parcial**: un error de contenido se descubre vía log, no vía rotura visible. Negocio puede publicar algo "ligeramente mal" y creer que está bien. → Mitigación: el AC-01.11 (estado vacío) cubre el caso extremo (todos descartados ⇒ formulario vacío visible). Para casos parciales, el `logStructured` es la señal; en el `README` del CMS se documenta cómo revisar logs en dev; una task futura puede ser un endpoint `/health/content` que reporte.
- ⚠️ Negativa: El schema está acoplado al shape de la respuesta REST de Strapi (`{ data: [...] }`). Si en el futuro se migra a GraphQL o se cambia el envelope, hay que ajustar `parseFormFields`. → Mitigación: la función es la **única** puerta hacia el dominio; aislar el cambio.
- ⚠️ Negativa: `discriminatedUnion` en zod requiere que **todos** los miembros compartan la misma clave discriminante. Si en v2 queremos un `type` compuesto (p. ej. `select-multi`), hay que agregar un miembro más y actualizar el renderer. Aceptable — era el objetivo del enum cerrado (RN-01.10).
- ⚠️ Negativa: `z.object({}).passthrough()` para reglas sin params permite que lleguen propiedades extra silenciosas. → Mitigación: la función final solo pasa `params` tipado al validador factory (ADR-004), que ignora propiedades extra por diseño.
- ⚠️ Negativa: Dos `safeParse` anidados (campo + cada regla) añaden costo computacional. → Mitigación: despreciable para N ≤ 50 campos y M ≤ 10 reglas por campo; medido una vez.

### Validación

- Tests unitarios (`form-field.schema.spec.ts`, Vitest):
  - `AC-01.12 discards field with unknown type and logs documentId`: fixture con 3 campos (dos válidos, uno con `type: 'slider'`) → `parseFormFields` devuelve 2 y `logStructured` recibe un evento con el `documentId` del tercero.
  - `AC-01.8 select without options is discarded`: un `select` con `options: []` se descarta (schema lo marca inválido).
  - Regla con `rule: 'foo'` desconocida se descarta, resto del campo persiste con las demás reglas.
  - Regla `min` sin `params.value` se descarta.
  - Envelope sin `data` → devuelve `[]` y loguea.
  - Narrowing de TS: test de tipos (`expectTypeOf(field).toExtend<{ options: Option[] }>()` cuando `field.type === 'select'`).
- Revisión (`review-checklist`): ninguna respuesta de Strapi se usa sin pasar por una función `parseXxx` en `core/schemas/`.

## Pros y contras de las opciones

### Opción A — zod `discriminatedUnion` + parseo por elemento (elegida)

- ✅ Inferencia precisa para el renderer.
- ✅ Tolerancia a datos parciales con logging claro.
- ✅ Aprovecha una dependencia ya en el stack.
- ❌ Dos niveles de `safeParse` (campo + regla).
- ❌ Requiere mantener el enum de reglas en 3 lugares (Strapi, zod, registro de validadores). Mitigado con tests.

### Opción B — Schema amplio + narrowing manual

- ✅ Schema pequeño, pocos literales.
- ❌ No hay inferencia: el renderer hace casts (`field as SelectField`) o ignora `options?` → introduce `any` disfrazado.
- ❌ El `switch` sobre `type` no es exhaustivo según TS, se puede olvidar un caso sin que el compilador avise.
- ❌ Más fácil que un bug deje pasar un `options` indefinido y rompa en runtime.

### Opción C — `class-transformer` + `class-validator`

- ✅ API familiar para equipos con experiencia en NestJS.
- ❌ **Nueva dependencia doble** (fuera de CLAUDE.md §2) y requiere `reflect-metadata` → inflar bundle.
- ❌ Decorators + clases encajan peor con tipos "inferidos desde la red" que con "clases de dominio".
- ❌ No tiene discriminated unions de primera clase; se simula con herencia.
- ❌ CLAUDE.md §7 ya menciona zod explícitamente.

### Opción D — Validación manual

- ✅ Cero dependencias nuevas.
- ❌ Reescribir lo que zod ya hace, sin inferencia.
- ❌ CLAUDE.md §7 obliga a zod.

## Nueva dependencia

Este ADR **no introduce dependencias nuevas**: `zod` está en CLAUDE.md §2.

## Camino de evolución

- **Agregar un tipo nuevo (`select-multi`, `file`):** se agrega otro `fieldBaseSchema.extend({ type: z.literal('select-multi'), ... })` al `discriminatedUnion`, se actualiza el renderer (`@switch`), y una nueva versión de SPEC-01 actualiza RN-01.10. Cambio acotado y verificable por tipos.
- **Esquema compartido con el CMS (sincronización de enums):** generar el enum de `rule` y el enum de `type` desde una única fuente (p. ej. un JSON en `apps/cms/src/schemas/` consumido por ambos). Fuera de v1; abre un ADR nuevo.
- **Observabilidad real:** `logStructured` se conecta a un sink (p. ej. OpenTelemetry) sin tocar el schema.
- **Más endpoints (planes, countries):** replicar el patrón `parseXxx` en `core/schemas/`. Cada endpoint, su parser; su test.
- **Equipo de 5 personas:** regla de review — "no existe `fetch`/`HttpClient.get` sin su `parse` zod correspondiente"; `code-reviewer` lo verifica.
