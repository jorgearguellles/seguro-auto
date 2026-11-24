---
id: ADR-001
title: Modelo de contenido `form-field` en Strapi con componente repetible de validaciones
status: accepted
date: 2026-11-23
deciders: Jorge Argüelles
supersedes:
related: [SPEC-01, RN-01.1, RN-01.2, RN-01.7, RN-01.10, RN-01.11, RN-01.12, AC-01.1, AC-01.4, AC-01.8, AC-01.12, AC-01.15, G-01.2, G-01.3, G-01.4]
---

# ADR-001 — Modelo de contenido `form-field` en Strapi con componente repetible de validaciones

## Contexto y problema

SPEC-01 exige que negocio pueda configurar, publicar y reordenar el formulario del paso 1 sin desplegar (RN-01.1, RN-01.7, AC-01.4). El mismo build de Angular debe pintar el formulario de CO o de CL según el país activo (RN-01.9, AC-01.1). El contrato de contenido en §6 de SPEC-01 enumera los atributos necesarios: `label`, `type`, `required`, `helpText`, `errorMessage`, `order`, `validations`, `options`, `defaultValue`, `autocomplete`, y `country`.

Hay que decidir **cómo** se modela ese contrato en Strapi 5, en particular:

- Dónde vive el campo `validations` cuando RN-01.11 define un objeto con hasta 7 claves (`required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `custom`) y RN-01.12 restringe `custom` a un enum (`rut`, `cedula_co`, `placa_co`, `patente_cl`, `mayor_edad`, `anio_vehiculo`).
- Cómo se filtran campos por país (RN-01.9, AC-01.1) manteniendo el `populate` explícito que exige CLAUDE.md §7.
- Cómo se cumplen AC-01.12 (campo con `type` desconocido se ignora y loguea) y AC-01.15 (solo campos publicados).
- Cómo se habilitan las opciones de `select` (RN-01.2, AC-01.8) sin inflar `populate`.

Esta decisión es estructural: una vez haya contenido creado por negocio en el admin, migrar el schema es doloroso.

## Factores de decisión

- Negocio no técnico debe poder crear y editar campos desde el admin de Strapi sin tocar JSON a mano (RN-01.1).
- El contrato debe ser **tipable al 100 %** por el schema zod del front; sin `any` en Angular (CLAUDE.md §2).
- El rol Public solo tiene `find`; `populate` siempre explícito (CLAUDE.md §7).
- Solo campos publicados se consumen (AC-01.15); Strapi 5 oculta drafts por defecto en REST si no se pide `status=draft`.
- Catálogo cerrado de tipos y de validadores custom (RN-01.10, RN-01.11, RN-01.12) — hay que elegir dónde se declara el enum.
- La decisión debe sobrevivir a US-02 y US-03 (planes y pago), que también viven en Strapi.
- Simplicidad para evaluación: la opción más simple que cumple > la más ambiciosa.

## Opciones consideradas

1. **Opción A — `form-field` con `validations` como campo JSON opaco + `options` como componente repetible.** Un único content-type con `validations: json`. El front parsea ese JSON con zod. `options` se modela como componente repetible `field.option` embebido.
2. **Opción B — `form-field` con `validations` como componente repetible `field.validation` (una fila = una regla) + `options` como componente repetible.** Cada regla es una entrada con `rule` (enum), `params` (json pequeño), `errorMessage?` (opcional). Es la propuesta que ya figura en la skill `strapi-content-model`.
3. **Opción C — `form-field` + `validation-rule` como content-type separado con relación `oneToMany`.** Las reglas son entidades de primera clase, reutilizables entre campos.

## Decisión

Opción elegida: **Opción B — componente repetible `field.validation` + componente repetible `field.option`**, porque:

- Da al usuario de negocio una UI nativa en Strapi (dropdown con el enum de reglas, campo params como JSON pequeño por regla) en vez de pedirle que escriba un objeto JSON entero (lo que haría Opción A difícil de usar y propenso a errores de tipeo que romperían zod).
- Mantiene las reglas acopladas al campo (no son reutilizables entre campos — y SPEC-01 no lo requiere), evitando la indirección de Opción C que no aporta valor en v1.
- El enum de `rule` en Strapi puede espejarse 1:1 con el enum de zod en el front; si llega una regla no mapeada en el front, se ignora y se loguea (consistente con AC-01.12 aplicado también a reglas, no solo a tipos).
- Cumple `populate` explícito: la query es `populate[options]=true&populate[validations]=true`, nunca `populate=*`.
- El filtro por país se hace con `filters[country][code][$eq]=CO` usando la relación `manyToOne → country`, que ya se usa para `plan` y `country.termsAndConditions` en US-02/US-03.

### Esquema concreto

**Content-type `form-field`** (Draft & Publish activo, `uid: api::form-field.form-field`):

| Campo | Tipo Strapi | Obligatorio | Notas |
|---|---|---|---|
| `key` | string (unique por país) | sí | Slug estable (`documentNumber`, `plate`, `vehicleYear`). Es la `name` de SPEC-01 §6. |
| `label` | string | sí | |
| `type` | enumeration `text`, `number`, `select`, `date`, `checkbox` | sí | Enum cerrado (RN-01.10). |
| `section` | enumeration `applicant`, `vehicle` | sí | Agrupación visual; útil para US-02 también. |
| `required` | boolean | sí | Default `false`. |
| `helpText` | text | no | |
| `errorMessage` | string | sí | Mensaje por defecto del campo (RN-01.2/AC-01.2). |
| `order` | integer | sí | Orden ascendente (AC-01.1). |
| `defaultValue` | string | no | Serializado como string; el front lo castea según `type`. |
| `autocomplete` | string | no | Hint HTML (`name`, `bday`, etc.), ver G-01.14. |
| `options` | component repetible `field.option` | solo si `type=select` | Ver abajo. |
| `validations` | component repetible `field.validation` | no | Ver abajo. |
| `country` | relation `manyToOne → country` | sí | Filtro por país. |

**Componente `field.option`** (`category: field`): `label: string` (obligatorio), `value: string` (obligatorio), `order: integer` (default 0).

**Componente `field.validation`** (`category: field`):

| Campo | Tipo | Notas |
|---|---|---|
| `rule` | enumeration `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `rut`, `cedula_co`, `placa_co`, `patente_cl`, `mayor_edad`, `anio_vehiculo` | Enum cerrado = unión de claves de RN-01.11 + valores de `custom` en RN-01.12. Aplanado para que negocio no vea dos niveles. |
| `params` | json | Payload de la regla. Para `pattern`: `{ "regex": "^..." }`. Para `min/max/minLength/maxLength`: `{ "value": 18 }`. Para custom sin params: `{}` o null. |
| `errorMessage` | string | no obligatorio | Si viene, sobrescribe el `errorMessage` del campo solo para esta regla (más preciso que SPEC-01 §6, que solo menciona uno por campo; es compatible: si no viene, se usa el del campo). |

**Query canónica del front** (misma forma que en la skill `strapi-content-model` §2):

```
GET /api/form-fields
  ?filters[country][code][$eq]=CO
  &sort=order:asc
  &populate[options]=true
  &populate[validations]=true
```

Sin parámetro `status`, Strapi 5 devuelve solo publicados → cumple AC-01.15 sin lógica extra en el front.

### Consecuencias

- ✅ Positiva: UX del admin de negocio clara (una fila = una regla), el enum de reglas se valida en Strapi antes de guardar, menos riesgo de JSON mal tecleado llegue al front.
- ✅ Positiva: El contrato REST es estable y tipable con zod (ver ADR-006): `type` discrimina la variante del campo; `validations` es `Array<{rule, params, errorMessage?}>`.
- ✅ Positiva: Cumple RN-01.7/AC-01.4 nativamente: publicar en Strapi → recargar → aparece. Sin build.
- ✅ Positiva: Alineado con la skill `strapi-content-model` ya documentada.
- ⚠️ Negativa: Agregar una nueva regla custom implica (a) tocar el enum de `field.validation` en el schema de Strapi, (b) tocar el enum de zod en el front, (c) implementar el validador. Son 3 cambios de código + migración de Strapi. → Mitigación: el procedimiento queda documentado en la skill `strapi-content-model` §5; cualquier regla desconocida en el front se ignora + loguea (defensa en profundidad con zod).
- ⚠️ Negativa: Aplanar `custom` dentro del enum de `rule` significa que negocio ve 12 reglas en el mismo dropdown y puede elegir `rut` para un campo que no es documento. → Mitigación: el mensaje de error configurado por campo es la última red; además, el validador `rut` se aplica a strings y fallará siempre si se asigna a un `type: number`, lo que el equipo de negocio notará en el primer test manual. Se registra como riesgo aceptado para v1.
- ⚠️ Negativa: `defaultValue: string` para todos los tipos obliga a castear en el front (p. ej. `"true"` → `true` para checkbox). → Mitigación: el casteo vive en una sola función `parseDefaultValue(type, raw)` en `core/`, testeada por AC-01.8 para selects.
- ⚠️ Negativa: El filtro `filters[country][code][$eq]` depende de que el content-type `country` ya exista con `code` como enum. → Mitigación: el seed idempotente de Strapi crea `country` antes que `form-field` (orden establecido en la skill `strapi-content-model` §4).

### Validación

- Test de integración (`apps/cms` tests o smoke e2e): `curl /api/form-fields?filters[country][code][$eq]=CO&populate[options]=true&populate[validations]=true` devuelve un array no vacío con la forma esperada. Documentado como check en el `README` del CMS.
- Test unitario de parsing (apps/web, Vitest): dado un fixture con un campo `type=unknown`, el schema zod descarta ese campo, loguea, y devuelve el resto → verifica AC-01.12.
- Test unitario: un campo en `status=draft` no aparece en la respuesta de `/api/form-fields` (seed debe incluir un campo draft a propósito para esta prueba) → verifica AC-01.15.
- Revisión manual en HITL-2: el admin de Strapi muestra el enum de `rule` con las 12 opciones y permite editar `params` como JSON.
- Revisión de checklist (`review-checklist`): ningún endpoint del front usa `populate=*`.

## Pros y contras de las opciones

### Opción A — `validations` como JSON opaco

- ✅ Schema mínimo en Strapi: 0 componentes nuevos; solo un campo JSON.
- ✅ Flexibilidad máxima: agregar una regla nueva no requiere migrar el schema de Strapi.
- ❌ UX horrible para negocio: el editor tiene que escribir `{"required": true, "custom": "rut"}` a mano en un textarea. Un error de tipeo pasa la validación de Strapi pero rompe zod en el front, y el usuario final lo ve como un formulario que no carga.
- ❌ Pierde la validación nativa de Strapi sobre el enum de reglas; toda la validación cae en zod.
- ❌ Contradice el espíritu de RN-01.1 ("negocio configura sin desplegar y sin escribir código"); JSON crudo es efectivamente código.

### Opción B — Componente repetible `field.validation` (elegida)

- ✅ UI nativa de Strapi con dropdown por regla.
- ✅ Enum de reglas validado doblemente: en Strapi (en el admin) y en zod (en el front).
- ✅ Cada regla puede llevar su propio `errorMessage` opcional, útil si negocio quiere diferenciar "año fuera de rango" vs "año no numérico" en un mismo campo sin cambiar la regla custom.
- ❌ 2 componentes nuevos (`field.option`, `field.validation`) que hay que crear en Strapi.
- ❌ El payload REST crece ligeramente vs Opción A.

### Opción C — `validation-rule` como content-type separado

- ✅ Reglas reutilizables entre campos (p. ej. una regla `cedula_co` compartida).
- ✅ Negocio puede ajustar `params` o `errorMessage` de una regla globalmente.
- ❌ Overkill para v1: SPEC-01 no pide reutilización, y las reglas custom ya tienen semántica fija (RN-01.12) — negocio no debería "ajustarlas".
- ❌ Introduce un join (`populate[validations][populate][rule]=true`) que complica la query y aumenta carga en el CMS.
- ❌ Más ceremonia en el admin: crear reglas antes de poder usar campos → fricción extra para negocio.

## Camino de evolución

- **Más países (MX, PE):** `country` ya es una relación. Basta con agregar la fila en `country` y publicar los `form-field` correspondientes. El enum de `rule` crecería con validadores regionales (`curp_mx`, `dni_pe`).
- **Dependencias entre campos (G-01.8):** cuando negocio pida "el modelo depende de la marca", se agrega un campo `dependsOn: relation manyToOne → form-field` + `showWhen: json` al content-type. Compatible con el schema actual (migración aditiva).
- **Reglas reutilizables entre campos:** si en algún momento aparece esa necesidad real, se migra a Opción C con un ADR que supersede a este.
- **Equipo de 5 personas:** el procedimiento de "agregar una regla custom" se formaliza como checklist en PR.
