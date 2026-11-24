# Matriz de trazabilidad

> Generado automáticamente por `scripts/traceability.mjs` el 2026-11-24.
> No editar a mano — regenerar con `node scripts/traceability.mjs`.

## Resumen por historia

| Historia | ACs | Unit ✓ | E2e ✓ | Sin test |
|----------|-----|--------|-------|----------|
| US-01 | 15 | 10 | 10 | 0 |
| US-02 | 16 | 9 | 16 | 0 |
| US-03 | 17 | 9 | 17 | 0 |

## Detalle por AC

| AC | Título | ADRs | Commits | Unit tests | E2e tests | Reviews |
|----|--------|------|---------|------------|-----------|---------|
| AC-01.1 | Formulario configurado por país | ADR-001, ADR-002 | f49cc7d | `form-field.schema.spec.ts`, `country.guard.spec.ts` | `paso-1.spec.ts` | REV-01-1 |
| AC-01.2 | Mensaje de error configurado por campo | ADR-001, ADR-004 | 08a8219 | `validator-registry.spec.ts` | `paso-1.spec.ts` | REV-01-1 |
| AC-01.3 | Campos obligatorios bloquean el avance | ADR-004 | — | `validator-registry.spec.ts` | `paso-1.spec.ts` | REV-01-1 |
| AC-01.4 | Reflejo de cambios de Strapi sin despliegue | ADR-001, ADR-002, ADR-003, ADR-005 | — | — | `paso-1.spec.ts` | REV-01-1 |
| AC-01.5 | Persistencia entre pasos | ADR-005 | 08a8219 | `wizard.store.spec.ts` | `paso-1.spec.ts` | REV-01-1 |
| AC-01.6 | Año del vehículo en rango (agregado) | ADR-004 | — | `cedula-co.spec.ts`, `plate-cl.spec.ts`, `plate-co.spec.ts`, `vehicle-year.spec.ts` | — | REV-01-1 |
| AC-01.7 | Mayoría de edad del titular (agregado) | ADR-004 | — | `min-age.spec.ts`, `rut-cl.spec.ts` | — | REV-01-1 |
| AC-01.8 | Opciones de select cargadas desde Strapi (agregado) | ADR-001, ADR-006 | — | `form-field.schema.spec.ts` | — | REV-01-1 |
| AC-01.9 | Estado de carga del formulario (agregado) | — | — | — | `paso-1.spec.ts` | REV-01-1 |
| AC-01.10 | Error de red al cargar la configuración (agregado) | — | — | — | `paso-1.spec.ts` | REV-01-1 |
| AC-01.11 | Estado vacío de configuración (agregado) | ADR-006 | — | `form-field.schema.extra.spec.ts` | `paso-1.spec.ts` | REV-01-1 |
| AC-01.12 | Campo desconocido se ignora sin romper la app (agregado) | ADR-001, ADR-004, ADR-006, ADR-009 | — | `form-field.schema.extra.spec.ts`, `form-field.schema.spec.ts` | — | REV-01-1 |
| AC-01.13 | Accesibilidad por teclado y lector de pantalla (agregado) | ADR-004 | 08a8219, 3952b96 | — | `paso-1.spec.ts` | REV-01-1 |
| AC-01.14 | Responsive 375 px y 1280 px (agregado) | ADR-004 | — | — | `paso-1.spec.ts` | REV-01-1 |
| AC-01.15 | Solo se consumen campos publicados (agregado) | ADR-001, ADR-003, ADR-006, ADR-009 | f49cc7d | `form-field.schema.extra.spec.ts` | — | REV-01-1 |
| AC-02.1 | Planes del país activo, publicados y activos | ADR-007, ADR-008 | c979c44, d3c8b3a, 5b466c2, 3086a6b | `plan.schema.spec.ts` | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.2 | Formato de precio por país | ADR-007 | — | `pricing.spec.ts` | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.3 | Ajuste de precio por antigüedad del vehículo | ADR-007 | — | `pricing.spec.ts` | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.4 | Plan recomendado distinguido visualmente | ADR-007 | 7983b2a | — | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.5 | Selección única de plan | — | — | `wizard.store.spec.ts` | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.6 | Avanzar al paso 3 requiere selección | — | — | — | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.7 | Persistencia de la selección entre pasos | ADR-007 | 395e9fa, 66072ec, 1dabb27 | `wizard.store.spec.ts` | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.8 | Volver al paso 1 no pierde datos (agregado) | — | — | — | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.9 | Guard de acceso al paso 2 (agregado) | — | 395e9fa, 66072ec, 1dabb27 | `wizard-step.guard.spec.ts` | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.10 | Estado de carga de los planes (agregado) | — | — | — | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.11 | Error de red al cargar los planes (agregado) | ADR-008 | — | — | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.12 | Sin planes disponibles | ADR-007, ADR-008 | — | — | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.13 | Plan corrupto se descarta sin romper la lista (agregado) | ADR-007, ADR-008 | — | `plan.schema.spec.ts` | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.14 | Accesibilidad por teclado y lector de pantalla (agregado) | — | — | `plans.component.spec.ts` | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.15 | Responsive 375 px y 1280 px (agregado) | — | — | — | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-02.16 | Moneda del plan coherente con el país (agregado) | ADR-007 | c979c44, d3c8b3a, 5b466c2, 3086a6b | `plan.schema.spec.ts` | `paso-2.spec.ts` | REV-02-1, REV-02-2 |
| AC-03.1 | Resumen completo | — | 395e9fa, 2a6ff9e, 89a8567, c979c44, fd01604, 3086a6b | — | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.2 | Documento enmascarado | — | — | `document-mask.spec.ts`, `mask-document.spec.ts` | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.3 | Términos por país desde Strapi | ADR-009, ADR-011, ADR-012 | 96540d2 | `terms.schema.spec.ts`, `url-safety.spec.ts` | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.4 | Botón de pago deshabilitado hasta aceptar términos | ADR-010 | — | — | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.5 | Pago exitoso muestra confirmación con número de cotización | ADR-010 | — | `payment.service.spec.ts`, `wizard.store.spec.ts` | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.6 | Pago rechazado muestra error y preserva datos | ADR-010 | — | `payment.service.spec.ts` | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.7 | No se puede enviar el pago dos veces | ADR-010 | — | `payment.service.spec.ts` | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.8 | Navegar a pasos anteriores conserva datos | — | — | — | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.9 | Guard de acceso directo al paso 3 (agregado) | — | — | `confirmacion.guard.spec.ts` | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.10 | Estado de carga de términos (agregado) | ADR-009, ADR-011, ADR-012 | 96540d2 | — | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.11 | Error de red al cargar términos (agregado) | ADR-009, ADR-011, ADR-012 | — | — | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.12 | Estado vacío de términos (agregado) | ADR-009, ADR-011, ADR-012 | — | `terms.schema.spec.ts` | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.13 | Precio final formateado por país (agregado) | — | — | — | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.14 | Accesibilidad por teclado y lector de pantalla (agregado) | ADR-009, ADR-010 | 395e9fa, 2a6ff9e, 89a8567 | — | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.15 | Responsive 375 px y 1280 px (agregado) | — | — | — | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.16 | El documento completo no aparece en el DOM (agregado) | — | — | `document-mask.spec.ts`, `mask-document.spec.ts` | `paso-3.spec.ts` | REV-03-1, REV-03-2 |
| AC-03.17 | Al salir de la confirmación el estado del wizard se limpia (agregado) | ADR-010 | 395e9fa, 2a6ff9e, 89a8567, c979c44, fd01604, 3086a6b | `confirmacion.guard.spec.ts` | `paso-3.spec.ts` | REV-03-1, REV-03-2 |

