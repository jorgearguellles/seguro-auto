# Seguro Auto Multi-País — Contexto global para agentes

> Este archivo gobierna a TODOS los agentes y subagentes. Si una instrucción de un subagente o skill contradice este archivo, gana este archivo. Si algo no está cubierto aquí, detente y pregunta al humano.

## 1. Qué construimos

Wizard de cotización de seguro de auto para **Colombia (CO)** y **Chile (CL)**. Un solo build de Angular sirve ambos países; formulario, planes y términos se configuran en Strapi sin desplegar.

- Historias de entrada: `stories/US-01.md`, `stories/US-02.md`, `stories/US-03.md`.
- Pasos: 1) datos del titular y vehículo → 2) planes → 3) resumen y pago simulado → confirmación.

## 2. Stack (no negociable)

| Capa | Tecnología | Reglas |
|---|---|---|
| Front | Angular 21+ | Standalone, signals, `@if`/`@for`/`@switch`, `ChangeDetectionStrategy.OnPush`, `inject()`. Prohibido: NgModules, `*ngIf`, `*ngFor`, `any`. |
| Contenido | Strapi 5 | Document Service API (`strapi.documents()`), `documentId`. SQLite en dev. |
| Validación de red | zod | Toda respuesta de Strapi se parsea con zod antes de usarse. |
| Tests | Vitest (unit), Playwright (e2e), axe-core (a11y) | |
| Entorno | Docker Compose | `docker compose up` levanta todo con seed CO/CL. |
| Lenguaje | TypeScript `strict: true` | |

Detalle de convenciones: skills `angular-conventions` y `strapi-content-model`.

## 3. Estructura del repo

```
apps/web/          Angular
apps/cms/          Strapi
stories/           Historias de usuario originales (entrada, no se editan)
specs/             SPEC-0X.md (fuente de verdad, SDD)
docs/adr/          ADR-00N-slug.md (formato MADR)
reviews/           REV-0X-N.md (informes de code review)
logs/              Exports sin editar de sesiones con agentes
scripts/           Utilidades (matriz de trazabilidad, etc.)
.claude/agents/    Definiciones de subagentes
.claude/skills/    Skills del proyecto
```

## 4. Idioma

- Código, identificadores, nombres de archivo de código y mensajes de commit: **inglés**.
- Specs, ADRs, reviews, README, FLOW.md: **español**.
- Copy de negocio visible al usuario: **viene de Strapi**. Nunca se hardcodea en Angular. Solo el copy de sistema (error de red, cargando) vive en `apps/web/src/app/core/system-messages.ts`.

## 5. IDs y trazabilidad (obligatorio)

| Artefacto | ID | Ubicación |
|---|---|---|
| Historia | `US-0X` | `stories/US-0X.md` |
| Spec | `SPEC-0X` | `specs/SPEC-0X.md` |
| Regla de negocio | `RN-0X.N` | dentro de la spec |
| Criterio de aceptación | `AC-0X.N` | dentro de la spec |
| Hueco detectado | `G-0X.N` | dentro de la spec |
| ADR | `ADR-00N` | `docs/adr/ADR-00N-slug.md` |
| Review | `REV-0X-N` | `reviews/REV-0X-N.md` |
| Hallazgo | `F-0X-N.M` | dentro del review |

- **Commits:** `type(US-0X): summary [AC-0X.N][ADR-00N]` — tipos: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`.
- **Fix de un hallazgo:** `fix(US-0X): summary [F-0X-N.M]`.
- **Tests:** el título de cada `it()` / `test()` empieza con el AC que verifica: `it('AC-01.2 shows configured error message', ...)`.
- La cadena `US → SPEC → AC → ADR → commit → test → REV` debe poder recorrerse con `grep`.

## 6. Flujo (resumen — detalle completo en `FLOW.md`)

```
US-0X → [spec-writer] → HITL-1 aprueba spec
      → [architect]   → HITL-2 acepta ADRs
      → [cms-builder] + [frontend-builder]
      → [test-engineer]
      → [code-reviewer] → HITL-3 decide hallazgos → loop de fixes → re-review
      → HITL-4 checklist de entrega a QA
```

Reglas del flujo:
1. **No se implementa nada sin una spec con `status: approved`.**
2. Una spec aprobada o un ADR aceptado es **inmutable**. Un cambio = nueva versión con entrada en el changelog y nueva aprobación humana.
3. Si durante la implementación aparece un hueco: **detente**, regístralo en la sección "Preguntas abiertas" de la spec y escala al humano. No inventes requisitos.
4. Cada subagente termina con un **informe de handoff**: qué hizo, qué ACs cubre, qué quedó pendiente, qué necesita del humano.

## 7. Reglas de seguridad (bloqueantes en review)

- **Ningún token de Strapi en `apps/web`** — ni en `environment.ts`, ni en `config.json`, ni en headers. El front llama a `/api` (proxy nginx, mismo origen) como rol Public.
- Rol Public: solo `find` en `country`, `form-field`, `plan`. Cualquier permiso adicional requiere justificación en un ADR. Los permisos se definen **en código** (`bootstrap` de Strapi), nunca a mano en el admin.
- `populate` siempre explícito. Prohibido `populate=*` y populate profundo genérico.
- Solo datos ficticios. Nunca capturar datos de tarjeta. Nunca commitear secretos: usar `.env.example` con placeholders.
- Texto enriquecido de Strapi se renderiza sin `innerHTML` sin sanitizar (usar un renderer de bloques o `DomSanitizer` documentado).
- Toda respuesta de red pasa por un schema zod; un tipo de campo desconocido se ignora y se registra en log, no rompe la app.

## 8. Definition of Done (por historia)

- [ ] Todos los `AC` de la spec cubiertos por ≥1 test cuyo título lleva su ID.
- [ ] `lint`, `test` y `e2e` en verde.
- [ ] Wizard completable solo con teclado; axe sin violaciones `serious` / `critical`.
- [ ] Probado en 375 px y 1280 px de ancho.
- [ ] Estados de carga, error y vacío implementados.
- [ ] Review ejecutado; hallazgos `critical` y `major` resueltos o aceptados por el humano con justificación escrita.
- [ ] Matriz de trazabilidad (`docs/traceability.md`) actualizada.

## 9. Lo que los agentes NUNCA hacen

- `git push`, merge, rebase de ramas compartidas o borrar ramas.
- Editar specs aprobadas, ADRs aceptados, `stories/` o `logs/`.
- Agregar dependencias sin justificarlas en el informe de handoff (y en un ADR si son estructurales).
- Desactivar o saltar tests, reglas de lint o de TypeScript para "hacer pasar" algo.
- Marcar una spec como `approved` o un ADR como `accepted`: eso solo lo hace el humano.

## 10. Comandos

> Se completan en T-05 (docker-compose) y T-30 (scaffold de Angular).

```bash
docker compose up                 # todo el stack con seed CO/CL
npm --prefix apps/web run lint
npm --prefix apps/web test        # Vitest
npm --prefix apps/web run e2e     # Playwright
node scripts/traceability.mjs     # regenera docs/traceability.md
```
