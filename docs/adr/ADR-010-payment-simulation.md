---
id: ADR-010
title: Simulación de pago en el front, número de cotización determinista y extensión de `WizardState` con `quoteNumber`
status: accepted
date: 2026-11-23
deciders: Jorge Argüelles
supersedes:
related: [SPEC-03, RN-03.5, RN-03.6, RN-03.7, RN-03.8, RN-03.9, RN-03.10, AC-03.4, AC-03.5, AC-03.6, AC-03.7, AC-03.14, AC-03.17, G-03.2, G-03.3, G-03.4, G-03.10, G-03.11, ADR-005, ADR-006]
---

# ADR-010 — Simulación de pago en el front, número de cotización determinista y extensión de `WizardState` con `quoteNumber`

## Contexto y problema

SPEC-03 convierte el paso 3 en el cierre del wizard. El "pago" es **simulado** y vive íntegramente en el front (RN-03.6, CLAUDE.md §7: "Solo datos ficticios. Nunca capturar datos de tarjeta."). Hay múltiples fuerzas a equilibrar:

- **AC-03.5** (pago exitoso) y **AC-03.6** (pago fallido con reintento) se contradicen aparentemente si el flujo "siempre" tiene éxito. Hace falta un mecanismo de prueba para forzar fallo (G-03.2).
- **AC-03.7** (no doble submit): el botón debe bloquearse durante el procesamiento (`aria-busy`), y el servicio debe ser idempotente ante clicks repetidos.
- **RN-03.8 / G-03.3**: el número de cotización tiene un formato definido `QT-{COUNTRY}-{YYYYMMDD}-{BASE36_6}`. Hay que elegir entre reducir un `crypto.randomUUID()` o `Math.random().toString(36)`; no son equivalentes en entropía ni en disponibilidad.
- **G-03.4**: delay de ~1500 ms, configurable; sin bloquear el thread principal.
- **G-03.10**: la aceptación de términos es **estado local** del componente, no persiste en `WizardStore`. Pero el **número de cotización** sí debe persistir para la pantalla de confirmación → nuevo campo `quoteNumber: string | null` en `WizardState` (modifica indirectamente ADR-005).
- **AC-03.17**: al abandonar la confirmación, el `WizardStore` se destruye (coherente con ADR-005 — provisión por rama `/:country`).
- **G-03.11 / AC-03.14**: log estructurado por intento, sin PII; accesibilidad del botón y mensajes de estado.
- **Navegación "atrás" tras confirmación**: si el usuario pulsa atrás del browser tras ver la confirmación, no debe volver al pago (el store está destruido por AC-03.17; además el guard de RN-03.10 redirigiría a paso-1). La decisión fina es: ¿`navigate` normal o `replaceUrl`?

Esta decisión **no cambia** la tecnología de store (`@ngrx/signals`, ADR-005), pero sí **añade un campo** a `WizardState`. Por eso este ADR documenta el delta sobre ADR-005 (no lo supersede: lo extiende aditivamente).

## Factores de decisión

- CLAUDE.md §7: sin datos de tarjeta, sin PII a sinks remotos, sin secretos.
- RN-03.6: el pago nunca llama a una pasarela real. Todo ocurre en el cliente.
- AC-03.5 + AC-03.7: durante el procesamiento, un signal booleano `busy` controla `disabled` y `aria-busy`; dos clicks concurrentes no deben disparar dos pagos.
- G-03.3: el formato del número es inequívoco, legible y trazable por país.
- G-03.4: delay configurable vía constante (default 1500 ms); los tests pueden reducirlo.
- G-03.10: consentimiento local al componente → simplifica el guard y la auditoría.
- G-03.11: logs estructurados reutilizando `logStructured` (ADR-006).
- Simplicidad: la opción más simple que cumple > la más robusta. No introducimos `rxjs/Observable` para 1500 ms de delay; una `Promise` con `setTimeout` basta.
- AC-03.17: destrucción del store al salir de la rama `/:country`; la pantalla de confirmación debe quedar fuera (o gestionar su propio ciclo) para no "resetear sola" el `quoteNumber` antes de mostrarlo.

