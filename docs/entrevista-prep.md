# Prep de entrevista técnica — Seguro Auto Multi-País

> Usar para practicar antes de la llamada con el líder técnico.

---

## Documento ejecutivo (pitch de 5 min)

### Qué construí y por qué importa

Implementé un wizard de cotización de seguro de auto multi-país (Colombia y Chile) donde **todo el contenido está configurado en un CMS (Strapi) sin necesidad de redeploy**. Un solo build de Angular sirve ambos países; los campos del formulario, los planes y los términos legales se crean o modifican en Strapi y el frontend los refleja en tiempo real.

La decisión central fue separar **configuración** (CMS) de **comportamiento** (Angular): el frontend no sabe qué campos va a renderizar, qué validadores aplicar, ni qué planes mostrar hasta que consulta Strapi. Esto permite que el equipo de negocio opere Colombia y Chile de forma independiente sin tocar código.

### Stack y decisiones clave

**Angular 21 Signals + standalone components.**
No usé NgModules porque Angular los está deprecando. Signals reemplazan RxJS para estado local: más predecibles, sin memory leaks por subscripciones no canceladas, integración nativa con `OnPush`. El único RxJS que quedó es para los `HttpClient` calls.

**NgRx SignalStore scoped a la ruta.**
El wizard comparte estado entre 3 pasos. `signalStore` con provider en `/:country` da una instancia por país que se destruye al salir. **Decisión de seguridad explícita**: sin `localStorage` ni `sessionStorage` — RUT y cédula son datos PII.

**Zod en cada respuesta de red.**
Toda respuesta de Strapi pasa por `safeParse` antes de llegar al componente. Campos desconocidos se descartan y se loguean; la app nunca rompe por un campo nuevo en el CMS.

**Rol Public definido en código.**
Permisos en el `bootstrap` de Strapi, no en la UI admin. Deploy limpio = permisos correctos. Frontend llama a `/api` como mismo origen vía nginx — sin tokens en el bundle.

### Problemas reales que resolví

| Problema detectado en review | Causa raíz | Solución |
|---|---|---|
| Documento de identidad completo en el DOM | `SummaryComponent` mostraba todos los valores sin filtrar | `isDocumentKey()` prefix-match + formatter de últimos 4 dígitos |
| Navegación por teclado en planes rota | `tabIndex` estático viola patrón WAI-ARIA radiogroup | Roving tabindex + flechas seleccionan + `setTimeout(0)` para diferir `.focus()` |
| Screen reader ignoraba precio y badge del plan | `aria-label` sobreescribe todo el contenido del elemento | Reemplazado por `aria-labelledby` apuntando a IDs del h2, badge y precio |
| Botón "atrás" volvía al formulario de pago | Confirmación en mismo componente, sin `replaceUrl` | Ruta separada `/:country/confirmacion` + guard que verifica `quoteNumber !== null` |
| Campos Strapi nuevos rompían el formulario | Schema Zod demasiado estricto | `safeParse` tolerante: descarta + loguea campos desconocidos, nunca lanza |

### Proceso agéntico

6 tipos de agentes especializados con responsabilidades exclusivas:
`spec-writer → architect → cms-builder + frontend-builder → test-engineer → code-reviewer`

Los fixes en HITL-3 se distribuyeron entre 5 agentes en **git worktrees paralelos** con ownership exclusivo de archivos → cero conflictos de merge.

**Resultado final:** 48 ACs · 266 unit tests · 109 e2e tests · 5 reviews · 12 ADRs · lint 0 warnings.

---

## Preguntas y respuestas

---

### Arquitectura

**P1. `WizardStore` vive en memoria. Si el usuario recarga la página a mitad del wizard, pierde todo. ¿Cómo manejarías eso en producción sin guardar PII en el browser?**

La decisión actual es intencional y está en ADR-005: sin persistencia en el browser por los datos PII. En producción hay tres opciones reales:

- **Sesión server-side**: al avanzar cada paso, `POST /api/session/{id}` guarda el estado cifrado en el backend. El browser solo guarda el `sessionId` (UUID sin PII). El wizard hidrata desde el server en cada carga.
- **Token de sesión en memoria + URL**: pasar el `sessionId` como query param. Recarga = misma sesión. Riesgo: aparece en logs del server.
- **Aceptar la pérdida**: para un wizard de cotización de <3 min, la experiencia de reinicio es tolerable si el formulario rehidrata campos desde el CMS y el usuario puede rellenar rápido. Es la decisión correcta para MVP.

Yo priorizaría la opción 1 en producción, con expiración de 30 min en el server.

---

**P2. Strapi usa SQLite en desarrollo. ¿Qué cambiarías para producción y qué impacto tiene en el Docker Compose?**

SQLite es single-writer: no escala horizontalmente. Para producción:

- Cambiar `config/database.ts` a PostgreSQL (Strapi lo soporta nativamente).
- Agregar `postgres` service al `docker-compose.yml` con un volumen persistente.
- Mover credenciales a variables de entorno (`.env` real, no commiteado).
- El seed idempotente no cambia — `strapi.documents()` funciona igual contra Postgres.
- Las migraciones de schema en Strapi 5 son automáticas si `autoMigrate: true` (dev) o manuales con `strapi migration:run` (prod).

