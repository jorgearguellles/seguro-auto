---
id: ADR-005
title: Estado del wizard con `@ngrx/signals` (SignalStore) en memoria, sin storage
status: accepted
date: 2026-11-23
deciders: Jorge Argüelles
supersedes:
related: [SPEC-01, RN-01.8, RN-01.13, AC-01.5, G-01.5]
---

# ADR-005 — Estado del wizard con `@ngrx/signals` (SignalStore) en memoria, sin storage

## Contexto y problema

RN-01.8 exige que los valores del paso 1 sobrevivan a la navegación al paso 2 y de vuelta (AC-01.5). RN-01.13 cierra el hueco G-01.5: el estado vive **solo en memoria**, se destruye al completar o abandonar el flujo, y **no se escribe en `localStorage` ni `sessionStorage`** por privacidad (PII como RUT/cédula y fecha de nacimiento).

SPEC-01 nombra explícitamente "`WizardStore` con NgRx Signals" en RN-01.13. Esto fija la tecnología a nivel de spec aprobada — pero `@ngrx/signals` **no está listado en CLAUDE.md §2**, que menciona "signals" como feature de Angular 21 pero no la librería `@ngrx/signals`. Este ADR debe:

1. Confirmar la decisión tecnológica (o reportar la contradicción al humano si corresponde).
2. Justificar por qué `@ngrx/signals` sobre alternativas puramente nativas.
3. Fijar el ciclo de vida del store (cuándo nace, cuándo muere, cómo se destruye entre países).
4. Documentar por qué **no** se persiste y qué se pierde con esa decisión.
5. Dejar nota explícita de que, al no estar en CLAUDE.md §2, se añade como **nueva dependencia** justificada.

**Nota de contradicción (procedimiento del rol):** la skill `angular-conventions` §5 dice "`WizardStore` con signals + sessionStorage". RN-01.13 (spec aprobada) dice "solo memoria, nada en storage". La spec aprobada manda (CLAUDE.md §6.2): este ADR sigue a la spec. Se reporta al humano en el handoff para que decida si actualizar la skill `angular-conventions`.

## Factores de decisión

- RN-01.13 fija "solo memoria" por privacidad PII — es el factor dominante.
- RN-01.8 / AC-01.5 exigen persistencia **entre pasos** (no entre sesiones).
- El store debe ser consumible con signals (`computed`, `effect`) y compatible con `OnPush`.
- Sin `any` (CLAUDE.md §2); estado tipado.
- Sin tokens, sin duplicación de dominio: el store refleja el modelo de dominio producido tras validar el form con zod/ValidatorFn.
- Store debe destruirse al completar o abandonar; evitar leaks entre países si el usuario navega `/co` → `/cl`.
- Simplicidad: la opción más simple que cumple > la más robusta.

## Opciones consideradas

1. **Opción A — `@ngrx/signals` SignalStore provisto a nivel de ruta `/:country` / wizard.** El store se crea cuando la rama `/:country` se activa y se destruye cuando se sale (via `providers` de la ruta). Expone `applicant`, `selectedPlanId`, `quote` como signals; mutaciones con `patchState`.
2. **Opción B — Servicio Angular puro con signals (`@Injectable` con `signal<WizardState>()`), provisto a nivel de ruta.** Sin NgRx. Métodos propios `setApplicant()`, `setPlan()`, etc.
3. **Opción C — NgRx global store (`@ngrx/store` + `@ngrx/effects`).** Reducers/acciones tradicionales.
4. **Opción D — TanStack Query local / signal local en cada componente.** Cada paso mantiene su estado; al navegar, se pierde (necesita reconstrucción).

## Decisión

Opción elegida: **Opción A — `@ngrx/signals` SignalStore provisto a nivel de la rama `/:country` del wizard**, porque:

- RN-01.13 lo nombra explícitamente en la spec aprobada; este ADR lo ratifica y lo tipifica.
- Es la opción que **declara la forma del estado en un solo sitio** (`withState<WizardState>({...})`), ideal para testear y para que el `code-reviewer` detecte mutaciones no autorizadas.
- `patchState` + `withMethods` dan mutaciones explícitas y nombradas; sin `any`.
- Provisto por ruta: nace con `/:country` (ADR-002), muere al salir del árbol. Un cambio de `/co` → `/cl` destruye el store y crea uno nuevo → **imposible leak de PII entre países**.
- Más idiomático que Opción B para el "store de wizard" que queremos documentar; menos pesado que Opción C para un caso sin side-effects asíncronos globales.

### Nueva dependencia — justificación

