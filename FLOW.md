# Flujo agéntico — Seguro Auto Multi-País

Este documento describe el proceso completo seguido para diseñar, implementar y validar el wizard de cotización usando agentes de IA especializados (Claude Code con subagentes).

---

## Diagrama del flujo

```
┌─────────────┐
│   US-0X.md  │  Historia de usuario (entrada, no se edita)
└──────┬──────┘
       │
       ▼
┌──────────────────┐    HITL-1
│  [spec-writer]   │◄──────────── Humano aprueba spec
│  SPEC-0X.md      │              (status: approved)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐    HITL-2
│  [architect]     │◄──────────── Humano acepta ADRs
│  ADR-00N.md      │              (status: accepted)
└──────┬───────────┘
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
┌──────────────────┐           ┌──────────────────┐
│  [cms-builder]   │           │[frontend-builder]│
│  apps/cms/       │           │  apps/web/       │
└──────┬───────────┘           └──────┬───────────┘
       └────────────┬──────────────────┘
                    │
                    ▼
           ┌──────────────────┐
           │ [test-engineer]  │
           │ unit + e2e tests │
           └──────┬───────────┘
                  │
                  ▼
           ┌──────────────────┐    HITL-3
           │ [code-reviewer]  │◄──── Humano decide cada hallazgo
           │  REV-0X-N.md     │      (opción A: corregir / B: aceptar)
           └──────┬───────────┘
                  │
                  │  si hallazgos critical/major → loop de fixes → re-review
                  │
                  ▼
           HITL-4: checklist de entrega a QA
```

---

## Paso a paso por historia

### US-01 — Formulario configurable

| Paso | Agente | Artefacto | HITL |
|------|--------|-----------|------|
| Spec | spec-writer | `specs/SPEC-01.md` | HITL-1: aprobada |
| ADRs | architect | `docs/adr/ADR-001` a `ADR-006` | HITL-2: aceptados |
| CMS | cms-builder | `apps/cms/` — content type `form-field`, seed CO/CL | — |
| Front | frontend-builder | `ApplicantFormComponent`, `FieldRendererComponent`, registry de validadores | — |
| Tests | test-engineer | 147 unit tests, 25 e2e (Playwright + axe) | — |
| Review | code-reviewer | `reviews/REV-01-1.md` | HITL-3: fixes aplicados |

### US-02 — Planes por país

| Paso | Agente | Artefacto | HITL |
|------|--------|-----------|------|
| Spec | spec-writer | `specs/SPEC-02.md` | HITL-1: aprobada |
| ADRs | architect | `docs/adr/ADR-007`, `ADR-008` | HITL-2: aceptados |
| CMS | cms-builder | content type `plan`, seed CO/CL | — |
| Front | frontend-builder | `PlansComponent` — radiogroup con roving tabindex, precios por país | — |
| Tests | test-engineer | unit + 36 e2e | — |
| Review × 2 | code-reviewer | `reviews/REV-02-1.md`, `REV-02-2.md` | HITL-3: todos los hallazgos resueltos |

Hallazgos relevantes de US-02:
- **F-02-1.2 (critical)**: patrón WAI-ARIA radiogroup no implementado → se añadió roving tabindex + navegación con flechas (`ArrowRight/Down/Left/Up`, `Home`, `End`).
- **F-02-1.3 (major)**: `aria-label` sobreescribía todo el contenido para lectores de pantalla → reemplazado por `aria-labelledby` apuntando al `h2`, badge y precio del plan.

### US-03 — Resumen y pago simulado

| Paso | Agente | Artefacto | HITL |
|------|--------|-----------|------|
| Spec | spec-writer | `specs/SPEC-03.md` | HITL-1: aprobada |
| ADRs | architect | `docs/adr/ADR-009` a `ADR-012` | HITL-2: aceptados |
| CMS | cms-builder | content type `terms` / `legal-terms`, seed CO/CL | — |
| Front | frontend-builder | `SummaryComponent`, `ConfirmacionComponent`, `PaymentService`, `confirmacionGuard`, renderer de bloques Strapi | — |
| Tests | test-engineer | unit + 48 e2e | — |
| Review × 2 | code-reviewer | `reviews/REV-03-1.md`, `REV-03-2.md` | HITL-3: todos los hallazgos resueltos |

Hallazgos relevantes de US-03:
- **F-03-1.1 (critical)**: documento de identidad completo aparecía en el DOM → función `isDocumentKey()` con prefix-match para enmascarar últimos 4 dígitos.
- **F-03-1.3 (major)**: resumen sin separación titular/vehículo → `SummaryComponent` divide en secciones usando campo `section` del `FormField` de Strapi.
- **F-03-1.4 (major)**: confirmación en la misma ruta que el pago → ruta `/:country/confirmacion` con `ConfirmacionComponent` y `confirmacionGuard` (ADR-010 §D3-A).

---

## Decisiones de diseño transversales

### Multi-subagente en paralelo

Para los ciclos de fix en HITL-3, los 10 hallazgos de REV-02-1 y REV-03-1 se distribuyeron entre 5 agentes en worktrees Git aislados, cada uno con ownership exclusivo de archivos para garantizar cero conflictos de merge:

