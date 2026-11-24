---
id: ADR-003
title: Permisos del rol Public de Strapi definidos en código y defensa en profundidad del acceso del front al CMS
status: accepted
date: 2026-11-23
deciders: Jorge Argüelles
supersedes:
related: [SPEC-01, RN-01.1, RN-01.7, AC-01.4, AC-01.15, ADR-001, ADR-002]
---

# ADR-003 — Permisos del rol Public de Strapi definidos en código y defensa en profundidad del acceso del front al CMS

## Contexto y problema

CLAUDE.md §7 fija la postura de seguridad del proyecto. Las reglas que gobiernan este ADR son, textualmente:

> "Ningún token de Strapi en `apps/web` — ni en `environment.ts`, ni en `config.json`, ni en headers. El front llama a `/api` (proxy nginx, mismo origen) como rol Public."
>
> "Rol Public: solo `find` en `country`, `form-field`, `plan`. Cualquier permiso adicional requiere justificación en un ADR. Los permisos se definen **en código** (`bootstrap` de Strapi), nunca a mano en el admin."
>
> "`populate` siempre explícito. Prohibido `populate=*` y populate profundo genérico."
>
> "Texto enriquecido de Strapi se renderiza sin `innerHTML` sin sanitizar (usar un renderer de bloques o `DomSanitizer` documentado)."
>
> "Toda respuesta de red pasa por un schema zod; un tipo de campo desconocido se ignora y se registra en log, no rompe la app."

SPEC-01 §6 declara que el rol Public solo necesita `find` sobre `form-field` (y `country` como entidad relacionada para filtrar). ADR-001 fija el modelo de contenido (`form-field`, componentes `field.validation` y `field.option`, relación `manyToOne → country`) y su query canónica. ADR-002 fija que el front llama a `/api` como mismo origen vía proxy nginx, usando `inject(CountryContext)` + `HttpInterceptor` para añadir el filtro de país.

Queda por decidir:

1. **Qué content-types quedan abiertos al rol Public en v1 (alcance SPEC-01)** y cuáles entran en versiones posteriores (SPEC-02 planes, SPEC-03 T&C).
2. **Dónde y cómo** se declaran esos permisos para que sean reproducibles, auditables y a prueba de drift del admin.
3. **Qué impide**, en builds futuros, que alguien introduzca un token de Strapi en el front por descuido.
4. **Cómo se aplica la prohibición de `populate=*`** y populate profundo genérico — en qué capa se detecta.
5. **Qué garantía hay de que `helpText` de `form-field` (y cualquier otro texto con posible contenido rich) no abra un vector de XSS** al renderizarse.

Esta decisión es bloqueante de los AC-01.4 (reflejo de cambios sin despliegue) y AC-01.15 (solo publicados) — ambos dependen de que el rol Public pueda leer `form-field` publicado y de nada más.

## Factores de decisión

- "Ningún token de Strapi en `apps/web`" (CLAUDE.md §7). El front solo puede hablar con `/api` como rol Public.
- "Los permisos se definen **en código**, nunca a mano en el admin" (CLAUDE.md §7). Un despliegue limpio en otra máquina debe arrancar con los permisos correctos sin intervención humana.
- Principio de mínimo privilegio: solo lo que SPEC-01 necesita hoy, no un superconjunto "por si acaso".
- Alcance real de v1: SPEC-01 renderiza un formulario de campos; US-02 (planes) y US-03 (T&C + pago) están aprobadas como historias pero sus specs no existen aún. Habilitar sus permisos ahora los deja sin prueba de uso.
- `populate=*` prohibido (CLAUDE.md §7); se castiga en code-review pero el proyecto tiene además `review-checklist` automatizable.
- Toda respuesta pasa por zod (CLAUDE.md §7). La defensa en profundidad existe: si Strapi expone de más, zod descarta.
- ADR-001 define `helpText: text` (string plano, no Blocks). Hay que **confirmarlo explícitamente** en este ADR y dejar el camino cerrado para que nadie lo cambie a `blocks` sin pasar por un nuevo ADR.
- Simplicidad para evaluación: la opción más simple que cumple > la más robusta.
- Seed idempotente ya existe (skill `strapi-content-model` §4). Reutilizar en vez de duplicar.

