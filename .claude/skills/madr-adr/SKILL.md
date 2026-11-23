---
name: madr-adr
description: Plantilla MADR y criterios de calidad para escribir Architecture Decision Records en docs/adr/. Úsala siempre que se proponga, reemplace o revise un ADR.
---

# ADRs en este proyecto (formato MADR)

## Nombre y numeración

`docs/adr/ADR-00N-kebab-case-title.md` — números consecutivos, nunca se reutilizan.

## Ciclo de vida

`proposed` → (HITL-2) → `accepted` | `rejected` · más adelante `superseded by ADR-00M` o `deprecated`.
Un ADR aceptado **no se edita**; se reemplaza con uno nuevo.

## Criterios de calidad (los revisa el humano en HITL-2)

1. **Contexto con fuerzas reales:** cita `RN` / `AC` / `G` de las specs que lo motivan.
2. **≥ 2 alternativas reales.** Si una opción no la elegiría nadie razonable, no cuenta.
3. **Pros y contras específicos de este proyecto**, no genéricos ("es popular" no es un pro).
4. **Consecuencias negativas honestas** y cómo se mitigan.
5. **Validación:** cómo sabremos que la decisión se cumple (test, regla de review, script).
6. **Camino de evolución:** qué haríamos si el contexto cambia (más países, más tráfico, equipo más grande).

## ADRs previstos (backlog inicial)

| ID | Decisión |
|----|----------|
| ADR-001 | Diferenciación de contenido por país en Strapi (obligatorio) |
| ADR-002 | Resolución del país en Angular |
| ADR-003 | Acceso a Strapi, tokens y permisos del rol Public |
| ADR-004 | Estrategia de formularios dinámicos y validadores |
| ADR-005 | Estado del wizard y persistencia en el front |
| ADR-006 | Validación en tiempo de ejecución de las respuestas de Strapi |

Usa `template.md`.