| Agente | Archivos |
|--------|---------|
| Agent 1 (US-02 plans) | `plans.component.ts` — WAI-ARIA radiogroup |
| Agent 2 (US-02 tests) | `paso-2.spec.ts`, `wizard-step.guard.spec.ts` |
| Agent 3 (US-03 overhaul) | `summary.component.ts`, `wizard.store.ts`, `confirmacion.*`, `document-mask.ts`, `form-field.schema.ts` |
| Agent 4 (ADR) | `docs/adr/ADR-012-*.md` |
| Agent 5 (CMS terms schema) | `apps/cms/src/api/terms/` |

Los 4 worktrees se mergearon en master sin conflictos.

### Invariante de seguridad (ADR-005)

`WizardStore` usa `@ngrx/signals` y vive exclusivamente en memoria. Ningún campo del formulario (RUT, cédula, placa) se persiste en `localStorage` ni `sessionStorage`. La decisión está justificada en ADR-005 y auditada en todos los code reviews.

### Tolerancia a fallos de Strapi (ADR-006)

Toda respuesta de red pasa por un schema Zod con `safeParse`. Campos desconocidos se descartan y se loguean con `logStructured()`; la app nunca rompe por un campo nuevo en Strapi. Los validadores custom (`rut`, `cedula_co`, `placa_co`, `patente_cl`, etc.) se registran en un `ValidatorRegistry` que resuelve por nombre de regla, igual que lo configura Strapi.

---

## Preguntas de reflexión

### 1. ¿Qué parte del flujo agéntico fue más difícil de hacer funcionar y por qué?

La parte más difícil fue **la coordinación de ownership de archivos en el ciclo de fixes en paralelo**. Cuando hay 5 agentes en worktrees simultáneos, el riesgo de conflicto existe aunque sea pequeño. La solución fue diseñar el plan de distribución antes de lanzar los agentes: cada agente recibía un conjunto de archivos con intersección vacía con los demás. Esto requería conocer el grafo de dependencias del código antes de asignar tareas.

La segunda dificultad fue **la iteración review → fix → re-review**. El patrón WAI-ARIA de radiogroup (roving tabindex, `aria-checked`, navegación con flechas) tiene muchos detalles sutiles — `setTimeout(0)` para diferir `.focus()` antes de que Playwright pueda verificarlo, el comportamiento de `Space` vs `Enter`, y la diferencia entre `aria-label` y `aria-labelledby` para lectores de pantalla. Tomó dos rondas de review (REV-02-1 → REV-02-2) para cerrar todos los hallazgos críticos.

### 2. ¿Qué harías diferente si lo hicieras otra vez?

**Incluir el `section` del campo en el content model desde la spec de US-01.** El campo `section: 'applicant' | 'vehicle'` que usa `SummaryComponent` para dividir el resumen fue un hueco detectado en US-03 (G-03.5). Si se hubiera definido en SPEC-01 junto con el content model de `form-field`, el schema Zod, el seed y el fixture de tests habrían sido correctos desde el principio, eliminando un ciclo de retroalimentación tardío y las modificaciones a `wizard.store.ts` para cambiar `applicantFieldsSnapshot` de `string[]` a `FormField[]`.

**Crear un ADR de test strategy antes de la primera historia.** La decisión de usar Playwright con mocks HTTP (en lugar de integration tests contra Strapi real) no está documentada en ningún ADR. Fue una elección implícita del `test-engineer`. Documentarla habría acelerado las decisiones posteriores sobre fixtures y granularidad de tests.

### 3. ¿Cómo escalarías esto a un equipo de 5 personas?

**Governance del contexto global:** `CLAUDE.md` juega el rol de "contrato de equipo". En un equipo de 5, este archivo se versiona, se revisa en PR, y cualquier cambio requiere aprobación de al menos 2 personas — igual que un ADR. Esto evita que un agente mal configurado produzca código inconsistente con el resto.

**Paralelismo por historia, serialismo por historia:** el modelo funciona bien cuando cada persona lleva una historia de principio a fin (spec → ADR → CMS → front → test → review). Las dependencias entre historias (US-02 necesita el `WizardStore` de US-01; US-03 necesita el `selectedPlan` de US-02) se manejan con interfaces publicadas en la spec antes de que empiece la historia dependiente.

**Revisión cruzada obligatoria:** cada `code-reviewer` debería ser una persona diferente a quien implementó. En la prueba, el mismo LLM hizo review de su propio código, lo que redujo la tasa de detección de problemas sutiles (ej. el campo `section` que faltaba). En un equipo real, la revisión cruzada entre personas tiene valor independiente del agente.

**Automatización de HITL:** los checks de HITL-4 (lint verde, e2e verde, traceability completa, sin hallazgos critical/major abiertos) se pueden convertir en un CI job que bloquea el merge automáticamente. El humano solo toma decisiones que requieren juicio — aceptar un requisito ambiguo, priorizar un hallazgo, aprobar una excepción de seguridad.
