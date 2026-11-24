---
id: ADR-008
title: PUBLIC_READ_V2 — permiso `find` sobre `plan` para el rol Public de Strapi, con populate y filtros canónicos
status: accepted
date: 2026-11-23
deciders: Jorge Argüelles
supersedes:
related: [SPEC-02, RN-02.1, RN-02.2, RN-02.7, AC-02.1, AC-02.11, AC-02.12, AC-02.13, G-02.12, ADR-003, ADR-007]
---

# ADR-008 — PUBLIC_READ_V2: permiso `find` sobre `plan` para el rol Public de Strapi, con populate y filtros canónicos

## Contexto y problema

ADR-003 estableció `PUBLIC_READ_V1 = ['api::country.country.find', 'api::form-field.form-field.find']` como el contrato exacto de permisos del rol Public en v1 (SPEC-01). El ADR dejó explícito que **agregar un elemento requiere un nuevo ADR o supersede**.

SPEC-02 (US-02 — Lista de planes) necesita que el front, llamando a `/api` como mismo origen con rol Public (ADR-002), pueda leer el content-type `plan` definido en ADR-007 con un `populate` explícito de tres relaciones (`coverages`, `benefits`, `country`) y filtros de país + estado activo + publicado. SPEC-02 §5 G-02.12 lo señala textualmente ("Delegar al architect: nuevo ADR que amplía `PUBLIC_READ_V1` → `PUBLIC_READ_V2` añadiendo `api::plan.plan.find`").

Este ADR cierra ese hueco. Las decisiones ya están aprobadas en SPEC-02 §5 (G-02.12 ratificado) y §6 (contrato de consumo). Lo que este ADR fija es:

1. **El nombre, la ubicación y la forma exacta** de la constante que reemplaza a `PUBLIC_READ_V1` en el `bootstrap()` de `apps/cms/src/index.ts`.
2. **Las garantías de que el delta se limita a `plan.find`** y a nada más (en particular: ningún `create`/`update`/`delete`, ningún `findOne` en v2 — solo la lista).
3. **Los filtros y el populate exactos** que el front usará, documentados aquí para que los tests de seguridad (lint, Playwright, review) tengan referencia unívoca.
4. **Cómo este ADR convive con ADR-003**: por adición directa (V1 ⊂ V2) o por reemplazo (V2 reescribe V1 desde cero).
5. **Cómo se verifica** que un operador no añadió permisos extras a mano en el admin (ADR-003 D2 dejó el bootstrap en modo aditivo, riesgo aceptado para v1).

Este ADR **no supersede a ADR-003**: lo extiende. ADR-003 sigue siendo la referencia de las sub-decisiones D2 (bootstrap como fuente de verdad), D3 (defensa en tres capas contra tokens en el front), D4 (`populate` explícito con lint + review-checklist) y D5 (texto plano, no rich text). Este ADR es un delta de D1 (alcance de permisos).

## Factores de decisión

- **Mínimo privilegio** (ADR-003 principio rector): habilitar solo `plan.find`; `findOne` queda fuera porque SPEC-02 no lo necesita (la vista de detalle no existe en v1; la selección usa `documentId` del `find`).
- **Bootstrap como fuente de verdad en código** (ADR-003 D2-A): la constante `PUBLIC_READ_V2` en `apps/cms/src/index.ts` reemplaza a `PUBLIC_READ_V1`; un `docker compose up` deja los permisos correctos sin intervención manual.
- **Trazabilidad por `grep`** (ADR-003 D1): un único grep (`rg 'PUBLIC_READ_V2' apps/cms/src/`) debe listar los permisos del rol Public — el ADR exige que la constante sea literal, no construida.
- **Compatibilidad con ADR-007**: el populate `coverages,benefits,country` funciona porque Strapi 5 permite `populate` por lista de campos separados por coma, sin que ello implique permisos extra sobre esas entidades; los componentes viven dentro del content-type `plan` y no requieren `find` propio. **Excepción**: `country` es una relación a otro content-type; verificamos si su populate requiere `country.find` habilitado.
- **AC-02.11** (error de red controlado): si el endpoint responde 403 por permiso faltante, el front lo tratará como error de red; la UX es correcta pero la causa raíz quedaría oculta. El test e2e debe verificar `200` con permiso y `403` sin permiso para distinguir regresión de permisos vs regresión de disponibilidad.
- **CLAUDE.md §7**: `populate=*` prohibido. La query de planes debe usar la forma exacta `populate=coverages,benefits,country`.
- **Riesgo asumido en ADR-003 D2**: bootstrap aditivo (no revierte lo que un operador añadió a mano). Se mantiene el riesgo; se compensa con un test que afirma que el rol Public tiene **exactamente** los permisos de `PUBLIC_READ_V2` tras el bootstrap (modo "assertion", no "enforcement" — si alguien añade permisos a mano después del bootstrap, la assertion los detecta en CI).
- **Simplicidad para evaluación**: la opción más simple que cumple > la más robusta.