## Opciones consideradas

Cuatro sub-decisiones acopladas:

### D1 — Cómo se activa el modo "fallar siempre" para e2e (G-03.2)

1. **D1-A — Query string `?simulatePaymentFailure=true`** interpretada por `PaymentService` al construirse. En producción nunca se lleva (no hay enlace que la añada). Playwright la añade en los tests de AC-03.6.
2. **D1-B — Variable de entorno** (`environment.simulatePaymentFailure`). Requiere builds distintos para tests y producción.
3. **D1-C — Header HTTP custom** interceptado por `PaymentService` (p. ej. `X-Simulate-Failure: true`). El pago es cliente-only; no hay HTTP real contra el que meter un header.
4. **D1-D — Mock injectable** sobrescrito solo en tests (`provide: PaymentService, useClass: FailingPaymentService`). No es ejercitable desde Playwright sin tocar código.

### D2 — Fuente de aleatoriedad para el sufijo BASE36_6

1. **D2-A — `crypto.randomUUID()` → eliminar guiones → tomar 6 chars y `toUpperCase()`**. Hex, no base36, pero el resultado visualmente es alfanumérico; el nombre "BASE36" en G-03.3 es laxo.
2. **D2-B — `crypto.getRandomValues(new Uint8Array(6))` → `toString(36)` byte a byte → pad y truncar a 6 chars `.toUpperCase()`**. Verdadera base36 con 36^6 ≈ 2.18 × 10^9 combinaciones.
3. **D2-C — `Math.random().toString(36).slice(2, 8).toUpperCase()`**. No criptográficamente seguro, pero suficiente para unicidad práctica en un pago simulado.
4. **D2-D — Timestamp + contador local**. Determinista; perfectamente único; pero predecible.

### D3 — Dónde vive `quoteNumber` y ciclo de vida

1. **D3-A — Extender `WizardState` con `quoteNumber: string | null`**. Se escribe antes de navegar a la confirmación; se destruye con el store al salir de la rama `/:country`. La pantalla de confirmación debe vivir dentro de la rama `/:country/*` para poder leerlo.
2. **D3-B — Pasar el `quoteNumber` como query param** (`/:country/confirmacion?qt=QT-CO-...`). El store se puede destruir antes; la URL contiene la verdad.
3. **D3-C — Pasarlo como `state` del Router** (`router.navigate(..., { state: { quoteNumber } })`). No sobrevive a refresh; no se muestra en URL.

### D4 — Navegación "atrás" tras confirmación

1. **D4-A — `router.navigate(['..., 'confirmacion'], { replaceUrl: true })`**: la entrada del history "resumen de pago" se **reemplaza** por "confirmación". Pulsar atrás lleva al paso anterior del wizard (que, al no tener estado, será redirigido por el guard a `paso-1`) o fuera del wizard.
2. **D4-B — `router.navigate` normal**: la confirmación es una nueva entrada. Atrás vuelve a `/paso-3`, pero el guard de RN-03.10 lo redirige a `paso-1` porque el store ya fue reseteado.
3. **D4-C — Deshabilitar el botón "atrás" del browser** (manipulación del history). Cosmético y frágil; rechazado.

## Decisión

### D1 — Modo "fallar siempre" vía query string

Opción elegida: **D1-A — Query string `?simulatePaymentFailure=true`.**

