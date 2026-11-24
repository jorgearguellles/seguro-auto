# Matriz de trazabilidad

> Generado automáticamente por `scripts/traceability.mjs` el 2026-11-24.
> No editar a mano — regenerar con `node scripts/traceability.mjs`.

## Resumen por historia

| Historia | ACs | Unit ✓ | E2e ✓ | Sin test |
|----------|-----|--------|-------|----------|
| US-01 | 15 | 10 | 10 | 0 |

## Detalle por AC

| AC | Título | ADRs | Commits | Unit tests | E2e tests | Reviews |
|----|--------|------|---------|------------|-----------|---------|
| AC-01.1 | Formulario configurado por país | ADR-001, ADR-002 | f49cc7d | `form-field.schema.spec.ts`, `country.guard.spec.ts` | `paso-1.spec.ts` | REV-01-1 |
| AC-01.2 | Mensaje de error configurado por campo | ADR-001, ADR-004 | — | `validator-registry.spec.ts` | `paso-1.spec.ts` | REV-01-1 |
| AC-01.3 | Campos obligatorios bloquean el avance | ADR-004 | — | `validator-registry.spec.ts` | `paso-1.spec.ts` | REV-01-1 |
| AC-01.4 | Reflejo de cambios de Strapi sin despliegue | ADR-001, ADR-002, ADR-003, ADR-005 | — | — | `paso-1.spec.ts` | REV-01-1 |
| AC-01.5 | Persistencia entre pasos | ADR-005 | — | `wizard.store.spec.ts` | `paso-1.spec.ts` | REV-01-1 |
| AC-01.6 | Año del vehículo en rango (agregado) | ADR-004 | — | `cedula-co.spec.ts`, `plate-cl.spec.ts`, `plate-co.spec.ts`, `vehicle-year.spec.ts` | — | REV-01-1 |
| AC-01.7 | Mayoría de edad del titular (agregado) | ADR-004 | — | `min-age.spec.ts`, `rut-cl.spec.ts` | — | REV-01-1 |
| AC-01.8 | Opciones de select cargadas desde Strapi (agregado) | ADR-001, ADR-006 | — | `form-field.schema.spec.ts` | — | REV-01-1 |
| AC-01.9 | Estado de carga del formulario (agregado) | — | — | — | `paso-1.spec.ts` | REV-01-1 |
| AC-01.10 | Error de red al cargar la configuración (agregado) | — | — | — | `paso-1.spec.ts` | REV-01-1 |
| AC-01.11 | Estado vacío de configuración (agregado) | ADR-006 | — | `form-field.schema.extra.spec.ts` | `paso-1.spec.ts` | REV-01-1 |
| AC-01.12 | Campo desconocido se ignora sin romper la app (agregado) | ADR-001, ADR-004, ADR-006 | — | `form-field.schema.extra.spec.ts`, `form-field.schema.spec.ts` | — | REV-01-1 |
| AC-01.13 | Accesibilidad por teclado y lector de pantalla (agregado) | ADR-004 | — | — | `paso-1.spec.ts` | REV-01-1 |
| AC-01.14 | Responsive 375 px y 1280 px (agregado) | ADR-004 | — | — | `paso-1.spec.ts` | REV-01-1 |
| AC-01.15 | Solo se consumen campos publicados (agregado) | ADR-001, ADR-003, ADR-006 | f49cc7d | `form-field.schema.extra.spec.ts` | — | REV-01-1 |

## Implementación por archivo

| Archivo | ACs que cubre |
|---------|---------------|
| `apps/cms/src/index.ts` | AC-01.15, AC-01.4 |
| `apps/cms/src/seed.ts` | AC-01.1, AC-01.15, AC-01.5, AC-01.8 |
| `apps/web/src/app/core/schemas/form-field.schema.ts` | AC-01.1, AC-01.12, AC-01.15, AC-01.8 |
| `apps/web/src/app/core/strapi.client.ts` | AC-01.1, AC-01.15, AC-01.4 |
| `apps/web/src/app/features/applicant-form/applicant-form.component.ts` | AC-01.1, AC-01.10, AC-01.11, AC-01.12, AC-01.13, AC-01.14, AC-01.15, AC-01.2, AC-01.3, AC-01.4, AC-01.5, AC-01.8, AC-01.9 |
| `apps/web/src/app/features/applicant-form/field-error.component.ts` | AC-01.13, AC-01.2 |
| `apps/web/src/app/features/applicant-form/field-renderer.component.ts` | AC-01.13, AC-01.2, AC-01.8 |
| `apps/web/src/app/validators/cedula-co.ts` | AC-01.6 |
| `apps/web/src/app/validators/min-age.ts` | AC-01.7 |
| `apps/web/src/app/validators/plate-cl.ts` | AC-01.6 |
| `apps/web/src/app/validators/plate-co.ts` | AC-01.6 |
| `apps/web/src/app/validators/rut-cl.ts` | AC-01.7 |
| `apps/web/src/app/validators/vehicle-year.ts` | AC-01.6 |
| `apps/web/src/app/wizard/wizard.store.ts` | AC-01.4, AC-01.5 |
