# Seguro Auto Multi-País

Wizard de cotización de seguro de auto para Colombia (CO) y Chile (CL). Formulario, planes y términos configurados en Strapi sin necesidad de redeploy.

## Requisitos

- Docker + Docker Compose v2
- Puertos **4200** (nginx/Angular) y **1337** (Strapi admin) libres

## Levantar el stack

```bash
docker compose up
```

Levanta tres servicios:

| Servicio | URL | Descripción |
|---|---|---|
| Wizard (Angular) | http://localhost:4200 | Entrada principal — redirige a `/co/paso-1` |
| Colombia | http://localhost:4200/co/paso-1 | Formulario CO |
| Chile | http://localhost:4200/cl/paso-1 | Formulario CL |
| Strapi admin | http://localhost:1337/admin | CMS (crear usuario en primer acceso) |

El seed corre automáticamente en el bootstrap de Strapi. Crea los campos de formulario, planes y términos de CO y CL listos para usar.

> Primera vez: el build tarda ~2–3 min. Strapi tarda ~90 s en arrancar. Cuando nginx esté healthy, todo está listo.

## Comandos de desarrollo

```bash
# Lint
npm --prefix apps/web run lint

# Tests unitarios (Vitest)
npm --prefix apps/web test

# Tests e2e (Playwright — requiere stack levantado con docker compose up)
npm --prefix apps/web run e2e

# Regenerar matriz de trazabilidad
node scripts/traceability.mjs
```

## Estado de implementación

| Historia | Descripción | Tests |
|---|---|---|
| US-01 | Formulario configurable de datos del titular y vehículo | ✅ 15/15 ACs |
| US-02 | Lista de planes por país con selección | ✅ 16/16 ACs |
| US-03 | Resumen, pago simulado y confirmación | ✅ 17/17 ACs |

**Totales:** 266 unit tests (Vitest) · 109 e2e tests (Playwright + axe-core) · lint 0 warnings.

Ver `docs/traceability.md` para la matriz completa US → AC → commit → test.

## Requisitos no cumplidos

Ninguno. Las tres historias de usuario están implementadas en su totalidad. Los criterios de aceptación con `(agregado)` en la spec surgieron del análisis de huecos (G-0X.N) y fueron aprobados por el humano en HITL-1 antes de implementarse.

Herramientas de plan de pago usadas: ninguna. Toda la toolchain (Angular, Strapi, Docker, Playwright, Vitest, axe-core) es open-source o gratuita.

## Arquitectura

```
apps/web/    Angular 21 — standalone, signals, OnPush, inject()
apps/cms/    Strapi 5 — SQLite dev, seed idempotente CO/CL
nginx/       Proxy único en :4200 → /api → CMS, /* → Angular
```

**Decisiones clave (ver `docs/adr/`):**

| ADR | Decisión |
|---|---|
| ADR-001 | Content model de `form-field` en Strapi |
| ADR-002 | Resolución de país por segmento de URL (`/:country`) |
| ADR-003 | Rol Public solo con `find` — definido en código, no en admin |
| ADR-004 | Formulario dinámico con registry de validadores + estrategia blur→change |
| ADR-005 | Estado del wizard con NgRx Signals Store (sin localStorage — datos PII) |
| ADR-006 | Toda respuesta de Strapi validada con Zod antes de usarse |
| ADR-007 | Content model de `plan` en Strapi |
| ADR-008 | Permisos Public ampliados para `plan` |
| ADR-009 | Content model de `terms` en Strapi |
| ADR-010 | Simulación de pago y flujo de confirmación |
| ADR-011 | Permisos Public ampliados para `legal-terms` |
| ADR-012 | `pluralName: "legal-terms"` para evitar conflicto con nombre reservado |

## Estructura del proyecto

```
stories/        Historias de usuario originales (no se editan)
specs/          SPEC-0X.md — fuente de verdad por historia (aprobada en HITL-1)
docs/adr/       ADR-00N — decisiones de arquitectura (formato MADR, aceptadas en HITL-2)
reviews/        REV-0X-N — informes de code review
docs/           traceability.md — matriz US → AC → test → commit (autogenerada)
scripts/        traceability.mjs — generador de la matriz
logs/           Exports de sesiones con agentes
FLOW.md         Flujo agéntico completo con diagrama y preguntas de reflexión
CLAUDE.md       Contexto global que gobierna a todos los agentes y subagentes
```

## Seguridad

- El front **nunca** envía tokens de Strapi — llama a `/api` como rol Public (mismo origen vía nginx).
- Permisos del rol Public definidos en código (`apps/cms/src/index.ts`), nunca en el admin.
- `populate` siempre explícito — prohibido `populate=*`.
- Toda respuesta de red se parsea con Zod; campos desconocidos se ignoran y se loguean.
- Solo datos ficticios en el seed. Sin datos reales de tarjetas ni documentos de identidad.
- Sin credenciales ni tokens en el repositorio ni en el historial de git.