## Implementación por archivo

| Archivo | ACs que cubre |
|---------|---------------|
| `apps/cms/src/index.ts` | AC-01.15, AC-01.4, AC-02.1, AC-03.3 |
| `apps/cms/src/seed.ts` | AC-01.1, AC-01.15, AC-01.5, AC-01.8, AC-02.1, AC-02.2, AC-02.4, AC-03.3 |
| `apps/web/src/app/core/document-mask.ts` | AC-03.16, AC-03.2 |
| `apps/web/src/app/core/pricing.ts` | AC-02.2, AC-02.3 |
| `apps/web/src/app/core/schemas/form-field.schema.ts` | AC-01.1, AC-01.12, AC-01.15, AC-01.8 |
| `apps/web/src/app/core/schemas/plan.schema.ts` | AC-02.1, AC-02.13, AC-02.16 |
| `apps/web/src/app/core/schemas/terms.schema.ts` | AC-03.10, AC-03.11, AC-03.12, AC-03.3 |
| `apps/web/src/app/core/strapi.client.ts` | AC-01.1, AC-01.15, AC-01.4, AC-02.1, AC-03.10, AC-03.11, AC-03.12, AC-03.3 |
| `apps/web/src/app/core/system-messages.ts` | AC-02.10, AC-02.11, AC-02.12 |
| `apps/web/src/app/core/url-safety.ts` | AC-03.3 |
| `apps/web/src/app/features/applicant-form/applicant-form.component.ts` | AC-01.1, AC-01.10, AC-01.11, AC-01.12, AC-01.13, AC-01.14, AC-01.15, AC-01.2, AC-01.3, AC-01.4, AC-01.5, AC-01.8, AC-01.9 |
| `apps/web/src/app/features/applicant-form/field-error.component.ts` | AC-01.13, AC-01.2 |
| `apps/web/src/app/features/applicant-form/field-renderer.component.ts` | AC-01.13, AC-01.2, AC-01.8 |
| `apps/web/src/app/features/confirmacion/confirmacion.component.ts` | AC-03.14, AC-03.17, AC-03.5, AC-03.9 |
| `apps/web/src/app/features/plans/plans.component.ts` | AC-02.1, AC-02.10, AC-02.11, AC-02.12, AC-02.13, AC-02.14, AC-02.15, AC-02.16, AC-02.2, AC-02.3, AC-02.4, AC-02.5, AC-02.6, AC-02.7, AC-02.8, AC-02.9 |
| `apps/web/src/app/features/summary/payment.service.ts` | AC-03.5, AC-03.6, AC-03.7 |
| `apps/web/src/app/features/summary/summary.component.ts` | AC-03.1, AC-03.10, AC-03.11, AC-03.12, AC-03.13, AC-03.14, AC-03.15, AC-03.16, AC-03.17, AC-03.2, AC-03.3, AC-03.4, AC-03.5, AC-03.6, AC-03.7, AC-03.8, AC-03.9 |
| `apps/web/src/app/shared/terms-blocks-renderer/terms-blocks-renderer.component.ts` | AC-03.14, AC-03.3 |
| `apps/web/src/app/validators/cedula-co.ts` | AC-01.6 |
| `apps/web/src/app/validators/min-age.ts` | AC-01.7 |
| `apps/web/src/app/validators/plate-cl.ts` | AC-01.6 |
| `apps/web/src/app/validators/plate-co.ts` | AC-01.6 |
| `apps/web/src/app/validators/rut-cl.ts` | AC-01.7 |
| `apps/web/src/app/validators/vehicle-year.ts` | AC-01.6 |
| `apps/web/src/app/wizard/confirmacion.guard.ts` | AC-03.17, AC-03.9 |
| `apps/web/src/app/wizard/wizard-step.guard.ts` | AC-02.6, AC-02.9 |
| `apps/web/src/app/wizard/wizard.store.ts` | AC-01.4, AC-01.5, AC-02.5, AC-02.7, AC-03.17, AC-03.5 |
