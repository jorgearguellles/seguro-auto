---
id: ADR-007
title: Modelo de contenido `plan` en Strapi 5 con componentes repetibles de coberturas y beneficios y moneda enum coherente con país
status: accepted
date: 2026-11-23
deciders: Jorge Argüelles
supersedes:
related: [SPEC-02, RN-02.1, RN-02.2, RN-02.3, RN-02.4, RN-02.5, RN-02.6, RN-02.7, RN-02.11, AC-02.1, AC-02.2, AC-02.3, AC-02.4, AC-02.7, AC-02.12, AC-02.13, AC-02.16, G-02.1, G-02.2, G-02.3, G-02.4, G-02.5, ADR-001, ADR-003, ADR-005, ADR-006]
---

# ADR-007 — Modelo de contenido `plan` en Strapi 5 con componentes repetibles de coberturas y beneficios y moneda enum coherente con país

## Contexto y problema

SPEC-02 define el paso 2 del wizard: lista de planes publicados y activos del país activo, con precio en moneda local, coberturas, beneficios, marca de "recomendado" y orden, todo configurado desde Strapi (RN-02.1, RN-02.2, RN-02.7). La fórmula de ajuste de precio simulada (RN-02.4) usa el campo `vehicleYear` del `WizardStore` (ADR-005) producido por el paso 1 bajo un contrato fijo de `key` (G-02.5). El schema de contenido debe:

- Soportar múltiples coberturas y múltiples beneficios por plan, en orden configurable por negocio (RN-02.1).
- Fijar la moneda como enum cerrado `COP` / `CLP` y validar en el front que coincide con el país del plan (AC-02.16, G-02.2).
- Representar el precio base como entero no negativo — ni COP ni CLP usan decimales en la práctica (RN-02.3).
- Exponer la lista vía rol Public con `populate` explícito y filtros por `country.code` + `active = true` + solo publicados (CLAUDE.md §7; AC-02.1).
- Permitir que el schema zod del front descarte planes individuales corruptos sin romper la lista (AC-02.13, ADR-006).
- Garantizar que el seed de Strapi use **exactamente** la `key` `vehicleYear` en el campo correspondiente del paso 1, porque la fórmula de ajuste la lee literalmente desde `apps/web/src/app/core/pricing.ts` (G-02.5, RN-02.4).

Esta decisión es estructural: una vez creado contenido por negocio en producción, migrar el schema es doloroso (mismo riesgo que ADR-001 para `form-field`).

SPEC-02 §5 ya fijó, en los huecos aceptados por el humano, parte importante del modelo (G-02.1 ⇒ componentes repetibles `plan.coverage`/`plan.benefit` con `label + description? + order`; G-02.2 ⇒ enum `COP`/`CLP`; G-02.3/G-02.4 ⇒ constantes de ajuste en `pricing.ts` y V1 solo `vehicleYear`; G-02.5 ⇒ `key` exacta `vehicleYear`). Este ADR **ratifica** esas decisiones de spec con el esquema concreto en Strapi, el `populate` canónico, el índice de base de datos y el schema zod — y las vuelve auditables con `grep`.

## Factores de decisión

- RN-02.1: negocio edita planes, coberturas, beneficios, orden, recomendado y precio base sin desplegar.
- RN-02.2 + AC-02.1: solo `publishedAt != null` y `active == true` del país activo.
- RN-02.3 + AC-02.2: COP y CLP se formatean como enteros con `Intl.NumberFormat` en el front; Strapi guarda enteros no negativos.
- RN-02.4 + G-02.3 + G-02.5: la fórmula de ajuste vive en `pricing.ts` y usa `applicant.vehicleYear`; la `key` del campo en Strapi debe ser exactamente `vehicleYear`.
- RN-02.6 + AC-02.4: `recommended` es un boolean simple en Strapi; cualquier plan marcado se renderiza con indicador. No es trabajo del CMS elegir uno (SPEC-02 RN-02.6).
- RN-02.7: orden ascendente por `order`, empates por `documentId`.
- AC-02.13: un plan con shape inválido se descarta vía zod sin romper la lista — **requiere que coberturas sean obligatorias (≥1)** y precio/moneda obligatorios en el schema zod.
- AC-02.16: `plan.currency` debe coincidir con la moneda esperada del `plan.country.code` (CO ⇒ COP, CL ⇒ CLP).
- CLAUDE.md §7: `populate` explícito, prohibido `populate=*`; respuesta validada con zod; cero tokens en el front.
- ADR-001 fijó el patrón "componentes repetibles con `label + order`" para `field.option` y `field.validation`; coherente aplicarlo a `plan.coverage` y `plan.benefit` para que negocio tenga la misma UX en el admin.
- ADR-003 D5 cerró el camino rich-text en v1: texto plano por defecto, cualquier `blocks` requiere ADR dedicado. Aplicar el mismo invariante a este modelo.
- Rendimiento de consulta: la query canónica filtra por dos campos (`country.code`, `active`) y Strapi 5 oculta drafts por defecto; conviene un índice que acelere esa combinación.
- Simplicidad para evaluación: la opción más simple que cumple > la más ambiciosa.

