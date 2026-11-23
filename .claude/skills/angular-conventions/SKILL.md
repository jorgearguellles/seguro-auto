---
name: angular-conventions
description: Convenciones de Angular 21 para apps/web — estructura, signals, formularios dinámicos, acceso a Strapi, accesibilidad y tests. Úsala antes de escribir o revisar cualquier código en apps/web.
---

# Convenciones Angular (apps/web)

> Las decisiones de fondo están en los ADRs. Si esta skill y un ADR aceptado discrepan, gana el ADR y esta skill se actualiza.

## 1. Estructura

```
src/app/
  core/        api client, zod schemas, runtime config, error handling, system-messages.ts
  country/     country guard (CanMatch), CountryContext (signal), formatters (Intl)
  wizard/      WizardStore (signals + sessionStorage), step guards
  features/
    applicant-form/   dynamic renderer, validator registry
    plans/            plan list, pricing engine (pure function)
    checkout/         summary, terms, payment gateway (mock), confirmation
  shared/ui/   accessible field components
```

Archivos: `kebab-case`, sufijo por rol (`.component.ts`, `.store.ts`, `.schema.ts`, `.validators.ts`). Un componente = un archivo `.ts` con template inline si tiene < 40 líneas de template; si no, `.html` aparte.

## 2. Componentes

```ts
@Component({
  selector: 'app-plan-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (plan().recommended) { <span class="badge">{{ recommendedLabel() }}</span> }
  `,
})
export class PlanCardComponent {
  readonly plan = input.required<Plan>();
  readonly recommendedLabel = input.required<string>();
  readonly selected = output<string>();
}
```

- `input()` / `output()` / `model()`, nunca decoradores `@Input/@Output`.
- `inject()`, nunca inyección por constructor.
- `computed()` para estado derivado; `effect()` solo para efectos con el mundo exterior (persistencia, logging).
- Prohibido `any`. Si un tipo viene de la red, sale de un schema zod (`z.infer`).

## 3. Acceso a Strapi

- Un solo cliente en `core/` que llama a rutas relativas `/api/...`. **Nunca** tokens ni URLs absolutas.
- `populate` y `filters` explícitos, construidos en un solo lugar.
- Toda respuesta: `schema.parse()` → modelo de dominio. Strapi DTO ≠ modelo de dominio.
- Tipo de campo desconocido → se descarta con `console.warn` estructurado; la app sigue.
- Cada pantalla que consume red expone tres estados: `loading`, `error` (con reintentar), `empty`.

## 4. Formularios dinámicos

- Reactive Forms tipados (`FormRecord<FormControl<unknown>>`) generados desde la config de Strapi.
- **Registro de validadores**: `Record<ValidationRule, (params) => ValidatorFn>`. La config de Strapi solo nombra reglas; el código las implementa. Una regla desconocida se ignora y se loguea.
- El mensaje de error mostrado es el configurado en Strapi (por regla si existe, si no el del campo).
- Validadores de dominio en archivos puros y testeables: `rut-cl`, `cedula-co`, `plate-co`, `plate-cl`, `vehicle-year`, `min-age`.

## 5. Estado del wizard

- `WizardStore` con signals: `applicant`, `selectedPlanId`, `quote`.
- Persistencia en `sessionStorage` con clave `wizard:v1:<country>`; al leer, si la versión o la forma no coinciden, se descarta.
- Guards por paso: no se entra a `planes` sin paso 1 válido, ni a `resumen` sin plan.
- Tras un pago exitoso, se limpia el estado.

## 6. Accesibilidad (checklist del builder)

- Todo control tiene `<label for>` visible. La ayuda y el error se enlazan con `aria-describedby`; el control inválido tiene `aria-invalid="true"`.
- Al enviar un paso con errores: foco al primer campo inválido.
- Lista de planes = `role="radiogroup"` con radios reales; el "recomendado" se comunica con texto, no solo con color.
- Botón de pago deshabilitado con `disabled` real (no solo con estilo); durante el procesamiento usa `aria-busy` y anuncia con `aria-live="polite"`.
- Cambio de paso: mover el foco al `<h1>` del paso y actualizar `document.title`.
- Orden de foco lógico; foco visible (`:focus-visible`) nunca eliminado.

## 7. Estilos

- SCSS con custom properties (tokens) en `styles/tokens.scss`. Sin librería de UI.
- Mobile-first; breakpoints a 640 px y 1024 px.

## 8. Tests

- Vitest para lógica pura y componentes; Playwright para e2e.
- Título de cada test empieza con el `AC-0X.N` que verifica.
- Selectores accesibles (`getByRole`, `getByLabel`).