**Paquete:** `@ngrx/signals` (`^19.x` compatible con Angular 21).
**Tamaño:** ~5 kB gzipped; sin runtime extra, es una capa de helpers sobre signals nativos.
**Alternativa sin dependencia:** Opción B (servicio puro con signals). Es técnicamente suficiente. Se descarta porque la spec aprobada (RN-01.13) nombra explícitamente "NgRx Signals", lo que señala intención de usar la convención del equipo NgRx. **Si HITL-2 rechaza la dependencia**, se migra a Opción B; el cambio es mecánico (reemplazar `signalStore(withState(...), withMethods(...))` por un `@Injectable` con los mismos métodos). Se ofrece como camino de salida.

### Diseño concreto

**`features/wizard/wizard.store.ts`:**

```ts
export type WizardState = {
  applicant: Record<string, unknown> | null; // valores del paso 1, shape dinámico (ADR-004)
  applicantFieldsSnapshot: string[] | null;  // keys que estaban cuando se guardó (para AC-01.5 ante cambios de Strapi)
  selectedPlanId: string | null;             // US-02
  quote: QuoteDraft | null;                  // US-03
};

export const WizardStore = signalStore(
  withState<WizardState>({
    applicant: null,
    applicantFieldsSnapshot: null,
    selectedPlanId: null,
    quote: null,
  }),
  withMethods((store) => ({
    setApplicant(values: Record<string, unknown>, fieldKeys: string[]): void {
      patchState(store, { applicant: values, applicantFieldsSnapshot: fieldKeys });
    },
    clearApplicant(): void {
      patchState(store, { applicant: null, applicantFieldsSnapshot: null });
    },
    reset(): void {
      patchState(store, { applicant: null, applicantFieldsSnapshot: null, selectedPlanId: null, quote: null });
    },
  })),
);
```

**Provisión por ruta** (`wizard.routes.ts`, parte de la rama `:country`):

```ts
export default [
  {
    path: '',
    providers: [WizardStore],      // instancia nueva por entrada a /:country/*
    children: [
      { path: 'paso-1', loadComponent: () => import('./steps/applicant-form.component') },
      { path: 'paso-2', loadComponent: () => import('./steps/plans.component'), canActivate: [step2Guard] },
      // ...
    ],
  },
];
```

- `providers` a nivel de ruta ⇒ Angular instancia un `WizardStore` cuando entra `/:country` y lo destruye cuando sale.
- Cambio de país = salir de `/co` → crear un nuevo `WizardStore` para `/cl`. No se arrastra estado.
- Al navegar a la pantalla de confirmación final (fuera del árbol del wizard) o al pulsar "cancelar" (que navega a `/`), Angular destruye el store → RN-01.13 cumplida.

**Interacción con formularios dinámicos (ADR-004):**

- Al desmontar el componente de paso 1, un `effect()` en `applicant-form.component.ts` escribe `form.getRawValue()` al store si el form es válido; si no, no se escribe (así, al volver, el paso 1 muestra el estado conocido más reciente válido). Alternativa: escribir siempre y mostrar errores al volver. Elegimos **escribir solo si válido** para alinearse con AC-01.5 ("los mensajes de error previos no se muestran hasta que vuelva a interactuar").
- Al montar paso 1, si `applicant` existe **y** `applicantFieldsSnapshot` coincide con los `keys` actuales de Strapi, se hidrata el form con esos valores. Si la configuración en Strapi cambió (p. ej. nuevo campo publicado — AC-01.4), los valores anteriores se preservan solo para los keys que siguen existiendo; keys nuevos quedan vacíos.

**No se usa storage:** no hay `effect()` que lea/escriba `localStorage` ni `sessionStorage`. La skill `angular-conventions` §5 debe actualizarse para reflejarlo (reportado en el handoff).

### Consecuencias

- ✅ Positiva: Mutaciones de estado explícitas y nombradas; `code-reviewer` puede exigir que solo el store mute sus propios campos.
- ✅ Positiva: Ciclo de vida atado a la rama `/:country` → imposible leak de PII entre países; RN-01.13 cumplida.
- ✅ Positiva: Compatibilidad total con `OnPush` y signals (es su propósito).
- ✅ Positiva: Tests unitarios triviales: se instancia `TestBed.configureTestingModule({ providers: [WizardStore] })` y se llaman los métodos; no requiere `provideStore` ni `provideEffects`.
- ⚠️ Negativa: **Nueva dependencia** `@ngrx/signals` no listada en CLAUDE.md §2. → Mitigación: justificación en §"Nueva dependencia" arriba; alternativa de salida (Opción B) documentada; decisión final la toma el humano en HITL-2.
- ⚠️ Negativa: Un refresh de página (`F5`) **pierde todo el formulario del paso 1**. Esto es intencional (RN-01.13), pero es una regresión UX frente a lo que decía la skill `angular-conventions`. → Mitigación: en el copy de sistema (`system-messages.ts`, ver G-01.10 pendiente) se puede añadir un aviso si se detecta que el usuario llegó a `paso-2` sin estado (redirigir a `paso-1` con un mensaje "los datos no se guardaron"). Guard de paso en ADR a futuro (no aquí).
- ⚠️ Negativa: Si Strapi cambia los `keys` de campos entre pasos (AC-01.4 publica un nuevo campo mientras el usuario está en paso-2), al volver a paso-1 el nuevo campo aparece vacío y bloquea el avance si es obligatorio. → Mitigación: aceptable y transparente al usuario; el `applicantFieldsSnapshot` detecta el cambio y muestra el estado parcial sin perder lo diligenciado.
- ⚠️ Negativa: Contradicción con la skill `angular-conventions` §5 ("sessionStorage"). → Mitigación: reportado al humano; la spec aprobada manda (CLAUDE.md §6.2) y la skill se actualizará en una tarea de mantenimiento post-HITL-2.
- ⚠️ Negativa: El shape del `applicant` es `Record<string, unknown>` porque es dinámico. → Mitigación: el tipado fuerte vive en el modelo de dominio producido tras `submit` (función `toApplicantModel` en ADR-004) y en los validadores; el store es un "staging" del form.