## Opciones consideradas

### D1 — Forma del delta sobre ADR-003

1. **D1-A — Constante nueva `PUBLIC_READ_V2` que reescribe la lista completa.** Reemplaza a `PUBLIC_READ_V1` en el bootstrap. Un único `grep` muestra el estado actual. `PUBLIC_READ_V1` desaparece del código.
2. **D1-B — Mantener `PUBLIC_READ_V1` y agregar `PUBLIC_READ_V2 = [...PUBLIC_READ_V1, 'api::plan.plan.find']`** como spread. V1 queda en el código como referencia histórica.
3. **D1-C — No tocar ADR-003: agregar un segundo bootstrap paralelo (`ensurePlanPermissions`)** que añade solo `plan.find`.

### D2 — Qué permisos sobre `plan` se habilitan

1. **D2-A — Solo `api::plan.plan.find`** (listado con filtros).
2. **D2-B — `find` + `findOne`** (anticipar un futuro detalle de plan).
3. **D2-C — `find`, `findOne`, `count`** (métricas y detalle anticipados).

### D3 — Si el populate de `country` requiere permiso adicional

1. **D3-A — Mantener `country.find` en `PUBLIC_READ_V2`** (está desde V1) y confirmar que el populate `country` funciona vía la relación del content-type `plan` sin permiso extra (Strapi 5 permite populate de relaciones si el populate no excede los fields autorizados y la relación es traída junto con el content-type principal).
2. **D3-B — Si Strapi 5 exige `country.find` para poblar la relación desde `plan`:** ya está habilitado en V1, no hay delta.
3. **D3-C — Si Strapi 5 exige `country.findOne`:** sería un delta extra sobre V1 — habría que añadirlo y renombrar.

## Decisión

### D1 — Forma del delta

Opción elegida: **D1-A — Constante nueva `PUBLIC_READ_V2` que reescribe la lista completa** y reemplaza a `PUBLIC_READ_V1` en el bootstrap, porque:

- Trazabilidad unívoca: un solo `grep` (`rg 'PUBLIC_READ_V2' apps/cms/src/index.ts`) muestra el contrato activo. Con D1-B habría dos listas que podrían divergir.
- La historia está en ADR-003 + ADR-008 + git; no necesitamos preservar la constante vieja en código.
- D1-C duplica el patrón de bootstrap y abre la puerta a que el próximo delta cree `ensureXxxPermissions` ad-hoc; preferimos una única función `ensurePublicPermissions` cuya fuente de verdad es una lista literal.

### D2 — Permisos sobre `plan`

Opción elegida: **D2-A — Solo `api::plan.plan.find`**, porque:

- SPEC-02 no abre una vista de detalle (`findOne`) ni consume `count`. Habilitarlos ahora deja superficie de ataque sin test que la ejerza (mismo argumento que ADR-003 D1-A).
- `selectedPlanId` en el `WizardStore` (ADR-005) es el `documentId` tomado del `find`; no se re-consulta el plan individualmente en el paso 3 — US-03 consumirá el plan desde el store, no desde Strapi.
- `findOne` se habilitará en un ADR futuro **cuando** alguna spec lo pida y lo pruebe.

### D3 — Populate de `country`

Opción elegida: **D3-B — Confirmar en el test de integración que `country.find` (ya habilitado en V1) basta para poblar la relación desde `/api/plans`**, y si en HITL-2 se descubre que Strapi 5 exige además `country.findOne`, agregarlo como corrección antes de aceptar este ADR.

- Observación: en Strapi 5, el rol Public necesita permiso de `find` sobre el content-type de la relación para que el populate devuelva sus campos; `findOne` solo es necesario si el consumidor pide la relación por ID vía endpoint dedicado. Esperamos que `find` sea suficiente, como lo era para `form-field.country` en SPEC-01.
- **Verificación obligatoria en HITL-2** antes de pasar a implementación: smoke test `curl /api/plans?...&populate=coverages,benefits,country` con el rol Public devuelve `country.code` poblado. Si no, este ADR se corrige añadiendo `country.findOne` a `PUBLIC_READ_V2`.

