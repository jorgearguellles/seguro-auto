---
name: review-checklist
description: Checklist ordenado, definición de severidades y plantilla de informe para code reviews (reviews/REV-0X-N.md). Úsala siempre que el code-reviewer revise un diff o verifique fixes.
---

# Code review

## Severidades

| Severidad | Definición | ¿Bloquea QA? |
|---|---|---|
| `critical` | Fuga de seguridad, token o dato real expuesto, pérdida de datos, AC central roto | Sí, siempre |
| `major` | AC no cumplido, accesibilidad que impide completar el flujo, estado de error ausente, contrato de un ADR violado | Sí, salvo aceptación humana escrita |
| `minor` | Funciona pero frágil: tipado débil, test poco fiable, duplicación | No |
| `nit` | Estilo o nombre | No |

## Checklist (en este orden)

**1. Seguridad**
- [ ] Ningún token, secret o URL absoluta de Strapi en `apps/web` (`grep -ri "token\|bearer\|authorization" apps/web/src`)
- [ ] Permisos Public = solo `find` en tipos de ADR-003, definidos en código
- [ ] Sin `populate=*`; populate explícito
- [ ] Sin `innerHTML` sin sanitizar; texto enriquecido renderizado de forma segura
- [ ] Solo datos ficticios; sin datos de tarjeta; `.env` no commiteado

**2. Cumplimiento de spec**
- [ ] Cada AC del alcance tiene implementación y ≥1 test con su ID
- [ ] Nada implementado que no esté en la spec (scope creep)
- [ ] Huecos decididos por el humano implementados como se decidió

**3. Accesibilidad**
- [ ] Labels, `aria-describedby`, `aria-invalid`, foco al primer error
- [ ] Radiogroup en planes; recomendado no depende solo del color
- [ ] Wizard completable con teclado (existe e2e que lo prueba)

**4. Angular moderno / Strapi**
- [ ] Standalone, signals, `@if`/`@for` con `track`, OnPush, `inject()`, sin `any`
- [ ] Respuestas parseadas con zod; tipos desconocidos no rompen
- [ ] Ningún copy de negocio hardcodeado

**5. Estados y errores**
- [ ] Carga / error con reintento / vacío en cada pantalla con red
- [ ] Doble envío del pago imposible; fallo de pago conserva datos

**6. Tests**
- [ ] Prueban comportamiento, no detalles internos
- [ ] Sin `.skip`, `.only`, `waitForTimeout`
- [ ] Pago forzado de forma determinista

**7. Trazabilidad**
- [ ] Commits con formato `type(US-0X): ... [AC][ADR]`
- [ ] Tabla de trazabilidad de la spec actualizable

**8. Mantenibilidad**
- [ ] Funciones > ~40 líneas justificadas o divididas
- [ ] Sin duplicación de lógica por país (la diferencia vive en datos)

## Plantilla del informe

```markdown
---
id: REV-0X-N
story: US-0X
spec: SPEC-0X (vN)
round: N
base: <commit>
head: <commit>
verdict: changes-requested   # approve | changes-requested
date: YYYY-MM-DD
---

# REV-0X-N — <historia>

## Resumen
critical: 0 · major: 0 · minor: 0 · nit: 0
<2–3 líneas>

## Hallazgos

### F-0X-N.1 · critical · Seguridad
- **Dónde:** `apps/web/src/app/core/api.ts:14`
- **Evidencia:** <fragmento o salida de comando>
- **Por qué importa:** <regla de CLAUDE.md / ADR / AC>
- **Recomendación:** ...
- **Estado:** open        # open | resolved (<commit>) | accepted (<justificación del humano>)

## Checklist
<marcar cada ítem con ✅ / ❌ / N/A>

## Decisión humana (HITL-3)
<lo completa el humano: qué se corrige, qué se acepta y por qué>
```