## Opciones consideradas

Dado que el ADR cubre cinco sub-decisiones acopladas, cada una se enumera con sus alternativas.

### D1 — Alcance de permisos del rol Public en v1

1. **D1-A — Solo `country.find` y `form-field.find`.** Es lo que SPEC-01 estrictamente necesita. `plan.find` se agrega en el ADR de US-02.
2. **D1-B — `country.find`, `form-field.find` y `plan.find` desde ya** (anticipar US-02 porque la skill `strapi-content-model` ya lo contempla).
3. **D1-C — Anterior + `country.findOne`** para traer T&C por `documentId` (anticipar US-03).

### D2 — Dónde se definen los permisos

1. **D2-A — `bootstrap()` de `apps/cms/src/index.ts` con upsert idempotente** usando `strapi.db.query('plugin::users-permissions.permission')`, ejecutado en cada arranque. Es el patrón que ya aparece en la skill `strapi-content-model` §3.
2. **D2-B — Un script `scripts/strapi-permissions.ts` que se corre manualmente o en CI** después de levantar Strapi.
3. **D2-C — Configuración manual en el admin**, documentada en el README. (Incluida solo para descartarla; contradice CLAUDE.md §7.)

### D3 — Garantía de "ningún token en el front"

1. **D3-A — Regla ESLint custom + test de red en Playwright + nginx strip en dev y prod.** El strip `proxy_set_header Authorization "";` aplica en ambos entornos (confirmado HITL-2). Tres capas independientes.
2. **D3-B — Solo revisión humana en code-review** (checklist).
3. **D3-C — Solo guard de nginx** (strip del header) sin lint ni test.

### D4 — Hacer cumplir `populate` explícito

1. **D4-A — Lint regex sobre `apps/web/src/**/*.ts`** que prohíbe la cadena literal `populate=*` y `populate=` sin corchetes, junto con una regla de `review-checklist`. Se ejecuta en pre-commit y en CI.
2. **D4-B — Solo code-review manual.**
3. **D4-C — Un "query builder" tipado que no permita sintácticamente `populate=*`** — evolución futura cuando supere media docena de queries.

### D5 — `helpText` y riesgo de XSS

1. **D5-A — Confirmar que `helpText` es `text` (string plano, no `blocks`)** como ya dice ADR-001. El front lo renderiza con interpolación Angular (`{{ helpText }}`), que escapa por defecto.
2. **D5-B — Permitir `helpText` como `blocks`** y agregar un renderer de bloques desde ya.
3. **D5-C — Dejar `text` y permitir HTML limitado** con `DomSanitizer` + whitelist.

## Decisión

### D1 — Alcance de permisos en v1

Opción elegida: **D1-A — Solo `api::country.country.find` y `api::form-field.form-field.find`**.

- SPEC-01 no necesita `plan` ni `country.findOne`. Habilitarlos hoy deja superficie de ataque sin test que la ejerza.
- La skill `strapi-content-model` §3 lista `plan` dentro de `PUBLIC_READ` como propuesta base; este ADR lo acota a v1 (`PUBLIC_READ_V1`). Cuando llegue SPEC-02, un nuevo ADR agrega `plan.find`.
- Mínimo privilegio y trazabilidad: la lista `PUBLIC_READ_V1` del bootstrap es exactamente la lista de permisos activos; auditable con `grep`.

### D2 — Dónde se definen los permisos

Opción elegida: **D2-A — `bootstrap()` de `apps/cms/src/index.ts` con upsert idempotente.**

- Un `docker compose up` en máquina limpia termina con los permisos correctos sin intervención manual.
- Idempotente: `findOne` → si existe, no toca; si no existe, `create`. Nunca borra permisos (modo aditivo aceptado para v1 — confirmado HITL-2).