### Diseño concreto

**`apps/cms/src/index.ts`** (reemplaza la constante y el bootstrap definidos en ADR-003 D2-A):

```ts
// PUBLIC_READ_V2 — contrato de permisos del rol Public tras ADR-008.
// Agregar un elemento requiere nuevo ADR (supersede este) o versión V3.
const PUBLIC_READ_V2: readonly string[] = [
  'api::country.country.find',       // de V1 (ADR-003) — necesario para filtros y populate
  'api::form-field.form-field.find', // de V1 (ADR-003) — SPEC-01
  'api::plan.plan.find',             // NUEVO en V2 (ADR-008) — SPEC-02
];

async function ensurePublicPermissions(strapi) {
  const publicRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  for (const action of PUBLIC_READ_V2) {
    const exists = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({ where: { action, role: publicRole.id } });
    if (!exists) {
      await strapi.db
        .query('plugin::users-permissions.permission')
        .create({ data: { action, role: publicRole.id } });
    }
  }
}

export default {
  async bootstrap({ strapi }) {
    await ensurePublicPermissions(strapi);
    await seed(strapi);
  },
};
```

- `PUBLIC_READ_V1` desaparece del código (queda en el historial de git + ADR-003).
- La función `ensurePublicPermissions` se reutiliza intacta; cambia solo la constante que consume.
- El modo del bootstrap sigue siendo **aditivo** (ADR-003 D2 riesgo aceptado para v1). Camino de evolución: modo estricto post-evaluación — descrito en ADR-003 §"Camino de evolución", heredado aquí.

**Query canónica del front** (coherente con ADR-007):

```
GET /api/plans
  ?filters[country][code][$eq]=CO
  &filters[active][$eq]=true
  &sort=order:asc
  &populate=coverages,benefits,country
  &publicationState=live
```

Tres observaciones de seguridad vinculadas a ADR-003 D3 y D4:

- El front llama a esta URL **sin `Authorization` ni `Api-Token`**; nginx la hace cumplir con `proxy_set_header Authorization "";` (ADR-003 D3-A en dev y prod).
- El `populate` es **exactamente** `coverages,benefits,country`. Ni `populate=*`, ni populate anidado profundo.
- Los filtros son los dos listados (`country.code` + `active`) + `publicationState=live` para auditabilidad.

**Permisos que permanecen explícitamente prohibidos** (lista "cerrada" para el rol Public en v2):

| Acción | Razón |
|---|---|
| `api::plan.plan.findOne` | Ninguna spec lo pide en v1. |
| `api::plan.plan.create` / `update` / `delete` | El rol Public es de lectura. |
| `api::plan.plan.count` | Sin uso. |
| `api::country.country.findOne` | Si HITL-2 confirma que no se necesita para el populate (ver D3), permanece deshabilitado. |
| `api::form-field.form-field.findOne` | Idem V1 — no se necesita. |
| Cualquier otra acción | Fuera del contrato V2. |

### Consecuencias

