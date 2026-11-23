---
name: sdd-spec-template
description: Plantilla y reglas para escribir specs SDD (specs/SPEC-0X.md) a partir de historias de usuario. Úsala siempre que se cree o versione una spec.
---

# Spec-Driven Development en este proyecto

La spec es la **fuente de verdad**. El código y los tests derivan de ella; si discrepan, gana la spec (o se versiona la spec con aprobación humana).

## Por qué una variante propia y no Spec Kit

Con 3 historias, la ceremonia de Spec Kit (constitución, plan, tasks por historia) cuesta más de lo que aporta. Esta variante conserva lo esencial: spec antes de código, IDs trazables, huecos explícitos y aprobación humana. Esta justificación se repite en `FLOW.md`.

## Ciclo de vida

`draft` → (HITL-1) → `approved` → (cambio) → nueva versión `draft` → `approved` · la anterior pasa a `superseded`.

## Reglas de escritura

1. **Usa `template.md` tal cual.** No elimines secciones; si no aplica, escribe "No aplica" y por qué.
2. **IDs estables:** `RN-0X.N`, `AC-0X.N`, `G-0X.N`. Nunca se renumeran; si uno se elimina, queda tachado con motivo.
3. **AC verificable:** cada `Then` describe algo observable (texto visible, estado de un botón, URL, valor guardado). Prohibido: "funciona correctamente", "es intuitivo", "es rápido".
4. **Separar hecho de propuesta:** lo que dice la historia va en Reglas; lo que tú propones va en Huecos.
5. **Multi-país explícito:** si un AC se comporta distinto en CO y CL, escribe un `Scenario Outline` con `Examples` por país.
6. **Accesibilidad como AC**, no como nota: al menos un AC de teclado y uno de labels/errores accesibles por pantalla.

## Checklist de huecos típicos de este dominio

Revísalo siempre; cada punto que aplique genera un `G-0X.N`:

- ¿Cómo se determina el país? ¿Qué pasa con un país no soportado?
- ¿La edad mínima o los formatos dependen del país?
- Validaciones de documento (dígito verificador del RUT, rangos de la cédula) y de placa por país.
- ¿Qué pasa si Strapi no responde, responde vacío o con un tipo de campo desconocido?
- ¿Qué pasa con datos guardados si la configuración del formulario cambió entre visitas?
- Recalcular precio si el usuario vuelve y cambia datos con un plan ya elegido.
- Redondeo y formato de moneda (COP/CLP sin decimales).
- ¿Cuándo se borran los datos persistidos en el navegador?
- Doble envío, recarga de página durante el pago, botón atrás del navegador.
