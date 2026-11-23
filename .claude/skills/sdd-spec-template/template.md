---
id: SPEC-0X
story: US-0X
title: <título corto>
status: draft            # draft | approved | superseded
version: 1
approved_by:             # lo llena el humano
approved_at:             # lo llena el humano
related_adrs: []         # ADR-001, ...
---

# SPEC-0X — <título>

## 1. Resumen
<2–3 líneas: qué problema resuelve esta pantalla y para quién.>

## 2. Historia de origen
Ver `stories/US-0X.md`. <Cita literal de la frase "Como… quiero… para…">

## 3. Reglas de negocio
| ID | Regla | Fuente |
|----|-------|--------|
| RN-0X.1 | ... | Historia |

## 4. Criterios de aceptación

```gherkin
# AC-0X.1 — <nombre>
Scenario: ...
  Given ...
  When ...
  Then ...
```

```gherkin
# AC-0X.2 — <nombre> (agregado)
Scenario Outline: ...
  Given el país es <country>
  ...
  Examples:
    | country | ... |
    | CO      | ... |
    | CL      | ... |
```

## 5. Análisis de huecos
| ID | Hueco | Por qué importa | Propuesta | Decisión humana |
|----|-------|-----------------|-----------|-----------------|
| G-0X.1 | ... | ... | ... | _pendiente_ |

## 6. Contrato de contenido (Strapi)
<Qué datos necesita la pantalla, con tipo y obligatoriedad. No decide el modelo final; eso es de los ADRs.>

## 7. Requisitos no funcionales
- **Accesibilidad:** ...
- **Seguridad:** ...
- **Responsive:** 375 px y 1280 px.
- **Estados:** carga, error, vacío.

## 8. Fuera de alcance
- ...

## 9. Preguntas abiertas
<Se llena si durante la implementación aparece algo no previsto. Cada pregunta indica quién la levantó y cuándo.>

## 10. Trazabilidad
| AC | ADR | Commit(s) | Test(s) | Review |
|----|-----|-----------|---------|--------|
| AC-0X.1 | | | | |

## 11. Changelog
| Versión | Fecha | Cambio | Aprobado por |
|---------|-------|--------|--------------|
| 1 | | Versión inicial | |