- Un solo build de Angular sirve dev, tests y producción (coherente con RN-01.9 / un solo build CO+CL): no se introducen variantes.
- Playwright la añade solo donde hace falta (`page.goto('/co/paso-3?simulatePaymentFailure=true')`), y los tests reales de éxito no la llevan.
- En producción, no hay ningún enlace que la añada; incluso si un usuario curioso la añade a mano, el único efecto es ver el mensaje de error de pago en una app de demo. No hay fuga de datos ni daño real.
- D1-B obliga a builds distintos → complica Docker Compose. D1-C exige un HTTP que no existe. D1-D no es manipulable desde Playwright sin tocar código.

**Implementación:**

```ts
// apps/web/src/app/features/wizard/payment/payment.service.ts
@Injectable()
export class PaymentService {
  private readonly route = inject(ActivatedRoute);
  private readonly countryCtx = inject(CountryContext);
  readonly busy = signal(false);

  async simulate(): Promise<PaymentOutcome> {
    if (this.busy()) {
      // AC-03.7 — segunda llamada concurrente retorna el mismo resultado pendiente.
      return this.inflight!;
    }
    this.busy.set(true);
    this.inflight = this.run();
    try {
      return await this.inflight;
    } finally {
      this.busy.set(false);
      this.inflight = null;
    }
  }

  private inflight: Promise<PaymentOutcome> | null = null;

  private run(): Promise<PaymentOutcome> {
    const shouldFail = this.route.snapshot.queryParamMap.get('simulatePaymentFailure') === 'true';
    return new Promise((resolve) => {
      setTimeout(() => {
        if (shouldFail) {
          resolve({ ok: false });
        } else {
          resolve({
            ok: true,
            quoteNumber: generateQuoteNumber(this.countryCtx.code()),
          });
        }
      }, PAYMENT_SIMULATION_DELAY_MS);
    });
  }
}
```

### D2 — Fuente de aleatoriedad

Opción elegida: **D2-B — `crypto.getRandomValues(new Uint8Array(N)) → base36 real → truncar a 6`.**

- `crypto.getRandomValues` está disponible en todos los navegadores objetivo (CLAUDE.md compatibilidad de SPEC-01 §7).
- Verdadera base36 (dígitos + letras a–z), coherente con el nombre que usa G-03.3.
- D2-A (`randomUUID` → hex) usa solo `[0-9a-f]` → base 16, no base36 (solo 16^6 ≈ 16.8 M combinaciones vs 36^6 ≈ 2.18 × 10^9). Nombre inconsistente con la spec.
- D2-C (`Math.random`) es predecible — para un pago simulado no es un ataque realista, pero D2-B es prácticamente gratis.
- D2-D (timestamp) hace números adyacentes predictibles y legibles como fecha; peor UX.

**Implementación:**

```ts
// apps/web/src/app/features/wizard/payment/quote-number.ts
const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

export function generateQuoteNumber(
  country: 'CO' | 'CL',
  now: Date = new Date(),
  randomSource: () => Uint8Array = () => {
    const buf = new Uint8Array(6);
    crypto.getRandomValues(buf);
    return buf;
  },
): string {
  const yyyymmdd = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const bytes = randomSource();
  let suffix = '';
  for (const b of bytes) {
    suffix += BASE36[b % 36];
  }
  return `QT-${country}-${yyyymmdd}-${suffix.toUpperCase()}`;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
```

- Inyectables `now` y `randomSource` en tests para determinismo.
- `pad2` evita dependencia de `Intl` para una operación trivial.

### D3 — `quoteNumber` en `WizardState`

Opción elegida: **D3-A — Extender `WizardState` con `quoteNumber: string | null`.**

- ADR-005 fija que el store se provee por la rama `/:country` y muere al salir del árbol. La ruta de confirmación vive **dentro** de la rama `/:country/confirmacion`, por lo que el store sigue vivo mientras la confirmación está en pantalla, y se destruye al navegar fuera (`/`, otro `/:otherCountry`, etc.). Esto satisface AC-03.17 sin lógica adicional.
- D3-B (query param) expone el número en la URL; no es sensible, pero si en el futuro se añade PII en la URL sería un problema; además la URL perdura en history incluso tras destruir el store. Menos limpio.
- D3-C (router state) se pierde en refresh; en la pantalla de confirmación, un `F5` mostraría un fallo (`quoteNumber: undefined`). D3-A también lo pierde (el store es memoria), pero AC-03.17 ya acepta que "abandonar el flujo destruye el estado", lo que incluye refresh. Consistente.