```ts
// apps/cms/src/index.ts
const PUBLIC_READ_V1: readonly string[] = [
  'api::country.country.find',
  'api::form-field.form-field.find',
];

async function ensurePublicPermissions(strapi) {
  const publicRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  for (const action of PUBLIC_READ_V1) {
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

La lista literal `PUBLIC_READ_V1` es el contrato del rol Public de este ADR. Agregar un elemento requiere un nuevo ADR (o supersede de este).

### D3 — Garantía de "ningún token en el front"

Opción elegida: **D3-A — Lint + test de red en Playwright + strip en nginx (dev y prod).**

- El strip `proxy_set_header Authorization "";` aplica en **ambos entornos** (`docker compose` dev y prod) — confirmado HITL-2. Coherencia total: el comportamiento del proxy es idéntico en dev y en prod, lo que hace que el test Playwright cace regresiones fielmente.
- Tres capas independientes:
  1. **Lint estático** sobre `apps/web/src/**`: prohibido `STRAPI_TOKEN`, `Api-Token`, `Bearer eyJ`, y `Authorization` como literal de header.
  2. **Test Playwright** `security.no-auth-header.spec.ts`: afirma que ningún request a `/api/**` contiene `Authorization` ni `Api-Token`.
  3. **nginx** hace `proxy_set_header Authorization "";` en dev y prod — último filtro.

### D4 — Hacer cumplir `populate` explícito

Opción elegida: **D4-A — Lint regex + regla de `review-checklist`**, con nota de camino de evolución hacia D4-C.

- Lint regex sobre `apps/web/src/**` y `apps/cms/src/**`:
  - Prohibir la cadena literal `populate=*`.
  - Avisar ante `populate=` que no vaya seguido de `[` o `%5B`.
- La regla de `review-checklist` ("ningún endpoint usa `populate=*`") sigue como red de seguridad humana.

### D5 — `helpText` y riesgo de XSS

Opción elegida: **D5-A — `helpText` permanece `text` (string plano), renderizado con interpolación Angular.**

- ADR-001 fija `helpText: text`. Este ADR lo **confirma como invariante de seguridad** en v1: ningún atributo de `form-field` consumido por el rol Public puede ser `blocks` sin un nuevo ADR.
- La interpolación Angular (`{{ field.helpText }}`) escapa HTML por defecto → cero vector XSS.
- `errorMessage`, `label`, `options.label`, `options.value`: todos `string`. Ningún atributo del contrato de SPEC-01 §6 es rich text.
- US-03 introducirá `country.termsAndConditions` como `blocks`; ese ADR deberá incorporar el renderer de bloques seguro.

### Consecuencias

- ✅ Positiva: Permisos reproducibles en código, sin drift del admin. `docker compose up` produce exactamente el mismo estado de seguridad en cualquier máquina.
- ✅ Positiva: Mínimo privilegio real — el rol Public expone solo lo que el front de SPEC-01 consume.
- ✅ Positiva: Tres capas independientes impiden fuga de tokens al front (lint, e2e, nginx) — en dev y prod por igual.
- ✅ Positiva: `populate=*` detectable en lint, no solo en revisión humana.
- ✅ Positiva: Riesgo XSS en SPEC-01 formalmente cerrado.
- ⚠️ Negativa: Cuando llegue SPEC-02 habrá que modificar `PUBLIC_READ_V1` → `PUBLIC_READ_V2`. Si se olvida, los planes no se ven (fallo cerrado: 403). → Mitigación: el test e2e de US-02 fallará con 403 en el primer run.
- ⚠️ Negativa: Bootstrap aditivo — un operador puede añadir permisos a mano en el admin sin que el bootstrap los revierta. → Mitigación: riesgo aceptado para v1 (confirmado HITL-2). Camino de evolución: modo estricto post-evaluación.
- ⚠️ Negativa: Lint regex evadible con concatenación de strings. → Mitigación: el test e2e intercepta el request real; la regex es apoyo, no barrera única.
- ⚠️ Negativa: `helpText` como `text` plano impide dar formato visual desde negocio. → Mitigación: aceptable para SPEC-01; cuando negocio lo pida, se abre ADR para renderer de bloques.

### Validación

- **Test unitario** (CMS smoke): tras `bootstrap()`, el rol Public tiene exactamente los permisos de `PUBLIC_READ_V1`.
- **Test de integración HTTP**: `curl /api/form-fields?...` sin token → 200; `curl /api/plans` sin token → 403; `curl /api/form-fields/<id>` sin token → 403.
- **Test Playwright** `security.no-auth-header.spec.ts` (`AC-01.15 front never sends auth headers to /api`): recorre el wizard y afirma ausencia de `Authorization` / `Api-Token`.
- **Test Playwright** `security.no-populate-star.spec.ts` (`AC-01.4 front queries use explicit populate`): intercepta requests a `/api/**` y falla si el query string contiene `populate=*`.
- **Grep en CI**: `grep -R -nE 'populate=\*|STRAPI_TOKEN|Bearer\s+eyJ' apps/web/src` → build falla si encuentra algo.
- **Revisión de nginx config** en code-review: `proxy_set_header Authorization "";` presente en el bloque `/api` del `nginx.conf` (dev y prod).

## Pros y contras de las opciones

### D1-A — Solo `country.find` + `form-field.find` (elegida)
- ✅ Mínimo privilegio real para v1.
- ✅ Alineado con "lo que no se prueba, no se expone".
- ❌ Cuando llegue SPEC-02 habrá que volver a tocar el bootstrap y escribir un ADR delta.

### D1-B — Incluir `plan.find` desde ya
- ✅ Menos fricción cuando se empiece US-02.
- ❌ Expone contenido sin test que lo ejerza. Viola mínimo privilegio.

### D2-A — `bootstrap()` con upsert idempotente (elegida)
- ✅ Cero paso manual; reproducible con `docker compose up`.
- ✅ Idempotente; no explota si los permisos ya están.
- ❌ Un operador puede ampliar permisos a mano (riesgo aceptado para v1).

### D2-B — Script manual / CI
- ❌ Alguien olvida correrlo → 403 sin diagnóstico obvio.
- ❌ Requiere credenciales admin en CI — introduce riesgo opuesto.

### D3-A — Lint + Playwright + nginx strip dev y prod (elegida)
- ✅ Tres capas independientes; comportamiento idéntico en dev y prod.
- ❌ Más superficie de infra (ESLint rule, .spec.ts dedicado, config nginx).

### D3-B — Solo code-review
- ❌ Depende de memoria humana. Un agente generativo puede añadir un header y pasar revisión automatizada.

### D4-A — Lint regex + review-checklist (elegida)
- ✅ Barato, detecta el 99 % de casos.
- ❌ Evadible con concatenación (mitigado por test e2e que ve el request real).

### D4-C — Query builder tipado
- ✅ Imposible escribir `populate=*` sintácticamente.
- ❌ Overkill para 1–2 queries en SPEC-01. Documentado como evolución.

### D5-A — `helpText` como `text` plano (elegida)
- ✅ Cero riesgo de XSS; consistente con ADR-001.
- ❌ Sin formato visual en el help text (aceptable para v1).

### D5-B — `helpText` como `blocks`
- ❌ Requiere renderer de bloques ya; ningún ADR lo diseña para SPEC-01.

## Camino de evolución

- **SPEC-02 (planes):** nuevo ADR agrega `api::plan.plan.find` a `PUBLIC_READ_V2`.
- **SPEC-03 (T&C + pago):** agrega `country.findOne` si hace falta, e introduce renderer de bloques seguro para `termsAndConditions`.
- **Equipo de 5 personas:** bootstrap modo estricto — además de upsert, elimina permisos del rol Public que no estén en la lista. Activable con `STRAPI_STRICT_PERMISSIONS=true`.
- **Query builder tipado (D4-C):** cuando supere media docena de queries o se incorpore populate anidado.
- **Renderer de bloques seguro:** cuando US-03 lo exija; ADR dedicado con análisis de dependencias.
