---
id: ADR-012
title: `pluralName: "legal-terms"` para el content-type `terms` — endpoint `/api/legal-terms` por conflicto con Strapi 5
status: accepted
date: 2026-11-23
deciders: Jorge Argüelles
supersedes: ADR-009 §Esquema concreto (solo el fragmento del endpoint URL / `pluralName`)
related: [SPEC-03, RN-03.3, AC-03.3, AC-03.10, AC-03.11, AC-03.12, F-03-1.2, ADR-009, ADR-011]
---

# ADR-012 — `pluralName: "legal-terms"` para el content-type `terms` — endpoint `/api/legal-terms` por conflicto con Strapi 5

## Contexto y problema

ADR-009 (`status: accepted`) fijó el content-type `terms` con `singularName: 'terms-doc'` y `pluralName: 'terms'` para que el endpoint REST canónico fuese `/api/terms` (ver ADR-009 §Esquema concreto, §Consecuencias y §Validación — todas sus referencias asumen `/api/terms`). ADR-011 (`status: accepted`) heredó esa URL en su §Query canónica del front y en los `curl` de §Validación.

Durante la implementación de US-03, al levantar Strapi 5 con `pluralName: "terms"` el arranque falla: la cadena `terms` colisiona con convenciones internas de Strapi 5 en el árbol de rutas / UIDs del admin y del core (observado en caliente durante el build del paso 3). Síntoma reproducible: el `bootstrap` no termina de registrar el content-type y la ruta `/api/terms` no responde 200 como pide ADR-011 §Validación.

El commit `a7c1fd2` — `fix(US-03): change pluralName from 'terms' to 'legal-terms' to avoid Strapi conflict; update API URL [ADR-009]` — cambió el valor a `pluralName: "legal-terms"` (endpoint real `/api/legal-terms`) y alineó `apps/web/src/app/core/strapi.client.ts` y los e2e, pero **no** se escribió un ADR delta ni se añadió una entrada al changelog de ADR-009. Esto fue detectado en REV-03-1 como **F-03-1.2 (critical)** por violar CLAUDE.md §6.2: *"Una spec aprobada o un ADR aceptado es inmutable. Un cambio = nueva versión con entrada en el changelog y nueva aprobación humana."*

El HITL-3 de REV-03-1 aprobó formalmente la **Opción A** para F-03-1.2 (crear ADR-012 + enmienda al changelog de ADR-009 + alineación de ADR-011). Este ADR es la formalización post-hoc requerida.

### Evidencia del conflicto

- `apps/cms/src/api/terms/content-types/terms/schema.json` fija hoy `"pluralName": "legal-terms"`.
- `apps/web/src/app/core/strapi.client.ts:72` consume `/api/legal-terms`.
- `apps/web/e2e/paso-3.spec.ts:39-40` intercepta `**/api/legal-terms**` explícitamente con comentario *"StrapiClient.getTerms() calls /api/legal-terms (not /api/terms) — see strapi.client.ts:72"*.
- La cadena literal `terms` como `pluralName` roza nombres reservados por Strapi 5 (el plugin `users-permissions` modela tokens de la familia `/api/users/*` cuyos UIDs y rutas tocan el espacio de nombres de `terms` en varios puntos del core; además el admin API usa prefijos genéricos que no dejan hueco limpio). La investigación concreta vive en el commit `a7c1fd2`; este ADR documenta el **qué** y el **porqué**, no reproduce la traza completa.

## Factores de decisión

- **Gobernanza (CLAUDE.md §6.2):** un ADR aceptado no se edita; los cambios requieren un ADR nuevo con `supersedes` y una entrada en el changelog del ADR afectado. Sin este ADR, ADR-009 y ADR-011 mienten.
- **AC-03.3:** el front debe poder leer términos desde Strapi. Si el CMS no arranca con `pluralName: "terms"`, AC-03.3 queda bloqueado en runtime real → cambiar el `pluralName` es la vía mínima para desbloquearlo.
- **Mínima disrupción:** ADR-009 ya está implementado al 95 %. Lo único que cambia es el nombre del endpoint. No se tocan: schema del content-type (atributos, relaciones, `body: blocks`), zod (`termsDocumentSchema`), renderer (`TermsBlocksRendererComponent`), bootstrap de permisos (ADR-011 §D1-A sigue siendo `api::terms.terms.find`).
- **Alineación con convenciones del repo:** otros content-types usan kebab-case plurales (`form-fields`, `legal-terms`). `terms` como plural era la excepción.
- **Nombre descriptivo:** `legal-terms` comunica el dominio (términos legales) mejor que `terms` — reduce ambigüedad para operadores del admin y futuros desarrolladores.
- **No se cambia el UID interno de Strapi:** sigue siendo `api::terms.terms` (basado en `singularName`), por lo que ADR-011 §D1 (`api::terms.terms.find`) **no requiere cambios en código**. Solo cambia la URL REST pública.