**Extensión aditiva a `WizardState`** (modifica el tipo definido en ADR-005 §Diseño concreto):

```ts
export type WizardState = {
  applicant: Record<string, unknown> | null;
  applicantFieldsSnapshot: string[] | null;
  selectedPlanId: string | null;
  quote: QuoteDraft | null;
  quoteNumber: string | null; // ← nuevo campo (ADR-010)
};

// En signalStore(withState<WizardState>({...})) el default es quoteNumber: null.
// Nuevo método:
setQuoteNumber(quoteNumber: string): void {
  patchState(store, { quoteNumber });
}
// reset() también incluye quoteNumber: null (ya cubierto por el spread completo).
```

**Flujo:**

1. Usuario marca checkbox (estado local del componente, G-03.10) y pulsa "pagar".
2. Componente llama `paymentService.simulate()`.
3. Si `outcome.ok`:
   - `wizardStore.setQuoteNumber(outcome.quoteNumber)`
   - `logStructured('payment.simulated', { country, planDocumentId, outcome: 'success', quoteNumber })`
   - `router.navigate(['/', country, 'confirmacion'], { replaceUrl: true })`
4. Si `!outcome.ok`:
   - `logStructured('payment.simulated', { country, planDocumentId, outcome: 'failure' })`  — sin `quoteNumber`.
   - Se muestra el mensaje `payment.failure` de `system-messages.ts` (G-03.9) y el botón vuelve a habilitarse (lo garantiza `busy: false` en el `finally` del servicio).
   - El checkbox sigue marcado (estado local del componente, no se toca).

**Guard de la ruta de confirmación** (nuevo, derivado de AC-03.17):

```ts
// Si confirmacionGuard no encuentra quoteNumber en el store, redirige a paso-1.
export const confirmacionGuard: CanActivateFn = () => {
  const store = inject(WizardStore);
  const router = inject(Router);
  const country = inject(CountryContext).code();
  if (store.quoteNumber() == null) {
    return router.createUrlTree(['/', country, 'paso-1']);
  }
  return true;
};
```

### D4 — Navegación "atrás" tras confirmación

Opción elegida: **D4-A — `router.navigate([... 'confirmacion'], { replaceUrl: true })`.**

- La entrada "paso-3" se **reemplaza** por "confirmacion" en el history → pulsar atrás no vuelve al pago. El siguiente destino hacia atrás es lo que hubiera antes de entrar al paso-3 (típicamente paso-2 o paso-1), que seguirá funcionando mientras el store exista; si el usuario sigue hacia atrás hasta salir del árbol `/:country`, el store se destruye.
- Si vuelve al wizard tras salir de `/:country`, el guard de RN-03.10 redirige a `paso-1`.
- D4-B deja "paso-3" en el history: atrás llevaría ahí, pero `step3Guard` (RN-03.10) redirige a `paso-1` si faltan datos — funciona, pero añade un paso de redirect visible al usuario.
- D4-C es cosmética y frágil.

### Contrato del servicio `PaymentService`

Interfaz pública:

```ts
export type PaymentOutcome =
  | { ok: true; quoteNumber: string }
  | { ok: false };

@Injectable()
export class PaymentService {
  readonly busy: Signal<boolean>;             // controla disabled + aria-busy
  simulate(): Promise<PaymentOutcome>;        // idempotente ante doble llamada
}
```