## Opciones consideradas

SPEC-02 §5 ya cerró varias sub-decisiones. Este ADR documenta las alternativas restantes que sí quedan abiertas: (i) cómo se modelan coberturas/beneficios **en Strapi** (componente de plan vs componente compartido vs content-type), (ii) cómo se expresa la relación con `country` (enum vs relation), (iii) cómo se define el índice de base de datos para la query canónica.

### D1 — Modelado de `coverages` y `benefits` en Strapi

1. **D1-A — Dos componentes repetibles dedicados `plan.coverage` y `plan.benefit`, declarados bajo `category: plan`.** Cada componente con `label: string` (obligatorio), `description: string` (opcional), `order: integer`. Dos componentes separados a pesar de tener la misma forma, para que negocio vea dos secciones nítidas en el admin y para que el front pueda poblar solo una de las dos si lo requiere.
2. **D1-B — Un único componente compartido `plan.item` con un campo `kind: enumeration('coverage', 'benefit')`.** Reutilización máxima pero el admin necesita que negocio recuerde qué `kind` seleccionar; además complica el `populate` filtrado.
3. **D1-C — `coverage` y `benefit` como content-types separados con relación `oneToMany` desde `plan`.** Reutilizables entre planes; pero SPEC-02 no pide reutilización (cada plan define las suyas) y forzaría a negocio a gestionar entidades globales antes de crear planes.

### D2 — Relación con `country`

1. **D2-A — Relación `manyToOne → country`** (mismo patrón que `form-field` en ADR-001). `plan.country` se popula con `populate[country][fields][0]=code` para traer solo el enum `CO`/`CL`.
2. **D2-B — Campo `countryCode: enumeration('CO', 'CL')` sin relación.** Más barato, una consulta menos, pero rompe el patrón establecido por ADR-001 y por el futuro ADR de US-03 (`country.termsAndConditions`). Dos fuentes de verdad para "qué es un país" en el CMS.

### D3 — Índice de base de datos

1. **D3-A — Índice compuesto `[country, active, publishedAt]` sobre `plans`**, declarado en el schema del content-type (`options.lifecycles` + migración SQLite o vía `lifecycle.beforeCreate` no aplica; se declara como `index` en `schema.json` cuando sea posible, o se documenta la migración manual en el seed).
2. **D3-B — Sin índice explícito**, confiar en el escaneo secuencial. Aceptable por volumen esperado (≤ 20 planes por país) pero el patrón queda sin documentar para cuando se migre de SQLite a Postgres.

## Decisión

### D1 — Modelado de `coverages` y `benefits`

Opción elegida: **D1-A — Componentes repetibles dedicados `plan.coverage` y `plan.benefit`**, porque:

- Es exactamente lo que SPEC-02 §5 G-02.1 aceptó: `label: string` obligatorio + `description: string` opcional + `order: integer`, texto plano (coherente con ADR-003 D5).
- Mismo patrón que `field.option` / `field.validation` de ADR-001 → UX uniforme para el equipo de negocio.
- Dos componentes separados son triviales de distinguir en el admin: negocio ve "Coberturas" y "Beneficios" como listas separadas, sin confusión semántica.
- `populate` canónico y mínimo (`populate=coverages,benefits,country`) sin filtros extra ni joins indirectos.

### D2 — Relación con `country`

Opción elegida: **D2-A — Relación `manyToOne → country`**, porque:

- Mantiene el patrón de ADR-001 (un único content-type `country` como fuente de verdad del dominio país).
- SPEC-02 §6 explicita que la query usa `filters[country][code][$eq]=<país activo>`, lo que exige la relación.
- Prepara el terreno para US-03, donde `country` tendrá `termsAndConditions`; si el plan guardara `countryCode` plano, en US-03 habría que mapear a mano.

