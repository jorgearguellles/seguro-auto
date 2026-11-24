---
id: ADR-004
title: Reactive Forms tipados con registro de validadores y estrategia `blur`/`change`
status: accepted
date: 2026-11-23
deciders: Jorge Argüelles
supersedes:
related: [SPEC-01, RN-01.10, RN-01.11, RN-01.12, RN-01.14, AC-01.2, AC-01.3, AC-01.6, AC-01.7, AC-01.12, G-01.3, G-01.4, G-01.6]
---

# ADR-004 — Reactive Forms tipados con registro de validadores y estrategia `blur`/`change`

## Contexto y problema

SPEC-01 define un formulario cuyos campos, orden, obligatoriedad y validaciones vienen de Strapi (RN-01.1, RN-01.11). Hay 5 tipos de campo cerrados (RN-01.10), 7 claves posibles de validación, y 6 validadores custom con reglas de formato precisas (RN-01.12).

Decisiones abiertas:

1. **Qué variante de formularios Angular usar** (Reactive Forms, Template-driven, librería externa como Formly).
2. **Cómo mapear una regla configurada en Strapi a un `ValidatorFn`** que Angular entienda.
3. **Cuándo disparar las validaciones** (RN-01.14: `blur` en primer toque, `change` después del primer error).
4. **Dónde vive la lógica de los 6 validadores custom** (RN-01.12 dice `apps/web/src/app/core/validators/` pero no el patrón).
5. **Cómo mostrar el mensaje de error configurado** en Strapi (AC-01.2) cuando puede venir del campo o de la regla (ver ADR-001).

Es una decisión estructural: toca la columna vertebral del paso 1, se reusará en US-02 (selección de plan) y potencialmente en US-03 (datos de pago simulado).

## Factores de decisión

- Un solo build, formulario 100 % dinámico generado a partir de JSON validado por zod (ADR-006).
- Prohibido `any`; Reactive Forms tipados o equivalente (CLAUDE.md §2).
- Cero copy hardcoded; los mensajes vienen de Strapi (AC-01.2).
- Reglas custom con regex/algoritmo concreto (RN-01.12) → necesitan ser **unidad testeable pura** (sin DI, sin Angular) para probar RUT, placas y cédulas directamente.
- Accesibilidad obligatoria: `aria-invalid`, `aria-describedby`, foco al primer error (AC-01.13, AC-01.3).
- No introducir dependencias fuera de CLAUDE.md §2 sin justificar.
- Estrategia `blur` en primer toque y `change` tras error (RN-01.14) — hay que escoger la mecánica Angular exacta.

## Opciones consideradas

1. **Opción A — Reactive Forms tipados (`FormGroup<...>`) + registro de validadores por clave + `updateOn: 'blur'` con reactivación `onChange` vía `statusChanges`.** El renderer genera un `FormRecord` desde el schema zod parseado; cada campo se construye con `new FormControl(initial, { validators, updateOn: 'blur' })`. Un `Record<ValidationRule, (params) => ValidatorFn>` traduce cada regla configurada. Después del primer error del campo, un `effect()` / `tap` cambia la señal interna para que se revalide `on change`.
2. **Opción B — Template-driven forms (`ngModel`) con `ngModelOptions = { updateOn: 'blur' }` y directivas de validación custom.**
3. **Opción C — Librería externa `@ngx-formly/core`** que ya resuelve la generación de forms desde JSON.
4. **Opción D — Reactive Forms puros sin registro** (cada campo con validadores escritos a mano en el componente, ignorando la configuración dinámica).

## Decisión

Opción elegida: **Opción A — Reactive Forms tipados + registro de validadores + estrategia `blur`/`change` manual**, porque:

- Es la forma idiomática en Angular 21 de construir un formulario dinámico y tipado, sin dependencias nuevas (CLAUDE.md §2 permite `@angular/forms` como parte del framework).
- El registro `Record<ValidationRule, ValidatorFactory>` casa 1:1 con el enum de `rule` definido en ADR-001, y es una pieza pequeña y testeable aislada (sin DOM).
- `updateOn: 'blur'` por control cubre la mitad de RN-01.14 nativamente. La transición a `on change` se implementa suscribiéndose a `statusChanges` por control y, cuando aparece el primer `INVALID`, se reemplaza el control por uno con `updateOn: 'change'` (o se fuerza `markAsTouched` + un flag que haga que el próximo `setValue` re-ejecute la validación). La solución concreta se detalla abajo.
- Validadores custom como funciones puras importables en tests (Vitest) sin bootstrap de Angular.
- Permite foco programático al primer campo inválido con `elementRef`/`#tpl` por campo, cumpliendo AC-01.3 y AC-01.13.

### Diseño concreto

**Estructura de archivos** (coherente con `angular-conventions` §1):

```
core/validators/
  rut.ts
  cedula-co.ts
  plate-co.ts
  plate-cl.ts
  min-age.ts
  vehicle-year.ts
  index.ts            // exporta todos
features/applicant-form/
  validator-registry.ts   // Record<ValidationRule, (params) => ValidatorFn>
  form-builder.ts         // (fields: FormFieldDto[]) => FormGroup<...>
  applicant-form.component.ts
  field-host.component.ts // renderer por tipo
```

**Registro de validadores** (`validator-registry.ts`):

```ts
export type ValidationRule =
  | 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern'
  | 'rut' | 'cedula_co' | 'placa_co' | 'patente_cl' | 'mayor_edad' | 'anio_vehiculo';

type Factory = (params: unknown) => ValidatorFn;

export const VALIDATOR_REGISTRY: Record<ValidationRule, Factory> = {
  required: () => Validators.required,
  min: (p) => Validators.min((p as { value: number }).value),
  max: (p) => Validators.max((p as { value: number }).value),
  minLength: (p) => Validators.minLength((p as { value: number }).value),
  maxLength: (p) => Validators.maxLength((p as { value: number }).value),
  pattern: (p) => Validators.pattern((p as { regex: string }).regex),
  rut: () => rutValidator,
  cedula_co: () => cedulaCoValidator,
  placa_co: () => placaCoValidator,
  patente_cl: () => patenteClValidator,
  mayor_edad: () => minAgeValidator(18),
  anio_vehiculo: () => vehicleYearValidator,
};
```

- Los `params` ya pasaron por zod (ADR-006), por lo que el `as` está respaldado por un schema; aun así, un `params` ausente para `min/max/minLength/maxLength/pattern` hace que zod descarte la regla antes de llegar aquí (defensa en profundidad con AC-01.12 extendido a reglas).
- Una regla con clave fuera del enum es imposible aquí (zod ya descartó), pero el renderer loguea si llega una por error de tipado en dev.

**Validadores custom (ejemplo `rut.ts`):**

```ts
export function rutValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value == null || value === '') return null; // la obligatoriedad la maneja Validators.required
  if (typeof value !== 'string') return { rut: true };
  return isValidRut(value) ? null : { rut: true };
}

export function isValidRut(rut: string): boolean {
  // 7–8 dígitos + '-' + dígito verificador (0–9 o 'K') (RN-01.12)
  // Algoritmo módulo 11. Testeado con casos canónicos.
}
```

**Estrategia `blur` → `change` tras error (RN-01.14):**

Approach escogido: construir cada control con `updateOn: 'blur'`. Un `effect()` en el componente de campo se suscribe a `statusChanges` (via `toSignal` o directamente); cuando el control pasa a `INVALID` por primera vez, se marca un flag `revalidateOnChange` en el componente de campo y se cambia la estrategia reemplazando el control:

```ts
if (control.invalid && !flag) {
  const replacement = new FormControl(control.value, {
    validators: control.validator,
    updateOn: 'change',
  });
  parentGroup.setControl(name, replacement);
  flag = true;
}
```

Esta mecánica es explícita, se reduce a una función pequeña (`promoteToChangeMode(name, group)`) y es fácil de testear. Es más robusto que `markAsTouched` manual + `valueChanges.subscribe(() => control.updateValueAndValidity())`, que deja el `updateOn` original y puede filtrar errores inesperados.