- `busy` es un `signal` → el template del componente del paso 3 lo bindea a `[disabled]="busy()"` y `[attr.aria-busy]="busy() ? 'true' : null"`.
- `simulate()`:
  - Si `busy()` ya es `true`, devuelve el `Promise` en vuelo (no duplica). AC-03.7.
  - Inicia `setTimeout(PAYMENT_SIMULATION_DELAY_MS)`.
  - Si `?simulatePaymentFailure=true`, resuelve con `{ ok: false }`.
  - En caso contrario, genera `quoteNumber` con `generateQuoteNumber(countryCtx.code())` y resuelve con `{ ok: true, quoteNumber }`.
- El servicio se provee a nivel del componente del paso 3 (no en root): cada visita al paso instancia uno nuevo; no hay estado residual entre intentos tras volver a navegar al paso.

### Constantes

```ts
// apps/web/src/app/core/system-messages.ts (nuevo o ampliado, G-03.9)
export const PAYMENT_SIMULATION_DELAY_MS = 1500;
export const SYSTEM_MESSAGES = {
  payment: {
    processing: 'Procesando pago…',
    failure: 'No pudimos completar el pago. Por favor intenta nuevamente.',
  },
  terms: {
    loadError: 'No pudimos cargar los términos. Intenta nuevamente.',
    empty: 'Los términos no están disponibles en este momento.',
    retry: 'Reintentar',
  },
  summary: {
    editData: 'Editar datos',
    changePlan: 'Cambiar plan',
  },
} as const;
```

- El valor exacto de las cadenas se afina en implementación; la clave es que vivan en `system-messages.ts` (CLAUDE.md §4).
- Los tests pueden sobrescribir `PAYMENT_SIMULATION_DELAY_MS` con `TestBed.overrideProvider` si en algún momento se promueve a `InjectionToken`; en v1 vive como `const` y Playwright acepta el delay real.

### Consecuencias

- ✅ Positiva: Pago simulado totalmente contenido en el cliente, sin red, sin PII, sin tokens.
- ✅ Positiva: AC-03.7 cumplida en el servicio (no en el componente) → imposible disparar dos pagos aunque el componente tenga un bug de binding.
- ✅ Positiva: `quoteNumber` tipado y persistido donde debe; `AC-03.17` se cumple por el ciclo de vida de ADR-005 sin lógica extra.
- ✅ Positiva: Fallo simulado ejercitable desde Playwright con un query param. Un solo build.
- ✅ Positiva: Formato de número determinista, legible, trazable por país (prefijo `QT-CO-...` / `QT-CL-...`). Permite agrupar logs en operaciones futuras.
- ⚠️ Negativa: El query param `?simulatePaymentFailure=true` queda expuesto en producción. Un usuario malintencionado podría llevar a otro a una URL con el param para "demostrar que la app falla". → Mitigación: es una app de demo (RN-03.6); el fallo no implica pérdida de datos ni de dinero; el log estructurado deja constancia; se puede documentar en `README` que el param es una herramienta de testing. Camino de evolución: detrás de un `environment.testMode`.
- ⚠️ Negativa: El valor de `PAYMENT_SIMULATION_DELAY_MS = 1500` suma 1.5 s a cada test e2e que ejercita el pago. → Mitigación: aceptable para los pocos tests involucrados; se puede reducir en Playwright inyectando un valor menor vía `TestBed` si se migra a `InjectionToken` (camino de evolución).
- ⚠️ Negativa: `quoteNumber` con 36^6 combinaciones tiene probabilidad de colisión no cero. Para una app de demo es irrelevante. → Mitigación: aceptable; si en el futuro se generan números "de verdad" debe hacerlo el backend con un contador serial.
- ⚠️ Negativa: El guard de confirmación añade una pieza de lógica extra; si se olvida, un refresh en `/:country/confirmacion` muestra un estado roto con `quoteNumber = null`. → Mitigación: el guard es trivial y testeado; AC-03.17 cubre el caso.
- ⚠️ Negativa: `replaceUrl: true` puede ser sorprendente para alguien debugueando. → Mitigación: comentario en el código `// ADR-010 D4-A — prevent back-to-payment`.
- ⚠️ Negativa: Modifica el `WizardState` de ADR-005 (añade `quoteNumber`). Técnicamente una ampliación, pero cualquier consumidor de `WizardState` ve el nuevo campo. → Mitigación: aditiva (nuevo campo opcional-por-valor `null`); los consumidores existentes no se rompen; se documenta explícitamente en este ADR como "extiende ADR-005".
- ⚠️ Negativa: `crypto.getRandomValues` lanza `TypeError` si el buffer es de longitud 0. → Mitigación: el código crea `Uint8Array(6)` fijo; test unitario cubre el caso.