### D3 — Índice de base de datos

Opción elegida: **D3-A — Índice compuesto `[country, active, publishedAt]`**, declarado en el schema del content-type mediante `options` cuando SQLite lo soporte y documentado explícitamente en el seed para la migración a Postgres (post-evaluación).

- La query canónica filtra por los tres campos; el índice los cubre.
- Coste nulo en SQLite dev (volumen bajo); valor real cuando se migre a Postgres.
- Declarado en código → reproducible con `docker compose up`.

### Esquema concreto

**Content-type `plan`** (Draft & Publish activo, `uid: api::plan.plan`):

| Campo | Tipo Strapi | Obligatorio | Notas |
|---|---|---|---|
| `documentId` | string (auto) | sí | Identificador estable (Document Service API). Clave del `selectedPlanId` del `WizardStore` (ADR-005). |
| `name` | string | sí | Nombre visible del plan (RN-02.1). |
| `shortDescription` | text | sí | Descripción corta visible bajo el nombre. Texto plano (ADR-003 D5). |
| `basePrice` | integer | sí | Precio base en unidades enteras de la moneda local. **Validación Strapi:** `min: 0`. COP/CLP no usan decimales (RN-02.3). |
| `currency` | enumeration `COP`, `CLP` | sí | Enum cerrado (G-02.2, AC-02.16). La coherencia con `country.code` se valida en zod — Strapi no puede expresar esa restricción cruzada. |
| `coverages` | component repetible `plan.coverage` | sí (≥1) | Al menos una cobertura por plan. El schema zod del front descarta planes sin coberturas (AC-02.13 + AC-02.1). |
| `benefits` | component repetible `plan.benefit` | no | Puede estar vacío. |
| `order` | integer | sí | Orden ascendente de renderizado (RN-02.7). Empates se resuelven por `documentId` ascendente en el front. |
| `recommended` | boolean | sí | Default `false`. Puede haber 0, 1 o N marcados (RN-02.6). |
| `active` | boolean | sí | Default `true`. Solo se consumen los `true` (RN-02.2). |
| `country` | relation `manyToOne → country` | sí | Relación por `country.code` (G-02.2, D2-A). |

Metadatos Strapi: `draftAndPublish: true` ⇒ Strapi 5 oculta drafts por defecto en REST sin parámetro `status` → cumple RN-02.2 sin lógica extra en el front.

**Componente `plan.coverage`** (`category: plan`):

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `label` | string | sí | Visible (texto plano). |
| `description` | text | no | Opcional (texto plano). |
| `order` | integer | sí | Default `0`. Orden ascendente intra-plan. |

**Componente `plan.benefit`** (`category: plan`): **idéntico en forma** a `plan.coverage` (ver §D1-A para la justificación de mantenerlos separados).

**Índice compuesto** (declarado en `apps/cms/src/api/plan/content-types/plan/schema.json` vía `options.indexes` cuando SQLite lo admita, o documentado en una nota del seed para migración):

```
INDEX idx_plans_country_active_published ON plans (country, active, published_at)
```

**Query canónica del front** (coherente con ADR-001 §query canónica):

```
GET /api/plans
  ?filters[country][code][$eq]=CO
  &filters[active][$eq]=true
  &sort=order:asc
  &populate=coverages,benefits,country
  &publicationState=live
```

- `populate=coverages,benefits,country` es el populate **explícito y exactamente los tres**; cumple CLAUDE.md §7 y es la forma que ADR-008 habilitará para el rol Public.
- Sin parámetro `status`, Strapi 5 devuelve solo publicados (aun así, `publicationState=live` queda explícito para auditabilidad).
- El filtro por `country.code` se apoya en la relación `manyToOne` (D2-A).
- `sort=order:asc` cumple RN-02.7; empates se resuelven client-side por `documentId` tras el parseo zod.

### Contrato `vehicleYear` (G-02.5, RN-02.4)

**Contrato inter-artefacto (crítico):** el seed de Strapi que crea el `form-field` del paso 1 asociado al año del vehículo **debe** usar literalmente:

```json
{ "key": "vehicleYear", "type": "number", "section": "vehicle", ... }
```

Este contrato está validado por:

1. **Test de seed** (apps/cms, Vitest/node): tras `bootstrap()`, existe al menos un `form-field` con `key === 'vehicleYear'` para cada país (CO y CL).
2. **Constante en `apps/web/src/app/core/pricing.ts`:**
   ```ts
   export const VEHICLE_YEAR_FIELD_KEY = 'vehicleYear';
   export const PRICE_ADJUST_THRESHOLD_YEARS = 5;
   export const PRICE_ADJUST_SURCHARGE = 0.10;
   ```
3. **Test unitario de pricing** (apps/web, Vitest, título `AC-02.3 applies 10% surcharge when vehicle is older than 5 years`): usa la constante y los casos del Example Table de AC-02.3.

Cualquier cambio del nombre de la `key` (p. ej. a `anioVehiculo`) requiere: (a) nueva versión de SPEC-01, (b) nuevo ADR que supersede este, (c) actualización simultánea de seed + constante + tests.

### Schema zod (patrón ADR-006)

**Ubicación:** `apps/web/src/app/core/schemas/plan.schema.ts`.

```ts
import { z } from 'zod';
import { countryCodeSchema } from './country.schema';

export const currencySchema = z.enum(['COP', 'CLP']);
export type Currency = z.infer<typeof currencySchema>;

const EXPECTED_CURRENCY_BY_COUNTRY: Record<z.infer<typeof countryCodeSchema>, Currency> = {
  CO: 'COP',
  CL: 'CLP',
};

const planCoverageSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional().nullable(),
  order: z.number().int().default(0),
});

const planBenefitSchema = planCoverageSchema; // misma forma (D1-A)

export const planSchema = z
  .object({
    documentId: z.string().min(1),
    name: z.string().min(1),
    shortDescription: z.string().min(1),
    basePrice: z.number().int().nonnegative(),
    currency: currencySchema,
    coverages: z.array(planCoverageSchema).min(1), // AC-02.13: un plan sin coberturas se descarta
    benefits: z.array(planBenefitSchema).default([]),
    order: z.number().int(),
    recommended: z.boolean(),
    active: z.literal(true), // la query ya filtra, defensa en profundidad
    country: z.object({ code: countryCodeSchema }),
  })
  .refine(
    (plan) => plan.currency === EXPECTED_CURRENCY_BY_COUNTRY[plan.country.code],
    { message: 'currency does not match country', path: ['currency'] },
  ); // AC-02.16

export type Plan = z.infer<typeof planSchema>;

export function parsePlans(raw: unknown): Plan[] {
  const envelopeSchema = z.object({ data: z.array(z.unknown()) });
  const parsedEnvelope = envelopeSchema.safeParse(raw);
  if (!parsedEnvelope.success) {
    logStructured('strapi.plans.envelopeInvalid', { issues: parsedEnvelope.error.issues });
    return [];
  }
  const plans: Plan[] = [];
  for (const item of parsedEnvelope.data.data) {
    const result = planSchema.safeParse(item);
    if (!result.success) {
      const documentId = (item as { documentId?: string } | null)?.documentId ?? 'unknown';
      logStructured('strapi.plans.planDiscarded', {
        documentId,
        issues: result.error.issues.map((i) => ({ path: i.path, code: i.code, message: i.message })),
      });
      continue;
    }
    plans.push(result.data);
  }
  return plans.sort((a, b) =>
    a.order !== b.order ? a.order - b.order : a.documentId.localeCompare(b.documentId),
  ); // RN-02.7: empates por documentId ascendente
}
```

- El `refine` sobre moneda cubre AC-02.16 — un plan CO con `currency: 'CLP'` se descarta y se loguea.
- `coverages.min(1)` cubre AC-02.13 para el caso "plan sin coberturas".
- `active: z.literal(true)` es defensa en profundidad: aunque la query filtra, un plan mal filtrado se descarta.
- El ordenamiento final (incluido el desempate por `documentId`) vive aquí, no en el componente.
- `logStructured` es la misma función de ADR-006; la familia de eventos `strapi.plans.*` es trazable con `grep` sobre logs.

### Consecuencias

