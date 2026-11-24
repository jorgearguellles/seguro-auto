---
name: strapi-content-model
description: Modelo de contenido multi-país de Strapi 5, permisos del rol Public en código y patrón de seed idempotente para apps/cms. Úsala antes de crear o modificar tipos de contenido, permisos o seed.
---

# Modelo de contenido Strapi (apps/cms)

> Fuente de las decisiones: ADR-001 (multi-país) y ADR-003 (seguridad). Si se aceptan con otro diseño, actualiza esta skill primero.

## 1. Modelo (propuesta base, ADR-001 opción B)

**`country`** (colección)
| Campo | Tipo | Notas |
|---|---|---|
| code | enumeration `CO`,`CL` · unique | clave de negocio |
| name | string | |
| locale | string | `es-CO`, `es-CL` (para `Intl`) |
| currency | enumeration `COP`,`CLP` | |
| termsAndConditions | blocks (rich text) | US-03 |
| documentMask | json | p. ej. `{ "visibleLast": 4 }` |

**`form-field`** (colección, Draft & Publish **activo**)
| Campo | Tipo | Notas |
|---|---|---|
| key | string | id técnico estable (`documentNumber`, `plate`) |
| label | string | |
| type | enumeration `text`,`number`,`select`,`date`,`checkbox` | |
| section | enumeration `applicant`,`vehicle` | agrupa visualmente |
| required | boolean | |
| helpText | text | |
| errorMessage | string | mensaje por defecto |
| order | integer | |
| options | component repetible `field.option` (`label`, `value`) | solo `select` |
| validations | component repetible `field.validation` | ver abajo |
| country | relation manyToOne → country | |

**Componente `field.validation`**: `rule` (enumeration: `minLength`, `maxLength`, `pattern`, `min`, `max`, `email`, `rutCL`, `cedulaCO`, `plateCO`, `plateCL`, `vehicleYear`, `minAge`) · `params` (json) · `errorMessage` (string, opcional).

**`plan`** (colección, Draft & Publish **activo**)
| Campo | Tipo |
|---|---|
| name | string |
| shortDescription | text |
| basePrice | integer (pesos, sin decimales) |
| coverages | component repetible `plan.item` (`title`, `description`) |
| benefits | component repetible `plan.item` |
| order | integer |
| recommended | boolean |
| active | boolean |
| country | relation manyToOne → country |

La moneda **no** se guarda en el plan: sale de `country` para evitar inconsistencias.

## 2. Consultas que el front puede hacer

```
GET /api/countries?fields[0]=code&fields[1]=name&fields[2]=locale&fields[3]=currency
GET /api/form-fields?filters[country][code][$eq]=CO&sort=order:asc&populate[options]=true&populate[validations]=true
GET /api/plans?filters[country][code][$eq]=CO&filters[active][$eq]=true&sort=order:asc&populate[coverages]=true&populate[benefits]=true
GET /api/countries?filters[code][$eq]=CO&fields[0]=termsAndConditions&fields[1]=documentMask
```
Sin `status` en la query, la API REST de Strapi 5 devuelve solo lo **publicado**. No usar `populate=*`.

## 3. Permisos del rol Public — en código (ADR-003)

`PUBLIC_READ_V1` = solo `country.find` + `form-field.find`. `plan.find` se agrega en el ADR de US-02. Agregar un permiso requiere nuevo ADR o supersede de ADR-003.

```ts
// apps/cms/src/index.ts
const PUBLIC_READ_V1: readonly string[] = [
  'api::country.country.find',
  'api::form-field.form-field.find',
  // plan.find → ADR de US-02
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

Modo **aditivo**: el bootstrap no borra permisos añadidos a mano en el admin (aceptado para v1). Nunca `findOne`, `create`, `update` ni `delete` para Public salvo ADR que lo justifique.

## 4. Seed idempotente

- Clave natural por entidad: `country.code`, `form-field.key + country`, `plan.name + country`.
- Patrón: `findFirst({ filters })` → si no existe, `create({ data, status: 'published' })`.
- Se ejecuta en cada arranque; nunca duplica ni pisa cambios hechos por negocio en el admin.
- Datos ficticios con formato válido (RUT con dígito verificador correcto, placas válidas).
- Incluir a propósito: 1 plan `active: false` por país (para probar el filtro) y 1 plan `recommended: true` por país.

## 5. Checklist para agregar un tipo de contenido

1. ¿Está justificado por una spec aprobada?
2. Schema + componentes.
3. ¿Necesita lectura pública? → agregar a `PUBLIC_READ_VN` en `bootstrap()` + nuevo ADR o supersede de ADR-003.
4. Seed CO y CL.
5. Verificación con `curl` de lo que expone.
6. Actualizar esta skill.