**Mensaje de error:** el `errorMessage` es, en orden de prioridad:

1. El `errorMessage` de la regla del `field.validation` que falló (si existe, ver ADR-001).
2. El `errorMessage` del campo.

El componente de campo lee `control.errors` y, para la primera clave que exista, busca el mensaje en el DTO del campo (`validations[].errorMessage` → `field.errorMessage`). Un solo mensaje a la vez (AC-01.2 habla en singular).

**Foco al primer error (AC-01.3):** al intentar avanzar, el componente padre llama a `form.markAllAsTouched()` + `form.updateValueAndValidity()`, luego recorre el `FormGroup` en orden de `order` y hace `focus()` sobre la referencia del primer control inválido.

### Consecuencias

- ✅ Positiva: Cero dependencias nuevas; usa solo `@angular/forms` y signals.
- ✅ Positiva: Validadores custom son funciones puras — se testean sin bootstrap Angular (Vitest, archivos `.spec.ts` por validador).
- ✅ Positiva: El registro desacopla "qué reglas se configuran" (negocio en Strapi) de "qué hace cada regla" (código versionado).
- ✅ Positiva: Mensaje de error determinístico: una clave fallando → un mensaje.
- ⚠️ Negativa: `updateOn: 'blur'` no se puede cambiar en caliente; hay que **reemplazar el control** en el `FormGroup` para pasar a `change`. Esto preserva el valor pero resetea `touched`/`dirty`; tras el reemplazo hay que volver a marcarlos. → Mitigación: la función `promoteToChangeMode` lo hace en un solo sitio y hay test unitario que verifica que `touched` y el valor sobreviven.
- ⚠️ Negativa: Formularios tipados "fuertemente" con tipos dinámicos en tiempo de ejecución terminan declarados como `FormRecord<FormControl<unknown>>` (según `angular-conventions` §4) — no obtenemos `FormGroup<{ documentNumber: FormControl<string>; ... }>` porque el shape sale de Strapi. → Mitigación: aceptable; el shape fuerte está en el **modelo de dominio** (zod `z.infer`), no en el form; el form convierte al modelo en el `submit` con una función `toApplicantModel(form.value, fields)` tipada.
- ⚠️ Negativa: El foco al primer campo inválido requiere referenciar cada control por `#` template. → Mitigación: patrón conocido con `@ViewChildren` o `signal` de refs; se encapsula en el renderer.
- ⚠️ Negativa: Un validador custom con un bug (por ejemplo `rutValidator` que falla contra un RUT real) bloquea a todos los usuarios. → Mitigación: tests unitarios obligatorios por validador con casos positivos y negativos documentados en RN-01.12; cobertura ≥ 2 válidos y ≥ 2 inválidos por validador.
- ⚠️ Negativa: `markAllAsTouched` muestra todos los errores de golpe al intentar avanzar; combinado con RN-01.14 es correcto (el usuario ya intentó enviar, debería ver todo), pero puede sentirse abrumador en móvil. → Mitigación: se hace foco solo al primero (AC-01.3); los demás se ven al hacer scroll.

### Validación

- Tests unitarios por validador (`core/validators/*.spec.ts`, Vitest): títulos `AC-01.6`, `AC-01.7`, y suites por cada validador custom con casos canónicos de RN-01.12 (RUTs válidos/inválidos conocidos, placas `AAA123`, `AAA12A`, patentes `BB1234`, `BBCC12`, cédulas `12345678`, etc.).
- Test unitario del registro (`validator-registry.spec.ts`): toda clave del enum tiene factory; reglas con params inválidos (pasadas por zod) producen `ValidatorFn` que falla con error estructurado.
- Test unitario de `form-builder`: dado un fixture de 3 campos (text, select, date) con validaciones variadas, produce un `FormGroup` con la forma esperada y `updateOn: 'blur'` en todos.
- Test de componente (Vitest + Testing Library o similar) `AC-01.2 shows configured error message after blur`: el mensaje renderizado es exactamente el `errorMessage` del fixture.
- Test de componente `AC-01.14-revalidate-on-change-after-first-error`: tras el primer error, cambios subsiguientes al input re-evalúan sin esperar al blur.
- Test Playwright `AC-01.3 focuses first invalid field`: submit con 3 campos vacíos → foco en el primero según `order`.
- Revisión (`review-checklist`): ningún mensaje de error hardcoded; ningún `any` en el renderer; validadores son funciones puras.

