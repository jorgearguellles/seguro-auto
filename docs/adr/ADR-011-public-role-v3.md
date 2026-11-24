---
id: ADR-011
title: PUBLIC_READ_V3 — permisos del rol Public amplían `api::terms.terms.find` para SPEC-03
status: accepted
date: 2026-11-23
deciders: Jorge Argüelles
supersedes:
related: [SPEC-03, RN-03.3, AC-03.3, AC-03.10, AC-03.11, AC-03.12, G-03.7, ADR-003, ADR-009, ADR-012]
---

# ADR-011 — PUBLIC_READ_V3: permisos del rol Public amplían `api::terms.terms.find` para SPEC-03

> **Nota (post-hoc, 2026-11-23):** ver ADR-012. El endpoint REST público del content-type `terms` es `/api/legal-terms` (no `/api/terms`) por conflicto de `pluralName: "terms"` con convenciones internas de Strapi 5. **El UID del permiso no cambia** — sigue siendo `api::terms.terms.find` (basado en `singularName: "terms"`). Lo que cambia son las URLs de los ejemplos `curl` en §Validación y la §Query canónica del front. Todo lo demás (D1-A, D2-A, D3-A, mínimo privilegio, modo aditivo del bootstrap) permanece intacto.

## Contexto y problema

ADR-003 §D1-A fijó `PUBLIC_READ_V1 = [api::country.country.find, api::form-field.form-field.find]` para SPEC-01. Su "camino de evolución" ya anticipó que SPEC-03 ampliaría la lista con el permiso de lectura sobre términos.

SPEC-03 lo hace explícito:

- **AC-03.3** exige que el texto de T&C provenga de Strapi para el país activo.
- **AC-03.10 / AC-03.11 / AC-03.12** exigen poder distinguir "cargando", "error" y "vacío" — todos los tres parten de **hacer la llamada** al CMS. Sin permiso del rol Public, el front solo vería `403 Forbidden` y no podría cumplir ninguno de los tres.
- **G-03.7** registra el hueco: "Permiso del rol Public para leer `terms` en Strapi. Sin esto, el front obtiene 403 y AC-03.3 falla. Propuesta: nuevo ADR delta que agrega `api::terms.terms.find` a `PUBLIC_READ_V3`."
- **ADR-009** define el content-type `terms` y su query canónica con `populate[country]=true` y filtros por país.

Este ADR es un **delta** sobre ADR-003: hereda íntegramente D2-A (bootstrap idempotente), D3-A (lint + e2e + nginx strip), D4-A (lint regex contra `populate=*`), y D5-A (no rich text en atributos del Public salvo donde haya renderer seguro, hoy cubierto por ADR-009). **Solo cambia D1** (alcance de permisos).

> **Dependencia sobre un ADR futuro (US-02):** el usuario de este ADR asume que existe/existirá un `PUBLIC_READ_V2` introducido por el ADR de US-02 (planes) que añade `api::plan.plan.find`. A fecha de este ADR, ese ADR de US-02 **no está escrito todavía**; `apps/cms/src/index.ts` sigue con `PUBLIC_READ_V1`. Este ADR documenta el **estado final V3** y el handoff indica la dependencia: si el ADR de US-02 todavía no aterriza, la constante en código quedaría temporalmente como `PUBLIC_READ_V1 ∪ { terms.find }`, y el nombre `PUBLIC_READ_V3` se adopta cuando `plan.find` también esté en la lista. Es una decisión de secuenciación de la implementación, no de arquitectura.

## Factores de decisión

Heredados íntegramente de ADR-003:

- "Los permisos se definen **en código** (`bootstrap` de Strapi), nunca a mano en el admin" (CLAUDE.md §7).
- "Rol Public: solo `find` en los content-types explícitamente justificados" (CLAUDE.md §7 + ADR-003 §D1).
- Principio de mínimo privilegio: solo lo que SPEC-03 necesita hoy, no más.
- Sin tokens en `apps/web` (CLAUDE.md §7 + ADR-003 §D3).
- `populate` explícito (CLAUDE.md §7 + ADR-003 §D4).
- Rich text (Blocks de `terms.body`) servido por el rol Public → debe haber un renderer seguro **antes** de que el permiso entre en producción (resuelto por ADR-009 §D3-A).

Factores específicos de este delta:

- SPEC-03 necesita leer `terms` filtrando por `country.code`, lo que requiere `populate[country]=true`. El permiso de `country.find` ya existe (ADR-003). El nuevo permiso es solo `api::terms.terms.find`.
- Un **solo endpoint**: `find` (listado con filtros), no `findOne`. SPEC-03 selecciona el documento por `filters[country][code]` + `sort=effectiveDate:desc` + `pagination[limit]=1`, nunca accede por `documentId` directo desde el front.

## Opciones consideradas

### D1 — Qué permisos se añaden en SPEC-03

1. **D1-A — Solo `api::terms.terms.find`.** Lo estrictamente necesario para AC-03.3 bajo la query canónica de ADR-009.
2. **D1-B — `api::terms.terms.find` + `api::terms.terms.findOne`.** Permitir acceso por `documentId`.
3. **D1-C — `api::terms.terms.find` + `api::country.country.findOne`.** Anticipar un hipotético futuro donde `country` se consulte uno a uno.

### D2 — Cómo se expresa en código

1. **D2-A — Redefinir `PUBLIC_READ_V2 → PUBLIC_READ_V3`** en `apps/cms/src/index.ts`. La constante tiene un único nombre vigente; el histórico vive en los ADRs.
2. **D2-B — Mantener `PUBLIC_READ_V2` y añadir `PUBLIC_READ_TERMS` como lista aparte**, uniéndolas en el bootstrap.
3. **D2-C — Un JSON externo** leído en bootstrap.

### D3 — Comportamiento del bootstrap ante el permiso previo de V2 que ya está en DB

1. **D3-A — Mantener modo aditivo** (ADR-003 §D2-A): el bootstrap solo crea permisos que faltan; nunca borra. Si un operador añade un permiso extra en el admin, el bootstrap no lo revierte.
2. **D3-B — Cambiar a modo estricto**: el bootstrap también **elimina** permisos del rol Public que no estén en la lista.

## Decisión

### D1 — Alcance

Opción elegida: **D1-A — Añadir solo `api::terms.terms.find`.**

- SPEC-03 no accede a `terms` por `documentId` desde el front; la query es un `find` con filtros y `limit=1`. `findOne` no se usa → no se habilita (mínimo privilegio).
- `country.findOne` tampoco se usa — el filtro sobre la relación se hace vía `country.find` (que el rol Public ya tiene desde V1) y vía `populate[country]=true` en `terms.find`.
- Alinea con ADR-003 §D1-A: "lo que no se prueba, no se expone". `findOne` no tiene test que lo ejerza en SPEC-03.

### D2 — Expresión en código

Opción elegida: **D2-A — Redefinir `PUBLIC_READ_V2 → PUBLIC_READ_V3` en `apps/cms/src/index.ts`.**

- Una constante vigente, único nombre, auditable con `grep`. El historial de versiones vive en los ADRs (V1 en ADR-003, V2 en el ADR pendiente de US-02, V3 aquí).
- D2-B (dos listas) fragmenta la fuente de verdad. D2-C (JSON externo) introduce un artefacto más sin valor para v1.

**Delta sobre el código actual** (una vez que el ADR de US-02 haya aplicado V2):

```ts
// apps/cms/src/index.ts

// --- antes (V2, del ADR de US-02) ---
// const PUBLIC_READ_V2: readonly string[] = [
//   'api::country.country.find',
//   'api::form-field.form-field.find',
//   'api::plan.plan.find',
// ];

// --- después (V3, este ADR) ---
const PUBLIC_READ_V3: readonly string[] = [
  'api::country.country.find',
  'api::form-field.form-field.find',
  'api::plan.plan.find',
  'api::terms.terms.find',
];
```

**Si el ADR de US-02 todavía no ha aplicado V2 cuando se implemente esta SPEC-03:**
- El equipo de implementación levanta una pregunta abierta y espera.
- Alternativa "tactical": agregar solo `api::terms.terms.find` a `PUBLIC_READ_V1` provisionalmente con un `TODO(ADR-US02)`, documentado en el PR. Esto **no es** la decisión de arquitectura — es gestión de orden de merges. El nombre canónico y final es V3.

### D3 — Modo del bootstrap

Opción elegida: **D3-A — Mantener modo aditivo** (igual que ADR-003).