- ✅ Positiva: Esquema coherente con ADR-001 (mismo patrón de componentes repetibles) → menos carga cognitiva para el equipo que mantiene Strapi.
- ✅ Positiva: AC-02.16 y AC-02.13 se cumplen **en el schema zod**, no requieren lógica ad-hoc en el componente del paso 2.
- ✅ Positiva: Relación `manyToOne → country` permite reutilizar el mismo filtro `filters[country][code][$eq]` que ADR-001, sin rediseñar ADR-008.
- ✅ Positiva: `basePrice` como entero elimina de raíz los problemas de redondeo de punto flotante en el ajuste de precio (RN-02.4 multiplica y aplica `Math.round` sin ambigüedad).
- ✅ Positiva: El contrato `vehicleYear` queda explícito y verificable con tres tests encadenados → cambio accidental de la `key` rompe el seed test antes de llegar a producción.
- ✅ Positiva: Índice compuesto documentado en código → migración a Postgres sin sorpresas.
- ⚠️ Negativa: Dos componentes (`plan.coverage`, `plan.benefit`) con forma idéntica es duplicación aparente. → Mitigación: la duplicación es semántica, no estructural; `planCoverageSchema` se reutiliza para `planBenefitSchema` en zod (`planBenefitSchema = planCoverageSchema`) sin duplicar código.
- ⚠️ Negativa: El `refine` de moneda tiene que mantenerse sincronizado con el enum de `country.code`. Si se añade un país (p. ej. MX), hay que actualizar `EXPECTED_CURRENCY_BY_COUNTRY` o se descartan todos los planes del país nuevo silenciosamente. → Mitigación: test unitario que verifica que todas las claves del enum tienen entrada en el map; además, los planes descartados aparecen en log (`strapi.plans.planDiscarded`).
- ⚠️ Negativa: `active: z.literal(true)` descarta planes inactivos aunque la query ya los filtra → mayor silencio defensivo. → Mitigación: aceptable como defensa en profundidad; es equivalente a "ignorar lo imposible".
- ⚠️ Negativa: `basePrice` como entero fuerza a negocio a introducir "1200000" para COP sin decimales. Potencial confusión UX en el admin ("¿son pesos o centavos?"). → Mitigación: `helpText` del campo en Strapi documenta "unidades enteras de la moneda del plan" + el componente del admin lo refuerza; test manual en HITL-2.
- ⚠️ Negativa: El contrato `vehicleYear` acopla el nombre de una `key` de `form-field` (contenido editable por negocio) con código (constante `VEHICLE_YEAR_FIELD_KEY`). Un cambio accidental en el admin podría romper el ajuste de precio. → Mitigación: la decisión de que ese campo lo cree el **seed** (no edición manual) + el test de seed hacen que un edit en el admin sin tocar el seed sea detectado en CI.
- ⚠️ Negativa: Agregar un factor nuevo de ajuste (p. ej. edad del titular) requiere nueva spec (SPEC-02 §8 lo deja fuera; G-02.4 ratificado). → Mitigación: intencional; evita que un agente futuro invente reglas sin trazabilidad.
- ⚠️ Negativa: SQLite en dev no siempre acepta la declaración de índices compuestos vía `schema.json`. → Mitigación: si el índice no se puede declarar vía Strapi, queda documentado en el seed como `strapi.db.connection.raw(...)` idempotente, ejecutado en `bootstrap()`.

### Validación

- **Test de schema zod** (`plan.schema.spec.ts`, Vitest):
  - `AC-02.13 discards plan without coverages and logs documentId`: fixture con 3 planes, uno sin `coverages` → `parsePlans` devuelve 2 y `logStructured` recibe un evento `strapi.plans.planDiscarded` con el `documentId` del tercero.
  - `AC-02.13 discards plan with missing basePrice or currency`.
  - `AC-02.16 discards plan whose currency does not match country`: plan CO con `currency: 'CLP'` → descartado + log.
  - `AC-02.1 filters inactive plans at zod level (defense in depth)`: plan con `active: false` → descartado.
  - `RN-02.7 sorts plans by order ascending and resolves ties by documentId`: fixture con `order: [5, 1, 5]` → devuelve los dos con `order: 5` ordenados por `documentId`.
- **Test de pricing** (`pricing.spec.ts`, Vitest):
  - `AC-02.3 applies 10% surcharge when vehicle is older than threshold`: usa `PRICE_ADJUST_THRESHOLD_YEARS` y `PRICE_ADJUST_SURCHARGE` desde la constante; cubre los 4 casos del Example Table.
  - `AC-02.3 does not apply surcharge when vehicleYear is missing`: cuando `applicant.vehicleYear` es `undefined`, `finalPrice === basePrice`.