- ✅ Positiva: SPEC-02 AC-02.1 se puede cumplir — el front obtiene la lista de planes como rol Public sin tokens.
- ✅ Positiva: Mínimo privilegio real para v2 (solo `find` de `plan`, no `findOne` ni `count`); superficie de ataque mínima.
- ✅ Positiva: Trazabilidad por `grep`: `PUBLIC_READ_V2` en `apps/cms/src/index.ts` es la fuente de verdad única; coincide con lo declarado en este ADR; auditable en CI.
- ✅ Positiva: Compatibilidad con los tres mecanismos de defensa de ADR-003 D3 (lint, Playwright, nginx strip): nada cambia en el front; solo el CMS otorga un permiso más.
- ✅ Positiva: Lint regex de ADR-003 D4-A sigue aplicando sin cambios — la query canónica usa `populate=coverages,benefits,country` (lista de campos), no `populate=*`.
- ✅ Positiva: Compatibilidad con la lógica de descarte de ADR-007 y ADR-006: un plan corrupto se descarta en zod; un 403 en la red se trata como error controlado (AC-02.11).
- ⚠️ Negativa: Este ADR hace que `PUBLIC_READ_V1` desaparezca del código. Un futuro lector tiene que leer ADR-003 + ADR-008 + git para reconstruir la historia. → Mitigación: aceptable; los ADRs son la fuente histórica, el código es el estado actual. Los comentarios en `PUBLIC_READ_V2` identifican de qué ADR proviene cada entrada.
- ⚠️ Negativa: Bootstrap sigue en modo aditivo (ADR-003 D2 riesgo aceptado): un operador puede añadir permisos extra en el admin sin que el bootstrap los revierta. → Mitigación: el test de validación (ver abajo) afirma **igualdad exacta** tras el bootstrap; un drift se detecta en CI. En producción post-evaluación, se migra a modo estricto (ADR-003 §"Camino de evolución").
- ⚠️ Negativa: Si Strapi 5 cambia la semántica de populate y empieza a exigir `country.findOne` para poblar la relación desde `plan`, el test de integración fallaría con 403 silencioso en el populate (el `plan` vendría con `country: null`). → Mitigación: el schema zod de ADR-007 exige `country: z.object({ code: countryCodeSchema })` — un `null` descarta el plan y loguea; el AC-02.1 lo detectaría visualmente (lista vacía). Además, el smoke test de HITL-2 verifica que `country.code` viene poblado.
- ⚠️ Negativa: La línea entre "permiso que faltó" y "error de red" la distingue el test, no la UX. El usuario final siempre ve el mismo mensaje `plans.loadError` (AC-02.11). → Mitigación: aceptable; los logs del front (ADR-006 `logStructured`) incluyen el status HTTP, lo que permite distinguir 403 de 5xx post-mortem.
- ⚠️ Negativa: Añadir un endpoint nuevo en v3 (p. ej. `api::plan.plan.findOne` cuando llegue una vista de detalle) requerirá otro ADR + renombrar a `PUBLIC_READ_V3`. Cada incremento tiene coste de ceremonia. → Mitigación: intencional — cada permiso nuevo debe estar justificado por una spec aprobada.

### Validación

- **Test unitario CMS smoke** (`permissions.spec.ts` o equivalente, Vitest/node, título `AC-02.1 public role has exactly PUBLIC_READ_V2 after bootstrap`): tras ejecutar `bootstrap()` sobre una instancia limpia, se consulta el rol Public y se afirma que **el conjunto de permisos es exactamente igual** a `PUBLIC_READ_V2`. El test falla si falta alguno o si hay permisos extra (detecta drift del admin).
- **Test de integración HTTP** (CMS smoke, documentado en `apps/cms/README`, HITL-2 lo ejecuta manualmente al menos una vez):
  - `curl -i "http://localhost:1337/api/plans?filters[country][code][$eq]=CO&filters[active][$eq]=true&populate=coverages,benefits,country&sort=order:asc&publicationState=live"` sin token → **200** con un array de planes CO publicados y activos, cada uno con `coverages`, `benefits` y `country.code` poblados.
  - `curl -i "http://localhost:1337/api/plans/<documentId>"` sin token → **403** (confirma que `findOne` no está habilitado).
  - `curl -i -X POST "http://localhost:1337/api/plans" -d '{}'` sin token → **403** (confirma que `create` no está habilitado).
- **Test Playwright** (`security.plans.no-auth-header.spec.ts`, título `AC-02.1 plans request has no auth header`): extiende el test `security.no-auth-header.spec.ts` de ADR-003 para afirmar que el request a `/api/plans` también carece de `Authorization` y `Api-Token`.
- **Test Playwright** (`security.plans.no-populate-star.spec.ts`, título `AC-02.1 plans request uses explicit populate`): intercepta el request a `/api/plans` y afirma que el query string contiene `populate=coverages,benefits,country` **y no** `populate=*`.
- **Grep en CI** (extiende ADR-003 §Validación): `rg 'populate=\*' apps/web/src apps/cms/src` → falla. `rg 'PUBLIC_READ_V1' apps/cms/src` → falla (la constante vieja no debe existir en código tras este ADR).
- **Revisión de código** (`review-checklist`):
  - `PUBLIC_READ_V2` en `apps/cms/src/index.ts` tiene exactamente las 3 entradas listadas aquí.
  - Ningún otro archivo construye la lista de permisos (buscar `plugin::users-permissions.permission` → solo en `index.ts`).
  - La query de planes en `apps/web/src/app/core/` usa `populate=coverages,benefits,country` como literal o concatenación controlada (coherente con ADR-003 D4-A).
