---
id: ADR-002
title: Resolución del país activo por prefijo de ruta `/:country` con `CanMatch` guard
status: accepted
date: 2026-11-23
deciders: Jorge Argüelles
supersedes:
related: [SPEC-01, RN-01.9, AC-01.1, G-01.1]
---

# ADR-002 — Resolución del país activo por prefijo de ruta `/:country` con `CanMatch` guard

## Contexto y problema

SPEC-01 usa un único build de Angular para servir CO y CL (RN-01.9). El país activo determina:

- Qué campos trae Strapi (`filters[country][code][$eq]=<country>`, AC-01.1).
- El `locale` para `Intl` (G-01.7 pendiente, pero este ADR lo prepara).
- La moneda, los planes y los T&C en US-02/US-03.

RN-01.9 ya decidió el **mecanismo** (prefijo de ruta con guard), pero no cómo se implementa en Angular 21: qué tipo de guard, dónde se expone el país al resto de la app, cómo se inyecta en el cliente HTTP, cómo se comporta el bootstrap cuando el usuario entra a `/` sin país, y cómo se comporta ante un valor inválido.

G-01.1 cita también las alternativas que HITL-1 descartó (subdominio, query param, localStorage). Este ADR documenta por qué siguen descartadas desde el punto de vista arquitectónico.

## Factores de decisión

- Un solo build, mismo origen, proxy nginx hacia Strapi (CLAUDE.md §7).
- URLs compartibles y marcables (`https://app/co/paso-1` debe funcionar sin estado previo).
- Cero tokens en el cliente (CLAUDE.md §7) — el país no es un secreto, pero sí debe ser derivable sin pedirle a un servicio externo.
- `inject()` y signals en todo el código Angular (CLAUDE.md §2).
- Trazabilidad: cada petición a Strapi debe llevar el país y debe ser recorrible por `grep` en el código.
- AC-01.1 exige test del comportamiento por país (CO y CL) — el mecanismo debe ser determinista y fácil de simular en Playwright.
- Simplicidad para evaluación.

## Opciones consideradas

1. **Opción A — Prefijo de ruta `/:country` con `CanMatch` guard + `CountryContext` como signal provisto en root.** La raíz `/` redirige a `/co`. El guard valida el segmento (`co` o `cl`), publica el país en un `CountryContext` (clase con un `signal<Country>`), y las features lo leen con `inject(CountryContext).country()`. Un `HttpInterceptor` lo añade a las peticiones de Strapi.
2. **Opción B — Subdominio por país (`co.app`, `cl.app`).** El host determina el país al bootstrap antes de instanciar el router.
3. **Opción C — Query param (`?country=co`) resuelto en bootstrap.** Un servicio lee `location.search` y publica el país.
4. **Opción D — `localStorage` como fuente de verdad** (una pantalla inicial pregunta y guarda).

## Decisión

Opción elegida: **Opción A — Prefijo de ruta `/:country` con `CanMatch` guard + `CountryContext` signal**, porque:

- RN-01.9 ya fija "prefijo de ruta con guard"; este ADR completa el **cómo** en Angular 21.
- `CanMatch` (no `CanActivate`) es la guard adecuada en Angular 21 para decidir si una rama de rutas aplica: evita que Angular instancie componentes de la rama cuando el segmento no es válido, lo que impide flashes de UI y simplifica los tests. Un `CanActivate` también funciona pero cambia la semántica (la rama matchea y luego se niega).
- Publicar el país como `signal` en un servicio `CountryContext` provisto en root es la forma natural en Angular 21 con el stack permitido (signals nativos, sin NgRx para esto). `computed()` en los features consume el país.
- Un `HttpInterceptor` que lee `CountryContext` y añade el filtro mantiene la trazabilidad en un solo lugar (`core/` según la skill `angular-conventions` §1).
- Es la opción **más simple** que cumple todos los factores: URLs compartibles, SEO neutral, tests determinísticos con Playwright, cero dependencia externa.

### Diseño concreto

**Ruteo (`app.routes.ts`):**

```ts
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'co' },
  {
    path: ':country',
    canMatch: [countryGuard],
    providers: [provideCountryContext()],
    loadChildren: () => import('./wizard/wizard.routes'),
  },
  { path: '**', redirectTo: 'co' },
];
```

**Guard (`country/country.guard.ts`):**

```ts
export const countryGuard: CanMatchFn = (route) => {
  const segment = route.url[0]?.path?.toLowerCase();
  const context = inject(CountryContext);
  if (segment === 'co' || segment === 'cl') {
    context.set(segment.toUpperCase() as Country);
    return true;
  }
  return inject(Router).parseUrl('/co');
};
```

**Contexto (`country/country.context.ts`):**

```ts
@Injectable({ providedIn: 'root' })
export class CountryContext {
  readonly #country = signal<Country | null>(null);
  readonly country = computed(() => {
    const c = this.#country();
    if (!c) throw new Error('CountryContext accedido fuera de la rama /:country');
    return c;
  });
  set(c: Country): void { this.#country.set(c); }
}
```

El `throw` en el `computed` protege contra accesos accidentales desde fuera del árbol — se detectará en el primer test unitario que lo use mal.

**Interceptor (`core/strapi.interceptor.ts`):** añade el filtro `filters[country][code][$eq]` a toda petición `/api/form-fields`, `/api/plans`, `/api/countries` cuando falte. Si `CountryContext.country()` lanza (no estamos bajo `/:country`), no intercepta.

**Locale:** a futuro, `CountryContext` expondrá también `locale` derivado (`es-CO`, `es-CL`) para `Intl` (resuelve G-01.7).

### Consecuencias