### Validación

- Test unitario (`wizard.store.spec.ts`, Vitest, título `AC-01.5 persists applicant across step navigation`): se crea el store, se llama `setApplicant({ documentNumber: '1234' }, ['documentNumber'])`, se lee `store.applicant()` → devuelve el objeto. Se llama `reset()` → `null`.
- Test de integración con router (Vitest con `RouterTestingHarness` o Playwright `AC-01.5`): usuario navega `/co/paso-1` → diligencia → avanza a `/co/paso-2` → vuelve → inputs conservan valores. Mensajes de error no visibles hasta nueva interacción.
- Test Playwright: refresh en `/co/paso-1` después de diligenciar → formulario vuelve a estar vacío (verifica RN-01.13: sin storage).
- Test unitario: inspección en runtime — tras el ciclo, `localStorage.length === 0` y `sessionStorage.length === 0` (puede ser un `beforeAll`/`afterEach` en Playwright).
- Test de aislamiento entre países: ir a `/co/paso-1`, diligenciar, navegar a `/cl/paso-1` → formulario vacío.
- Revisión (`review-checklist`): ningún `localStorage.setItem` ni `sessionStorage.setItem` en `apps/web`.

## Pros y contras de las opciones

### Opción A — `@ngrx/signals` SignalStore (elegida)

- ✅ Convención del equipo NgRx para store signal-first; API estable y pequeña.
- ✅ Mutaciones explícitas via `patchState` → fácil de auditar.
- ✅ Ciclo de vida atado a Angular DI (provisión por ruta).
- ❌ Nueva dependencia (5 kB + compromiso de mantener vigente con Angular 21).
- ❌ Aprender un pequeño DSL (`withState`, `withMethods`, `withComputed`, `withHooks`) adicional.

### Opción B — Servicio Angular puro con signals

- ✅ Cero dependencias nuevas.
- ✅ Idéntica capacidad para este caso de uso (3 signals, 4 métodos).
- ✅ Ciclo de vida igual con `providers` en ruta.
- ❌ Convención ad-hoc; el `code-reviewer` no tiene un patrón de la comunidad al que apuntar.
- ❌ Más fácil que alguien cree mutaciones en línea en vez de pasar por métodos del servicio.

### Opción C — NgRx global store

- ✅ Potente para apps grandes con muchos side-effects.
- ❌ Overkill para 3 signals de un wizard; acciones/reducers/selectors son ceremonia innecesaria.
- ❌ El store es global → provisión por ruta no aplica; destruir el estado al salir del árbol requiere escribir una acción `[Wizard] Reset` manual, más frágil.
- ❌ Dos dependencias (`@ngrx/store` + `@ngrx/effects`) y DevTools.

### Opción D — Signal local por componente / TanStack Query

- ✅ Mínimo código.
- ❌ No cumple RN-01.8/AC-01.5: al desmontar el paso 1 se pierde el estado — tendríamos que reconstruirlo de alguna fuente.
- ❌ TanStack Query no está en el stack.

## Camino de evolución

- **Guard de paso 2 que requiere paso 1 válido:** `step2Guard` consulta `WizardStore.applicant()`; si es `null`, redirige a `paso-1`. Compatible con este ADR, se añade en el ADR del wizard.
- **Persistencia opt-in para dev:** si en algún momento negocio pide "recordar lo diligenciado durante 10 minutos", se agrega un adaptador `withStorageSync({ ttl, keys })` que solo guarda **claves no-PII** (p. ej. plan seleccionado). Requeriría ADR nuevo que supersede este o lo complementa.
- **Más pasos / más estado:** `signalStore` escala agregando `withState`/`withMethods`/`withComputed` incrementalmente.
- **Compartir estado entre tabs:** `BroadcastChannel` opt-in; fuera de v1.
- **Equipo de 5 personas:** se documenta en la skill `angular-conventions` que el único store del wizard es `WizardStore` y que las mutaciones pasan por sus métodos.