- **Revisión manual en HITL-2** (admin Strapi): el rol Public en `/admin/settings/users-permissions/roles` muestra exactamente las 3 acciones habilitadas; cualquier otra acción aparece deshabilitada.

## Pros y contras de las opciones

### D1-A — Constante nueva `PUBLIC_READ_V2` que reescribe la lista (elegida)

- ✅ Fuente de verdad única y auditable con un solo `grep`.
- ✅ Semántica clara: "V2 reemplaza V1" alinea con el versionado del ADR (ADR-008 supersede implícito del contrato de ADR-003 D1, no del ADR completo).
- ✅ Cero código muerto.
- ❌ `PUBLIC_READ_V1` desaparece del código — el lector futuro debe consultar git/ADR-003.

### D1-B — Spread `[...PUBLIC_READ_V1, 'api::plan.plan.find']`

- ✅ V1 queda en código como "memoria" para el lector.
- ❌ Dos constantes conviven — pueden divergir si alguien edita una sin la otra.
- ❌ Dos greps necesarios para entender el contrato activo.
- ❌ Fomenta la acumulación sin curar: V3, V4... todos spreads.

### D1-C — Bootstrap paralelo `ensurePlanPermissions`

- ✅ ADR-003 no se toca.
- ❌ Duplica la lógica del bootstrap (idempotencia, DI del `strapi`), más superficie para bugs.
- ❌ El patrón se degrada a "un bootstrap por content-type".
- ❌ La fuente de verdad se fragmenta.

### D2-A — Solo `find` (elegida)

- ✅ Mínimo privilegio real.
- ✅ Cubre exactamente lo que SPEC-02 §6 pide.
- ❌ Cuando llegue un `findOne` lícito, otra ronda de ADR.

### D2-B — `find` + `findOne`

- ✅ Prepara una futura vista de detalle sin tocar permisos.
- ❌ Expone endpoint sin test que lo ejerza; viola el principio "lo que no se prueba, no se expone" (ADR-003 D1-A).
- ❌ Un cliente malicioso podría enumerar `documentId`s si consigue uno (aunque son opacos, no son secretos).

### D2-C — `find` + `findOne` + `count`

- ✅ Permite métricas públicas sin backend extra.
- ❌ SPEC-02 no pide métricas públicas (G-02.14 queda explícitamente fuera).
- ❌ Más superficie sin justificación.

### D3-B — Confirmar que `country.find` basta (elegida, pendiente verificación HITL-2)

- ✅ Cero delta extra respecto a V1 en lo que a `country` respecta.
- ✅ Mínimo privilegio.
- ❌ Depende de comportamiento verificado de Strapi 5; si cambia, hay que añadir `country.findOne`.

### D3-C — Añadir `country.findOne` preventivamente

- ✅ Blinda contra cambios de Strapi.
- ❌ Expone un endpoint sin uso confirmado.
- ❌ Viola mínimo privilegio preventivamente.

## Nueva dependencia

Este ADR **no introduce dependencias nuevas**. Reutiliza el bootstrap y la infraestructura de permisos definidos en ADR-003.

## Camino de evolución

- **US-03 (SPEC-03, pendiente):** si la spec exige leer `country.termsAndConditions`, puede necesitar `api::country.country.findOne` + un renderer de bloques seguro (ADR-003 §Camino de evolución). Se abordaría en un ADR V3 (`PUBLIC_READ_V3`).
- **Vista de detalle de plan:** si alguna spec abre una pantalla dedicada por plan (hoy fuera de alcance), se habilita `api::plan.plan.findOne` en un ADR nuevo que supersede este.
- **Modo estricto del bootstrap** (heredado de ADR-003 §Camino de evolución): activable con `STRAPI_STRICT_PERMISSIONS=true`, elimina del rol Public cualquier permiso que no esté en `PUBLIC_READ_V2`. Post-evaluación.
- **Query builder tipado** (ADR-003 D4-C): cuando el número de queries supere media docena o aparezca populate anidado, se migra a un builder que no permita `populate=*` sintácticamente.
- **Observabilidad de 403 vs 5xx en el front** (ADR-006 `logStructured`): extender el logger para registrar el `status` HTTP de cada fallo, de modo que un drift de permisos se detecte en los logs antes que en un reporte de usuario.
- **Equipo de 5 personas:** checklist de PR "si tu PR añade un content-type consumido por el front, actualiza `PUBLIC_READ_VN` y escribe un ADR delta".