### Validación

- **Test unitario** (`quote-number.spec.ts`, Vitest, `AC-03.5 generates well-formed quote number`): con `now = 2026-11-23` y `randomSource` que devuelve `[0,1,2,3,4,5]` → produce exactamente `QT-CO-20261123-012345`.
- **Test unitario** (`AC-03.5 quote number uses active country prefix`): `country = 'CL'` → prefijo `QT-CL-...`.
- **Test unitario** (`payment.service.spec.ts`, `AC-03.5 simulates success after delay`): con `PAYMENT_SIMULATION_DELAY_MS` mockeado a 10 ms y sin `?simulatePaymentFailure`, `simulate()` resuelve con `{ ok: true, quoteNumber: /^QT-CO-\d{8}-[A-Z0-9]{6}$/ }`.
- **Test unitario** (`AC-03.6 returns failure when query flag set`): con `simulatePaymentFailure=true` en route, `simulate()` resuelve con `{ ok: false }`.
- **Test unitario** (`AC-03.7 concurrent calls share the same inflight promise`): llamar `simulate()` dos veces sin esperar → ambas resuelven con el mismo resultado; `setTimeout` se dispara una sola vez (spy).
- **Test unitario** (`busy signal flips true during run and false after`): observar `busy()` antes, durante y después.
- **Test unitario** (`wizard.store.spec.ts`, `AC-03.5 store exposes quoteNumber after setQuoteNumber`): llamar `setQuoteNumber('QT-CO-...')` → `store.quoteNumber()` devuelve el valor; `reset()` lo vuelve a `null`.
- **Test unitario** (`confirmacionGuard redirects when quoteNumber is null`): guard devuelve `UrlTree` hacia `paso-1`.
- **Test unitario** (`payment logs structured event on success and failure without PII`): spy de `logStructured` → recibe `{ country, planDocumentId, outcome: 'success' | 'failure', quoteNumber? }` y no recibe `documentNumber` ni otros PII.
- **Test Playwright** (`AC-03.5 e2e happy path`): recorrer wizard CO → pagar → ver pantalla de confirmación con número `QT-CO-\d{8}-[A-Z0-9]{6}`.
- **Test Playwright** (`AC-03.6 e2e with ?simulatePaymentFailure=true`): recorrer wizard → navegar a paso-3 con el flag → pulsar pagar → ver mensaje `payment.failure`; el botón vuelve a habilitarse; el checkbox sigue marcado; segundo click de pagar repite el flujo.
- **Test Playwright** (`AC-03.7 double click only triggers one payment`): click rápido dos veces → una sola transición a confirmación.
- **Test Playwright** (`AC-03.17 back button after confirmation does not return to payment`): tras confirmación, `page.goBack()` → el usuario queda en paso-1 (vía guard) o fuera del wizard, nunca de vuelta a `/paso-3` con estado.
- **Test Playwright a11y** (`AC-03.14 aria-busy during payment`): durante el delay, el botón "pagar" expone `aria-busy="true"` y `disabled`.
- **Grep en CI** (`review-checklist`): `grep -R -nE 'documentNumber|rut|cedula' apps/web/src/app/features/wizard/payment` → build falla si encuentra PII en el módulo de pago.