- Cambiar a modo estricto es una decisión de v2 (ADR-003 §Camino de evolución, "equipo de 5 personas"). No es necesario para cerrar SPEC-03.
- El riesgo de drift del admin (operador añade permisos a mano) sigue aceptado para v1.

### Query canónica del front (recordatoria, define ADR-009; URL amended by ADR-012)

```
GET /api/legal-terms
  ?filters[country][code][$eq]=CO
  &sort=effectiveDate:desc,updatedAt:desc
  &pagination[limit]=1
  &populate[country]=true
```

- `populate[country]=true` — nunca `populate=*` (ADR-003 §D4 + lint).
- El endpoint se pluraliza como `/api/legal-terms` porque `apps/cms/src/api/terms/content-types/terms/schema.json` fija `pluralName: 'legal-terms'` (ADR-012, enmienda de ADR-009). El UID interno del content-type sigue siendo `api::terms.terms`, por lo que el permiso D1-A permanece literal.
- Sin `Authorization` ni `Api-Token` (ADR-003 §D3).

### Consecuencias

- ✅ Positiva: AC-03.3, AC-03.10, AC-03.11 y AC-03.12 dejan de estar bloqueadas por 403 — el front puede cumplir cualquiera de las cuatro ramas (ok, loading, error, empty).
- ✅ Positiva: Mínimo privilegio preservado — solo un permiso nuevo, exactamente el que SPEC-03 ejerce.
- ✅ Positiva: Patrón uniforme con ADR-003 — la lista `PUBLIC_READ_V3` sigue siendo el contrato único del rol Public, auditable con `grep 'PUBLIC_READ_V' apps/cms/src/index.ts`.
- ✅ Positiva: Compatible con ADR-009 (renderer seguro ya está diseñado para el momento en que el permiso entre en producción). Rich text servido por Public tiene renderer sin `innerHTML`.
- ⚠️ Negativa: Añade dependencia de secuenciación: este ADR asume `PUBLIC_READ_V2` del ADR de US-02. Si US-03 se implementa antes que US-02, la constante quedaría temporalmente mal nombrada. → Mitigación: documentado explícitamente en §D2; el nombre `V3` es la meta; el implementador decide si crear V3 completo o un paso intermedio con `TODO`.
- ⚠️ Negativa: El bootstrap sigue en modo aditivo — un operador puede abrir más permisos a mano (p. ej. `api::terms.terms.findOne`) sin que el bootstrap los revierta. → Mitigación: riesgo heredado y aceptado de ADR-003; camino de evolución documentado.
- ⚠️ Negativa: Añadir un permiso nuevo requiere, en un entorno ya desplegado, reiniciar Strapi para que `bootstrap()` corra. → Mitigación: `docker compose up --build` reinicia Strapi; el test e2e de AC-03.3 pasa de 403 a 200 en el primer run post-deploy.
- ⚠️ Negativa: `find` en `terms` expone **todos** los documentos publicados del endpoint a cualquier cliente — incluso los de países que el cliente no está consultando (si no incluye el filtro por país). → Mitigación: la query canónica siempre incluye `filters[country][code]`; el test `security.no-populate-star.spec.ts` (ADR-003 §Validación) se extiende para asegurar que `terms` también se consulta con filtro de país; no hay PII en `terms` (es texto legal público), por lo que la exposición cruzada entre países no es un problema de confidencialidad, solo de higiene de queries.

### Validación

> **Nota:** las URLs de los `curl` siguientes están actualizadas por ADR-012 (`/api/terms` → `/api/legal-terms`). El UID del permiso (`api::terms.terms.find`) no cambia.