## Opciones consideradas

### A — Mantener `pluralName: "terms"` y patchear las rutas de Strapi

Intervenir el core/admin de Strapi 5 (sobrescribir rutas, renombrar prefijos internos, o excluir `terms` del plugin conflictivo) para que `pluralName: "terms"` arranque sin colisión.

- ❌ Invasivo: tocar internals de Strapi es frágil y rompe en cada upgrade menor.
- ❌ Ensucia la línea base del CMS con un parche que debe mantenerse y testearse.
- ❌ No aporta valor: el nombre `terms` no es un requisito de negocio ni de SPEC-03; solo era la forma más corta.
- ❌ Riesgo de seguridad: tocar el plugin `users-permissions` cerca de donde vive el rol Public (ADR-011) amplía la superficie sin beneficio.
- ✅ Único pro: la URL canónica quedaría literalmente como en ADR-009 original.

### B — Usar `pluralName: "legal-terms"` → endpoint `/api/legal-terms` (elegida)

Cambio de una sola letra en `schema.json`; alineación automática del URL de REST. El UID interno (`api::terms.terms`), el content-type lógico, el modelo de contenido y los permisos no cambian.

- ✅ Cambio mínimo: una línea en `schema.json`, una línea en `strapi.client.ts`, una en `paso-3.spec.ts`.
- ✅ Alineado con la convención del repo (`form-fields`, `plans`). `terms` solitario era la excepción.
- ✅ Mejor UX de admin: el nombre `legal-terms` es más descriptivo.
- ✅ Cero coste de mantenimiento futuro: no hay patch del core de Strapi que reaplicar en upgrades.
- ❌ ADR-009 queda con una discrepancia documental que **este ADR** resuelve.
- ❌ Cualquier commit viejo o documentación externa que mencione `/api/terms` queda obsoleta — se documenta en consecuencias.

### C — Renombrar el content-type por completo (p. ej. a `legal-document`)

Cambiar `singularName`, `pluralName`, el directorio `apps/cms/src/api/terms/*`, el UID (`api::legal-document.legal-document`) y todas las referencias en código, bootstrap, permisos y zod.

- ❌ Demasiado disruptivo: toca ADR-011 (`api::terms.terms.find` → `api::legal-document.legal-document.find`), el nombre del directorio, el nombre de la colección en BD (`terms_documents` → otro), y rompe la traza histórica.
- ❌ Riesgo de pérdida de datos si ya hay documentos seedados (requeriría migración).
- ❌ Beneficio marginal frente a B: el UID interno es invisible al usuario final.
- ✅ Único pro: homogeneidad total (singular `legal-document`, plural `legal-documents`, UID `api::legal-document.legal-document`).

## Decisión

Opción elegida: **B — `pluralName: "legal-terms"` → endpoint `/api/legal-terms`.**

Justificación:

- Resuelve el conflicto de arranque de Strapi 5 con el cambio mínimo posible.
- Preserva el UID interno `api::terms.terms`, por lo que ADR-011 §D1-A (`api::terms.terms.find`) **sigue siendo correcto sin cambios en código**; solo cambian ejemplos `curl`.
- Preserva el modelo de contenido completo de ADR-009 (atributos, relaciones, `body: blocks`, renderer, zod) — este ADR es un delta **puramente del nombre del endpoint REST**, no del content-type.
- Alinea `terms` con la convención kebab-case del repo (`form-fields`, `plans`).

### Supersede acotado