## Pros y contras de las opciones

### Opción A — Reactive Forms tipados + registro (elegida)

- ✅ Nativo, sin dependencias nuevas.
- ✅ Validadores testeables aislados.
- ✅ `updateOn` por control permite RN-01.14 de forma precisa.
- ✅ `statusChanges` + signals integran bien con `OnPush`.
- ❌ El switch `blur` → `change` requiere reemplazar el control (no es trivial pero es una vez).
- ❌ Shape del `FormGroup` es dinámico (`FormRecord`), tipado "en runtime" via zod.

### Opción B — Template-driven forms

- ✅ Menos código ceremonia para formularios estáticos.
- ✅ `ngModelOptions = { updateOn: 'blur' }` se setea por atributo.
- ❌ Formularios dinámicos con `ngModel` son incómodos: hay que generar el template con `@for` y binding por índice; perder la referencia al control invalida `markAsTouched` por nombre.
- ❌ Validadores custom necesitan directivas → más boilerplate para probarlos.
- ❌ Peor afinidad con signals y `OnPush` (ngModel internamente usa zonas).

### Opción C — `@ngx-formly/core`

- ✅ Resuelve generación de forms desde JSON con amplia comunidad.
- ✅ Soporta wrappers, expresiones condicionales y validadores custom.
- ❌ **Nueva dependencia** (fuera de CLAUDE.md §2) — requeriría sección de "Nueva dependencia" justificada; el costo supera al beneficio para v1 (5 tipos, 12 reglas, formulario pequeño).
- ❌ Capa de abstracción propia (`FieldConfig`) que hay que mapear igualmente desde el DTO de Strapi; no ahorra tanto.
- ❌ Historia de Formly con Angular 21 standalone/signals aún está estabilizándose; riesgo técnico para una app de evaluación.
- ❌ Internaliza la estrategia `updateOn`; controlar la transición `blur` → `change` tras error requiere opciones no triviales o forks.

**Si alguna vez se decide adoptarla:** iría como nueva dependencia justificada en un ADR superseding este, con revisión de compatibilidad con Angular 21 y signals.

### Opción D — Reactive Forms sin registro

- ✅ Código mínimo.
- ❌ Contradice RN-01.1: los validadores estarían hardcoded, y agregar un campo nuevo en Strapi no bastaría — habría que tocar código.
- ❌ Contradice RN-01.11/RN-01.12: la configuración de Strapi no se usaría.

## Nueva dependencia

Este ADR **no introduce dependencias nuevas**: usa `@angular/forms` que ya viene con Angular 21 (stack aprobado, CLAUDE.md §2).

## Camino de evolución

- **Validaciones asíncronas (p. ej. verificar disponibilidad de placa contra un servicio):** se agregan como `AsyncValidatorFn` en un registro paralelo; el patrón es idéntico. No requiere nuevo ADR salvo que cambie la UX.
- **Dependencias entre campos (G-01.8 pendiente):** cuando llegue, el renderer leerá un `dependsOn` y usará `valueChanges` del campo padre para habilitar/deshabilitar o filtrar opciones del dependiente. El registro no cambia; solo el renderer.
- **Más validadores (p. ej. `curp_mx`):** agregar archivo en `core/validators/`, extender el enum `ValidationRule` y el registro. Tres cambios acotados.
- **Migración a Formly si el formulario crece a > 50 campos y 20 reglas:** se abre un ADR que supersede este con ADR específico de dependencia y migración.
- **Equipo de 5 personas:** cada validador custom se aparea con tests obligatorios (regla de review).