- **Test de seed** (`apps/cms`, Vitest/node): tras `bootstrap()`, `strapi.db.query('api::form-field.form-field').findMany({ filters: { key: 'vehicleYear' } })` devuelve al menos una entrada por país (CO, CL). Si alguna falta, el test falla y bloquea la PR.
- **Test de integración HTTP** (CMS smoke, documentado en `apps/cms/README`): `curl /api/plans?filters[country][code][$eq]=CO&filters[active][$eq]=true&populate=coverages,benefits,country&sort=order:asc&publicationState=live` devuelve un array no vacío con la forma esperada tras el seed CO.
- **Revisión de checklist** (`review-checklist`): ningún endpoint del front usa `populate=*`; el único cliente HTTP de planes está en `core/` y pasa por `parsePlans`.
- **Revisión manual en HITL-2** (CMS admin): el admin de Strapi muestra la UI de `plan` con los dos componentes repetibles "Coverages" y "Benefits" separados; `currency` aparece como dropdown con dos valores; `basePrice` aparece con `helpText` que explica "unidades enteras".

## Pros y contras de las opciones

### D1-A — Componentes dedicados `plan.coverage` y `plan.benefit` (elegida)

- ✅ UX nítida en el admin (dos listas separadas).
- ✅ `populate` mínimo y explícito (`populate=coverages,benefits`).
- ✅ Coherente con ADR-001.
- ❌ Dos componentes de forma idéntica en Strapi. Deuda cosmética.

### D1-B — Componente compartido `plan.item` con `kind`

- ✅ Un único schema en Strapi.
- ❌ Negocio puede marcar mal un ítem (`kind: 'coverage'` vs `'benefit'`) y el error no es visible al publicar; aparece solo al renderizar.
- ❌ El front necesita filtrar client-side o `populate[items][filters][kind][$eq]=...` → dos queries o un populate más complejo.

### D1-C — Content-types `coverage` / `benefit` separados con relación

- ✅ Reutilizables entre planes.
- ❌ SPEC-02 no pide reutilización.
- ❌ Dos entidades más que negocio gestiona antes de crear un plan → fricción.
- ❌ Dos joins extra en la query.

### D2-A — Relación `manyToOne → country` (elegida)

- ✅ Mismo patrón que ADR-001; una sola fuente de verdad para "país".
- ✅ Prepara US-03 (relación con `country.termsAndConditions`).
- ❌ Un join extra en la query (despreciable para < 50 planes por país).

### D2-B — `countryCode` plano sin relación

- ✅ Query un pelo más barata.
- ❌ Dos fuentes de verdad para el país en Strapi.
- ❌ Rompe la simetría con `form-field`.

### D3-A — Índice compuesto `[country, active, publishedAt]` (elegida)

- ✅ Cubre la query canónica.
- ✅ Documentado en código, reproducible.
- ❌ Soporte limitado en SQLite para declararlo vía `schema.json` — puede requerir `raw` en el seed.

### D3-B — Sin índice explícito

- ✅ Nada que mantener.
- ❌ Decisión implícita; en Postgres puede sorprender.

## Nueva dependencia

Este ADR **no introduce dependencias nuevas**: `zod` ya está en CLAUDE.md §2 y Strapi 5 soporta nativamente components, enumerations, relations y draftAndPublish.

## Camino de evolución

- **Más monedas / países (MX con MXN, PE con PEN):** se agrega la fila a `country`, se extiende el enum `currency` en Strapi y en zod (`currencySchema`), se actualiza el map `EXPECTED_CURRENCY_BY_COUNTRY`. Cambio aditivo, acotado y verificado por tests.
- **Factores de ajuste adicionales (edad del titular, ciudad, marca):** SPEC-02 §8 lo deja fuera; cualquier factor nuevo requiere nueva spec que redefina los inputs de `calculateFinalPrice(basePrice, applicant)` en `pricing.ts`.
- **Rich text en `shortDescription`, `coverage.description`, `benefit.description`:** requiere ADR dedicado con renderer de bloques seguro (coherente con ADR-003 D5 y con el camino previsto para US-03 `termsAndConditions`).
- **Reutilización de coberturas/beneficios entre planes:** migración a D1-C con un ADR que supersede este, si negocio lo pide explícitamente.
- **Migración a Postgres:** el índice `[country, active, publishedAt]` ya está definido; el script de migración lo aplica tal cual.
- **Equipo de 5 personas:** el procedimiento "agregar un país" se formaliza como checklist (actualizar enum `countryCode`, `currency`, `EXPECTED_CURRENCY_BY_COUNTRY`, seed, tests).