Este ADR **supersede solo el fragmento** de ADR-009 §Esquema concreto que fija `pluralName: 'terms'` y los ejemplos de URL `/api/terms`. Todo lo demás de ADR-009 permanece vigente (D1, D2, D3, D4, D5, schema zod, renderer, validación de enlaces, tolerancia a nodos desconocidos, camino de evolución).

Igualmente, actualiza las referencias de URL en ADR-011 (§Query canónica del front y §Validación `curl`) de `/api/terms` a `/api/legal-terms`. El cambio no afecta la decisión D1/D2/D3 de ADR-011: el permiso sigue siendo `api::terms.terms.find`, el modo sigue siendo aditivo, la constante sigue siendo `PUBLIC_READ_V3`.

### Esquema resultante (concreto)

```json
// apps/cms/src/api/terms/content-types/terms/schema.json
{
  "kind": "collectionType",
  "collectionName": "terms_documents",
  "info": {
    "singularName": "terms",
    "pluralName": "legal-terms",
    "displayName": "Terms"
  },
  ...
}
```

- UID interno: `api::terms.terms` (sin cambios → ADR-011 §D1-A intacta).
- Nombre de colección en BD: `terms_documents` (sin cambios).
- Endpoint REST público: `/api/legal-terms`.
- Permiso del rol Public (ADR-011): `api::terms.terms.find` (sin cambios).

### Query canónica del front (actualizada)

```
GET /api/legal-terms
  ?filters[country][code][$eq]=CO
  &sort=effectiveDate:desc,updatedAt:desc
  &pagination[limit]=1
  &populate[country]=true
```

- Sin `Authorization` ni `Api-Token` (CLAUDE.md §7, ADR-003).
- `populate[country]=true`, nunca `populate=*` (ADR-003 §D4).
- Resto idéntico a ADR-009 §Query canónica.

### Consecuencias

- ✅ Positiva: desbloquea AC-03.3 en runtime real — Strapi 5 arranca y `/api/legal-terms` responde `200`.
- ✅ Positiva: homogeneidad con otros content-types del repo (`form-fields`, `plans`, `legal-terms`).
- ✅ Positiva: cero impacto en modelo de contenido, zod, renderer, bootstrap de permisos y UID interno. El delta es puramente de URL pública.
- ✅ Positiva: formaliza la gobernanza — ADR-009 y ADR-011 quedan consistentes con el código vía changelog + supersede acotado.
- ⚠️ Negativa: ADR-009 §Esquema concreto, §Consecuencias y §Validación todavía citan `/api/terms` en el cuerpo del documento (no se edita el ADR aceptado). → Mitigación: entrada en el changelog de ADR-009 que remite a este ADR; cualquier lector futuro ve el changelog al pie.
- ⚠️ Negativa: ADR-011 §Query canónica y §Validación citan `/api/terms` en sus ejemplos `curl`. → Mitigación: se amenda ADR-011 con una nota + reemplazo de los `curl` por `/api/legal-terms` (ADR-011 no está `superseded`; se añade una nota que referencia este ADR-012).
- ⚠️ Negativa: cualquier documentación externa, comentario de código viejo, o test de integración legacy que busque `/api/terms` fallará con 404 contra el CMS real. → Mitigación: la base de código activa (`apps/cms`, `apps/web`, `e2e/`) ya está alineada en `/api/legal-terms`; los tests de integración del CMS que ADR-011 §Validación pide se escribirán directamente contra `/api/legal-terms` (ver §Validación).
- ⚠️ Negativa: el singular del content-type (`singularName: "terms"`) y el plural (`legal-terms`) ya no comparten prefijo; alguien que lea solo el schema podría confundirse. → Mitigación: `description` del `schema.json` referencia ADR-009 y ADR-011; este ADR-012 se linka desde el changelog de ADR-009.
- ⚠️ Negativa: la causa raíz del conflicto Strapi 5 (`users-permissions` vs. core admin vs. una convención interna) no está completamente diagnosticada aquí — se documenta como "conflicto observado durante arranque". → Mitigación: aceptable porque la decisión (opción B) es defensiva y no depende del diagnóstico exacto; si en el futuro Strapi corrige el conflicto, cambiar de vuelta a `terms` no es prioritario (opción B es mejor por convención igualmente).

### Validación