## Pros y contras de las opciones

### D1-A — Query string (elegida)
- ✅ Un solo build; ejercitable desde Playwright.
- ✅ Scope local a la URL; no afecta a otros usuarios.
- ❌ Expuesto en producción; se documenta como herramienta de testing.

### D1-B — Variable de entorno
- ✅ No visible al usuario.
- ❌ Dos builds o requiere runtime-config; complica Docker Compose.

### D1-C — Header HTTP
- ❌ No hay HTTP real contra el que meter el header.

### D1-D — Mock injectable
- ❌ No manipulable desde Playwright sin tocar código.

### D2-A — `crypto.randomUUID`
- ✅ API moderna; suficiente entropía.
- ❌ Hex, no base36; nombre inconsistente con G-03.3.
- ❌ Solo 16^6 ≈ 16.8 M combinaciones.

### D2-B — `crypto.getRandomValues` + base36 real (elegida)
- ✅ Verdadera base36; 36^6 ≈ 2.18 × 10^9.
- ✅ Disponible universalmente.
- ✅ Determinizable en tests con `randomSource` inyectable.
- ❌ Unos pocos chars extra de código vs `randomUUID`.

### D2-C — `Math.random`
- ✅ Sin ceremonia.
- ❌ No criptográficamente seguro (irrelevante para una demo, pero D2-B lo es gratis).

### D2-D — Timestamp + contador
- ✅ Determinista y único.
- ❌ Predecible y "visualmente" se parece a una fecha; peor UX.

### D3-A — Campo en `WizardState` (elegida)
- ✅ Patrón uniforme con el resto del wizard.
- ✅ Ciclo de vida garantizado por ADR-005.
- ❌ Modifica el tipo de `WizardState` (aditivo).

### D3-B — Query param
- ✅ Sobrevive a refresh.
- ❌ URL expone el número; menos limpio; el store muere antes.

### D3-C — Router state
- ✅ No contamina URL.
- ❌ Muere en refresh; AC-03.17 se cumpliría por accidente, no por diseño.

### D4-A — `replaceUrl: true` (elegida)
- ✅ Atrás no vuelve al pago.
- ❌ Comportamiento "sorprendente" si no se documenta.

### D4-B — Navegación normal
- ✅ Natural.
- ❌ Atrás vuelve a paso-3; el guard redirige, pero el usuario ve un flicker.

### D4-C — Manipular history
- ❌ Frágil y poco fiable entre navegadores.

## Nueva dependencia

Este ADR **no introduce dependencias nuevas**. `crypto.getRandomValues` es Web Crypto API nativa; `setTimeout` y `Promise` son estándar; Angular Router y `@ngrx/signals` ya están en el stack.

## Camino de evolución

- **Backend real:** el `PaymentService` se divide en interfaz pública + adaptador; en producción la implementación llama a un endpoint real. El `quoteNumber` lo genera el backend.
- **`PAYMENT_SIMULATION_DELAY_MS` como `InjectionToken`:** si se quieren tests más rápidos o configuración por entorno sin recompilar.
- **`?simulatePaymentFailure=true` detrás de `testMode`:** cuando haya staging/prod real, el flag solo se honra si `environment.testMode === true`.
- **Reintento automático con backoff:** fuera de v1 para un pago simulado; aplica cuando haya backend real.
- **Idempotency key:** cuando haya backend real, el `quoteNumber` se convierte en el `Idempotency-Key` del request.
- **Observabilidad:** `logStructured('payment.simulated', ...)` se conecta a un sink (OpenTelemetry) en el futuro.
- **Más países:** el prefijo `QT-{COUNTRY}-...` ya está preparado para cualquier código de país.
- **Equipo de 5 personas:** la lista de query params "especiales" (`simulatePaymentFailure`) se centraliza en `apps/web/src/app/core/test-flags.ts` para que `code-reviewer` los audite.