Consideración adicional: el `build/` de Strapi (TypeScript compilado) se debe regenerar si cambia el schema. En el Docker actual lo hace el `Dockerfile` del CMS.

---

**P3. El frontend llama a `/api` vía nginx proxy. ¿Qué pasaría si alguien llama directamente al puerto 1337 de Strapi desde el browser? ¿Cómo lo mitigarías?**

En el Docker Compose actual, el puerto 1337 está expuesto en el host (`0.0.0.0:1337`). Alguien en la misma red podría llamar directamente a Strapi y obtener los mismos datos que el frontend — no hay daño adicional porque el rol Public solo tiene `find` en 3 colecciones.

Para mitigarlo en producción:
- **No exponer 1337 en el host**: en `docker-compose.yml`, quitar el mapeo de puertos del servicio `cms` y solo dejarlo en la red interna de Docker (`expose: 1337` sin `ports:`). Solo nginx puede llegar a él.
- **Whitelist de origen en Strapi**: configurar `CORS` con `origin: ['https://mi-dominio.com']`.
- **Rate limiting en nginx** para las rutas `/api/*`.

El admin de Strapi (`/admin`) es el riesgo real: si queda expuesto sin autenticación fuerte en producción, un atacante puede modificar el contenido. Mitigación: `ADMIN_JWT_SECRET` fuerte + 2FA si Strapi Enterprise.

---

**P4. Usaste `signalStore` con provider scoped a la ruta. ¿Qué pasa si dos tabs del browser abren `/co` y `/cl` simultáneamente? ¿Comparten estado?**

No comparten estado. Cada tab tiene su propia instancia del proceso JavaScript del browser — el `signalStore` vive en memoria de esa instancia. Dos tabs = dos instancias independientes de Angular, dos instancias independientes del store.

Dentro de **una misma tab**, si el usuario navega de `/co` a `/cl`, la ruta `/:country` destruye el provider de `/co` (con su store) y crea uno nuevo para `/cl`. Esto está cubierto por el `countryGuard` que valida el segmento de país contra una lista.

El edge case que sí existe: si el usuario abre `/co/paso-3` directamente en una tab nueva, el `step3Guard` detecta que `selectedPlan === null` y redirige a `/co/paso-1`. Esto está cubierto por AC-03.9 y su test e2e.

---

### Código

**P5. `buildValidators()` genera validadores en tiempo de render. Si el campo `vehicleYear` tiene `anio_vehiculo`, ¿ese valor se captura en el closure al montar el componente o se evalúa en cada keystroke?**

Se evalúa **en cada keystroke** (o en cada `blur` según la estrategia del control). El `ValidatorFn` de Angular es una función que Angular llama cada vez que necesita validar — no es un valor calculado una vez.

En `vehicle-year.ts`, el validador `anioVehiculo` hace `new Date().getFullYear()` dentro del body de la función:

```ts
export const anioVehiculo: ValidatorFn = (control) => {
  const currentYear = new Date().getFullYear(); // se evalúa en cada llamada
  ...
};
```

Esto es correcto para un campo de año: si el usuario deja el formulario abierto a las 23:59 del 31 de diciembre y lo envía a las 00:01 del 1 de enero, el validador usa el año correcto. El único costo es una llamada a `Date.getFullYear()` por validación, que es O(1) y negligible.

---

**P6. En `FieldRendererComponent`, `#promoteToChangeMode()` agrega event listeners nativos al DOM. ¿Hay algún escenario donde no se limpien correctamente?**

Sí. El cleanup depende de que `this.#statusSub?.unsubscribe()` sea llamado. Esto sucede en `ngOnDestroy()`. El riesgo existe si:

1. El componente se destruye antes de que `#promoteToChangeMode()` sea llamado (no hay leak porque no se crearon listeners).
2. El componente se destruye **después** de que se haya promovido: en ese caso `ngOnDestroy()` llama a `this.#statusSub?.unsubscribe()`, que ejecuta el `.add()` callback que llama a `removeEventListener`. Correcto.
3. **Edge case real**: si `#promoteToChangeMode()` se llama **mientras la vista está siendo desmontada** (race condition rara en CD asíncrono), el `nativeElement` podría ser null en el `removeEventListener`. Mitigación: guard `if (nativeEl)` en el cleanup callback — que actualmente no existe.

Mejora concreta:
```ts
this.#statusSub.add(() => {
  nativeEl?.removeEventListener('input', onValueEvent);  // null-safe
  nativeEl?.removeEventListener('change', onValueEvent);
});
```

---

**P7. `parseFormFields()` descarta silenciosamente campos y llama a `logStructured()`. ¿Qué herramienta usarías en producción para que ese log llegue a ops?**

`logStructured()` actualmente hace `console.warn` con un objeto JSON estructurado. En producción necesita un **sink real**:

- **Datadog / New Relic / Sentry**: el browser SDK intercepta `console.error` automáticamente. Para `console.warn`, o bien se configura el nivel de captura o se llama a `Sentry.captureMessage()` directamente en `logStructured()`.
- **OpenTelemetry**: emitir un span con atributos en lugar de un log. Más semántico para alertas basadas en contadores ("más de 5 campos descartados en 1 hora").
- **Backend endpoint propio**: `POST /api/telemetry` que el nginx proxea. Permite agregar contexto del server (IP, session) que el browser no tiene.

La clave es que el log incluya el `documentId` del campo descartado y el `rule` que falló — ya lo hace — para que ops pueda pedirle al equipo de CMS que corrija el schema sin necesidad de un ingeniero de front.

---

### Testing

**P8. Los e2e mockean todas las llamadas a Strapi con `page.route()`. ¿Qué bugs no detectarías? ¿Qué agregarías?**

No detectarías:
- **Bugs de integración real**: si Strapi cambia el shape de la respuesta (campo renombrado, tipo cambiado), los mocks siguen pasando pero la app real falla.
- **Bugs de autenticación/permisos**: el mock responde 200 siempre; si el rol Public pierde el permiso en Strapi, los mocks no lo detectan.
- **Bugs de rendimiento/timeout**: el mock responde instantáneamente; Strapi real puede tardar 2 segundos y activar estados de carga que los mocks nunca ejercitan.
- **Bugs de seed**: si el seed no crea los datos correctamente, los mocks los ocultan.

Qué agregaría:
- **Contract tests** (Pact o similar): verifican que el schema Zod del frontend coincide con lo que Strapi realmente devuelve. Corren en CI contra una instancia real de Strapi.
- **Smoke tests** contra stack levantado: 2-3 tests e2e sin mocks que hagan el flujo completo contra Strapi real. Lentos, pero detectan los bugs de integración.
- En el repo actual, `docker compose up` + `npm run e2e` podría ejecutar ambas suites: la rápida (mocked) y la lenta (integration) según una variable de entorno.

---

**P9. El test de teclado de US-03 hace `checkbox.focus()` directamente en lugar de llegar por Tab desde el principio. ¿Qué AC no estás probando realmente?**

No estás probando que **el checkbox sea alcanzable por Tab desde el inicio del formulario** — es decir, que no haya ningún elemento con `tabindex="-1"` o `display:none` que lo saque del flujo natural de teclado.

Lo que el test sí verifica: que una vez en el checkbox, `Space` lo marca y `Tab` llega al botón Pagar. Eso cubre la *operabilidad* del elemento pero no su *alcanzabilidad* desde cero.

AC-03.14 dice "keyboard-only: Tab reaches checkbox and Pagar". Para cumplirlo completamente, el test debería hacer `page.keyboard.press('Tab')` repetidamente desde el primer elemento del DOM hasta llegar al checkbox, contando los pasos. El tradeoff fue pragmático: ese recorrido completo es frágil ante cambios de orden del DOM y no añade cobertura de negocio significativa. axe-core sí detecta si el checkbox tiene un label asociado correctamente, que es el riesgo real de accesibilidad.

---

### Proceso

**P10. En el flujo agéntico, ¿quién tiene autoridad para aprobar una spec? ¿Qué pasa si `spec-writer` agrega un AC que el stakeholder no pidió?**

La autoridad es **solo el humano** (HITL-1). `spec-writer` propone; el humano aprueba. La spec no tiene `status: approved` hasta que el humano la edita manualmente — ningún agente puede poner ese campo.

Cuando `spec-writer` agrega criterios marcados como `(agregado)` — que fue lo que pasó en esta prueba — está registrando huecos que detectó en la historia original. El humano en HITL-1 decide:
- Aceptar el AC: queda en la spec, se implementa.
- Rechazarlo: se elimina o se mueve a "fuera de alcance".
- Escalarlo: "no sé si esto es un requisito, necesito hablar con el stakeholder".

El riesgo real es que el agente agregue ACs que impliquen trabajo no presupuestado. La mitigación está en el proceso: el `spec-writer` siempre anota los ACs agregados con su ID de hueco (`G-0X.N`) y justificación, para que el humano tenga contexto suficiente para decidir en segundos, no minutos.

En esta prueba, el 30% de los ACs fueron agregados por `spec-writer` (ej. estados de carga, error, vacío; guards de acceso directo; enmascaramiento de documento). Todos fueron correctos en retrospectiva — ninguno resultó en scope creep no deseado.

---

## Checklist de práctica

- [ ] Explicar el stack sin leer estas notas (< 3 min)
- [ ] Responder P1 (store en memoria) con dos alternativas y tradeoffs
- [ ] Responder P3 (exposición puerto 1337) con medidas concretas
- [ ] Responder P5 (closure vs evaluación) sin dudar
- [ ] Responder P8 (gaps de testing) con al menos 3 bugs que no detectaría
- [ ] Explicar el flujo agéntico con el diagrama de FLOW.md de memoria
- [ ] Mencionar espontáneamente: Zod, PII/localStorage, `aria-labelledby`, `replaceUrl`, worktrees paralelos