- **Grep en CI** (checklist de review): `grep -R "pluralName" apps/cms/src/api/terms` devuelve exactamente `"pluralName": "legal-terms"`. Si vuelve a aparecer `"pluralName": "terms"`, fallar el build.
- **Grep en CI**: `grep -R "/api/terms" apps/web/src` devuelve 0 resultados (excepto comentarios/tests que explícitamente nombren ambos). La ruta activa es `/api/legal-terms`.
- **Test de integración HTTP del CMS** (pendiente, pedido por ADR-011 §Validación y por recomendación F-03-1.2): `curl /api/legal-terms?filters[country][code][$eq]=CO&populate[country]=true` sin token → `200` + al menos un documento del seed; `curl /api/legal-terms/<documentId>` sin token → `403` (el rol Public tiene solo `find`, no `findOne`).
- **Test Playwright existente** (`apps/web/e2e/paso-3.spec.ts`): intercepta `**/api/legal-terms**` y verifica AC-03.3, AC-03.10, AC-03.11, AC-03.12. Ya está en verde.
- **Revisión manual en HITL-3 (ya ocurrida):** HITL-3 aprobó la Opción A de F-03-1.2 — crear este ADR y amendar ADR-009 + ADR-011. La creación de este ADR y las enmiendas correspondientes son la evidencia de cumplimiento.
- **Post-merge:** actualizar `docs/traceability.md` para que ADR-012 aparezca en la columna de ADRs relacionados a AC-03.3.

## Pros y contras de las opciones

### A — Mantener `pluralName: "terms"` y patchear rutas de Strapi
- ✅ URL canónica idéntica a ADR-009 original.
- ❌ Invasivo, frágil entre upgrades, amplifica la superficie de seguridad del rol Public.
- ❌ Riesgo/esfuerzo alto para beneficio cosmético.

### B — `pluralName: "legal-terms"` (elegida)
- ✅ Cambio mínimo (una línea en schema + una en el cliente HTTP + una en el e2e).
- ✅ Preserva UID interno `api::terms.terms` → ADR-011 §D1 intacta.
- ✅ Alineado con la convención kebab-case del repo.
- ✅ Nombre más descriptivo para el admin.
- ❌ Obliga a enmendar ADR-009 (changelog) y ADR-011 (ejemplos) — resuelto por este ADR.

### C — Renombrar el content-type entero
- ✅ Homogeneidad total en toda la cadena (singular + plural + UID + directorio + colección BD).
- ❌ Disruptivo: cambia UID (impacta ADR-011), nombre de directorio, nombre de colección en BD, requiere migración si hay datos.
- ❌ Beneficio marginal frente a B porque el UID es invisible al usuario final.

## Nueva dependencia

Este ADR **no introduce dependencias nuevas**. Es un cambio de nombre en `apps/cms/src/api/terms/content-types/terms/schema.json` y propagación mecánica a `apps/web/src/app/core/strapi.client.ts` + `apps/web/e2e/paso-3.spec.ts`. No añade librerías, no cambia zod, no cambia el renderer, no cambia el bootstrap de permisos.

## Camino de evolución

- **Diagnóstico completo del conflicto Strapi 5:** si en el futuro se investiga a fondo y se identifica el componente exacto (plugin `users-permissions`, admin API, o convención del core), actualizar este ADR con una nota al pie o abrir un issue upstream. No es urgente.
- **Upgrade de Strapi:** si una versión futura de Strapi 5 elimina el conflicto, revisar si vale la pena volver a `pluralName: "terms"`. Probablemente no: `legal-terms` es mejor por convención igualmente. En cualquier caso, cualquier cambio requiere nuevo ADR.
- **Nuevos content-types con nombres genéricos:** aplicar la lección → preferir kebab-case descriptivo (`legal-terms`, `payment-methods`) sobre nombres cortos (`terms`, `payments`) que pueden colisionar con el core de Strapi.
- **Equipo de 5 personas:** añadir al checklist de PR para nuevos content-types: *"¿tu `pluralName` es una palabra genérica (`terms`, `users`, `files`, `media`)? → prueba `docker compose up --build` desde limpio y confirma que arranca sin errores antes de abrir el PR."*
- **Migración de datos:** no aplica; el `collectionName` en BD (`terms_documents`) no cambia, solo cambia la URL pública.
