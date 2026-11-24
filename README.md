# Seguro Auto Multi-País

Wizard de cotización de seguro de auto para Colombia (CO) y Chile (CL). Formulario, planes y términos configurados en Strapi sin necesidad de redeploy.

## Requisitos

- Docker + Docker Compose v2
- Puerto **4200** libre (nginx), **1337** libre (Strapi admin)

## Levantar el stack

```bash
docker compose up
```

Esto construye y levanta tres servicios:

| Servicio | URL | Descripción |
|---|---|---|
| Wizard (Angular) | http://localhost:4200 | Entrada principal |
| Colombia paso-1 | http://localhost:4200/co/paso-1 | Formulario CO |
| Chile paso-1 | http://localhost:4200/cl/paso-1 | Formulario CL |
| Strapi admin | http://localhost:1337/admin | CMS |

El seed corre automáticamente en el bootstrap de Strapi. Crea los campos de formulario de CO y CL listos para usar.

> Primera vez: el build tarda ~2-3 min. Strapi tarda ~90 s en arrancar. Cuando nginx esté healthy, todo está listo.

## Crear cuenta de administrador en Strapi

La primera vez que abras http://localhost:1337/admin, Strapi te pide crear un usuario admin. No hay credenciales por defecto — las eliges tú en ese paso.

## Comandos de desarrollo

```bash
# Lint
npm --prefix apps/web run lint

# Tests unitarios (Vitest)
npm --prefix apps/web test

# Tests e2e (Playwright — requiere stack levantado)
npm --prefix apps/web run e2e

# Regenerar matriz de trazabilidad
node scripts/traceability.mjs
```

## Arquitectura

```
apps/web/    Angular 21 — standalone components, signals, OnPush
apps/cms/    Strapi 5 — SQLite dev, seed idempotente CO/CL
nginx/       Proxy único en :4200 → /api → CMS, /* → Angular
```

**Decisiones clave (ver `docs/adr/`):**

| ADR | Decisión |
|---|---|
| ADR-001 | Content model de `form-field` en Strapi |
| ADR-002 | Resolución de país por segmento de URL (`/:country`) |
| ADR-003 | Rol Public solo con `find` en `country`, `form-field`, `plan` — definido en código |
| ADR-004 | Formulario dinámico con registry de validadores + estrategia blur→change |
| ADR-005 | Estado del wizard con NgRx Signals Store |
| ADR-006 | Toda respuesta de Strapi validada con Zod antes de usarse |

## Estado de implementación

| Historia | Descripción | Estado |
|---|---|---|
| US-01 | Formulario configurable de datos del titular y vehículo | ✅ Completo |
| US-02 | Lista de planes por país | 📋 Spec lista, pendiente implementación |
| US-03 | Resumen y pago simulado | 📋 Spec lista, pendiente implementación |

### US-01 — cobertura de tests

```
Unit tests:   147 passing (Vitest)
E2e tests:     25 passing (Playwright + axe-core)
Lint:          0 warnings
```

Los 15 criterios de aceptación de US-01 tienen ≥1 test con su ID (`AC-01.N`) en el título. Ver `docs/traceability.md` para la matriz completa.

## Estructura del proyecto

```
stories/        Historias de usuario originales (no se editan)
specs/          SPEC-0X.md — fuente de verdad por historia
docs/adr/       ADR-00N — decisiones de arquitectura (formato MADR)
reviews/        REV-0X-N — informes de code review
docs/           traceability.md — matriz US → AC → test → commit
scripts/        traceability.mjs — generador de la matriz
```

## Seguridad

- El front **nunca** envía tokens de Strapi — llama a `/api` como rol Public (mismo origen vía nginx).
- Permisos del rol Public definidos en código (`apps/cms/src/index.ts`), no en el admin.
- `populate` siempre explícito — prohibido `populate=*`.
- Toda respuesta de red parsea con Zod; campos desconocidos se ignoran y se loguean.
- Solo datos ficticios en el seed. No hay datos reales de tarjetas ni documentos.