- **Test unitario** (CMS smoke, `AC-03.3 bootstrap grants terms.find to Public`): tras `bootstrap()`, el rol Public tiene exactamente los permisos de `PUBLIC_READ_V3` — se verifica contra la lista literal del código (test parametrizado por entrada de la lista).
- **Test de integración HTTP** (`AC-03.3 GET /api/legal-terms returns 200 without token`): `curl /api/legal-terms?filters[country][code][$eq]=CO&populate[country]=true` sin headers de autenticación → `200` con al menos un documento del seed.
- **Test de integración HTTP** (`AC-03.3 GET /api/legal-terms/<id> returns 403`): `curl /api/legal-terms/<documentId>` sin token → `403`. El rol Public solo tiene `find`, no `findOne`.
- **Test Playwright** (`AC-03.3 front loads terms per country`): recorrer paso 3 en `/co` y en `/cl` → DOM del renderer contiene texto distinto para cada país.
- **Test Playwright** (`security.no-auth-header.spec.ts` existente): afirma ausencia de `Authorization` / `Api-Token` en todos los requests a `/api/**` incluyendo `/api/legal-terms`. Se añade al recorrido del paso 3.
- **Test Playwright** (`security.no-populate-star.spec.ts` existente): intercepta `/api/legal-terms*` y falla si el query contiene `populate=*`.
- **Test Playwright** (`AC-03.11 terms endpoint failure shows error state`): mockear ruta `/api/legal-terms*` para devolver `503` → ver `terms.loadError` + botón reintentar; `pagar` deshabilitado.
- **Test Playwright** (`AC-03.12 empty terms shows empty state`): mockear ruta `/api/legal-terms*` para devolver `{ data: [] }` → ver `terms.empty`; `pagar` deshabilitado; no se renderiza checkbox de aceptación.
- **Grep en CI** (`review-checklist`): `grep -R -nE 'PUBLIC_READ_V' apps/cms/src` devuelve exactamente una definición (`PUBLIC_READ_V3`) y ningún alias.
- **Revisión manual en HITL-2**: lista `PUBLIC_READ_V3` del código ↔ lista de permisos del rol Public en el admin tras `docker compose up` desde limpio.

## Pros y contras de las opciones

### D1-A — Solo `terms.find` (elegida)
- ✅ Mínimo privilegio real para SPEC-03.
- ✅ Alineado con ADR-003 §D1-A.
- ❌ Si en el futuro se añade una pantalla "ver versión histórica de T&C por id", requerirá nuevo ADR para `findOne`. Aceptable.

### D1-B — `find` + `findOne`
- ✅ Flexibilidad futura.
- ❌ Expone un endpoint sin test que lo ejerza → viola mínimo privilegio.

### D1-C — `find` + `country.findOne`
- ✅ Útil solo si en el futuro se consulta `country` por id.
- ❌ SPEC-03 no lo necesita; el filtro `country.code` sobre `terms` es suficiente.

### D2-A — Redefinir la constante vigente (elegida)
- ✅ Una sola fuente de verdad en código; auditable con `grep`.
- ✅ Historial en los ADRs.
- ❌ Si el ADR de US-02 no ha pasado, hay fricción de secuenciación. Mitigado en §D2.

### D2-B — Lista separada para terms
- ✅ Diffs pequeños por ADR.
- ❌ Fragmenta la fuente de verdad del rol Public.

### D2-C — JSON externo
- ❌ Introduce un artefacto más sin valor para v1.

### D3-A — Aditivo (elegida)
- ✅ Consistente con ADR-003; cero sorpresas en entornos ya desplegados.
- ❌ Tolera drift del admin. Riesgo aceptado.

### D3-B — Estricto
- ✅ Garantiza convergencia exacta.
- ❌ Fuera de alcance de v1 (ya documentado en ADR-003 como camino de evolución).

## Nueva dependencia

Este ADR **no introduce dependencias nuevas**. Solo modifica una constante existente en `apps/cms/src/index.ts`.

## Camino de evolución

- **Modo estricto del bootstrap:** cuando el equipo crezca, activar `STRAPI_STRICT_PERMISSIONS=true` para que el bootstrap elimine permisos no listados.
- **Versionado de la lista en código:** si la lista supera 10 permisos, extraer a `apps/cms/src/public-permissions.ts` con sus tests dedicados.
- **`findOne` para terms** cuando aparezca un caso de uso justificado (p. ej. deep-link a "ver términos vigentes al momento de la cotización"). Nuevo ADR delta.
- **Más países:** la lista de permisos no cambia; Strapi filtra por `country.code` sobre los documentos ya accesibles.
- **Equipo de 5 personas:** check de PR — "¿tu PR añade permisos al rol Public? → debes crear un ADR delta".

## Changelog

- 2026-11-23: ADR-012 enmienda las URLs de ejemplo (`/api/terms` → `/api/legal-terms`) en §Query canónica del front y §Validación. El UID del permiso (`api::terms.terms.find`) permanece intacto; el resto del ADR (D1-A, D2-A, D3-A) no cambia.