- ✅ Positiva: URLs compartibles y marcables. `https://app/co/paso-1` funciona en una pestaña nueva sin estado previo.
- ✅ Positiva: SEO neutro (si algún día se indexa, cada país es una URL distinta).
- ✅ Positiva: Tests Playwright triviales: `page.goto('/co/paso-1')` vs `/cl/paso-1` — cumple AC-01.1 sin mocks.
- ✅ Positiva: Cambio de país = navegación a `/cl/...`. El guard re-ejecuta y re-setea el contexto. Al estar provisto en root con `set()`, el cambio es síncrono y disparan `computed()`/`effect()` en toda la app.
- ✅ Positiva: Cero dependencia nueva. Usa solo `@angular/router` y signals nativos.
- ⚠️ Negativa: Un bookmark a `/co/paso-2` sin haber pasado por `/co/paso-1` entra a un wizard sin datos. → Mitigación: guards de paso en `wizard.routes.ts` (ya previstos en `angular-conventions` §5 y en RN-01.8) redirigen a paso 1 si falta estado. Este ADR no los define en detalle — son parte de ADR-005.
- ⚠️ Negativa: Al redirigir `''` → `/co`, un usuario chileno siempre aterriza primero en CO y debe cambiar a CL. → Mitigación: detección por `navigator.language` en una capa opcional (si empieza por `es-CL` redirige a `/cl`) queda como evolución; para v1 es aceptable y determinístico.
- ⚠️ Negativa: Si alguien del equipo inyecta `CountryContext` desde un componente **fuera** de la rama `/:country`, el `computed` lanza. → Mitigación: el error es explícito y se detecta en el primer render de test; se documenta en la skill `angular-conventions` §1.
- ⚠️ Negativa: El guard solo valida 2 valores literalmente. Si alguna vez se agrega MX o PE, hay que tocar el guard y el enum. → Mitigación: aceptable; de todos modos agregar un país exige cambios en Strapi, planes, validadores y traducciones. El guard es la señal correcta de "aquí se agrega un país".

### Validación

- Test unitario (`country.guard.spec.ts`, Vitest): segmentos `co`, `cl`, `CO`, `CL` → `true` + `context.set()` llamado con el valor correcto; segmentos `us`, `xx`, `` → devuelve `UrlTree` a `/co`.
- Test unitario (`country.context.spec.ts`): acceder a `country()` sin `set()` previo lanza.
- Test Playwright (`wizard.co.spec.ts`, `wizard.cl.spec.ts`) — títulos `AC-01.1 CO shows configured fields in order` y `AC-01.1 CL shows configured fields in order`: `page.goto('/co/paso-1')` → el request a `/api/form-fields` contiene `filters[country][code][$eq]=CO`.
- Test Playwright: `page.goto('/')` → se redirige a `/co/paso-1`.
- Test Playwright: `page.goto('/us/paso-1')` → redirige a `/co`.
- Revisión de checklist (`review-checklist`): ningún `fetch('/api/...')` directo escapa al interceptor.

## Pros y contras de las opciones

### Opción A — Prefijo de ruta + guard + CountryContext (elegida)

- ✅ URLs compartibles; mismo build; SEO neutro.
- ✅ Tests Playwright triviales por URL.
- ✅ Único mecanismo canónico (`inject(CountryContext)`) para leer el país en toda la app.
- ❌ Un bookmark directo a un paso intermedio requiere guards adicionales.
- ❌ El default `''` → `/co` arranca mal para chilenos.

### Opción B — Subdominio por país

- ✅ Country se resuelve antes del router — cero riesgo de leak entre países (p. ej. estado compartido en storage).
- ✅ Separación "física" ayuda si en el futuro se quieren CDNs o analíticas distintas.
- ❌ Requiere DNS y certificados por subdominio en dev y prod → fricción enorme para evaluación (`docker compose up` en dev no puede entregarlo sin hacks de `/etc/hosts`).
- ❌ Un operador no puede compartir `https://app/co/paso-1` con un chileno fácilmente: cross-subdomain confunde.
- ❌ Los guards y tests siguen necesitándose igual.

### Opción C — Query param (`?country=co`)

- ✅ Cero config de ruteo extra.
- ✅ Funciona con un solo dominio sin DNS.
- ❌ Un bookmark a `/paso-1` sin query es ambiguo: ¿a qué país mandamos? → se cae de vuelta a Opción A con pasos extra.
- ❌ URLs feas; más fácil de perder el query al navegar con `router.navigate(['paso-2'])` si alguien olvida pasar `queryParamsHandling: 'preserve'`.
- ❌ `AC-01.1` y `AC-01.4` necesitan refresh; mantener el query en refresh exige disciplina en cada `navigate`.

### Opción D — `localStorage`

- ✅ Una sola fuente de verdad, cómoda para "recordar" al usuario.
- ❌ Contradice RN-01.13 (nada en storage), que si bien se refiere al wizard, es la filosofía del proyecto.
- ❌ URLs no comparten el país: `/paso-1` renderiza distinto para dos usuarios → tests y QA frágiles.
- ❌ SSR y cache de nginx se complican.

## Camino de evolución

- **Detección automática por `Accept-Language` / `navigator.language`:** una capa opcional en el redirect `''` → `/<país>` elige el país por idioma del navegador. Compatible con este ADR.
- **Más países:** el `CanMatch` crece a `['co', 'cl', 'mx', 'pe']` y el enum `Country` también. El resto no cambia.
- **Mayor escala / SSR:** `CountryContext` seguirá funcionando bajo SSR siempre que no se lea en inicializadores globales; el guard se ejecuta por request. Si llega tráfico serio, nginx puede routear `/co` a un backend y `/cl` a otro sin tocar Angular.
- **Equipo de 5 personas:** se documenta en la skill `angular-conventions` que **la única forma** de obtener el país es `inject(CountryContext).country()`, revisado en PR.
