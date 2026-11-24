---
id: SPEC-03
story: US-03
title: Resumen de cotización y pago simulado
status: approved
version: 1
approved_by:
approved_at:
related_adrs: [ADR-003, ADR-005, ADR-006]
---

# SPEC-03 — Resumen de cotización y pago simulado

## 1. Resumen
Tercer y último paso del wizard de cotización. Muestra al usuario un resumen consolidado de lo diligenciado en el paso 1 (datos del titular y del vehículo) y del plan elegido en el paso 2, con su precio final en la moneda del país. El usuario debe aceptar los términos y condiciones (cuyo contenido viene de Strapi por país) antes de poder enviar un pago **simulado**. Un pago exitoso muestra una pantalla de confirmación con un número de cotización simulado; un pago fallido permite reintentar sin perder la información. Desde el resumen se puede volver a los pasos anteriores para editar datos o cambiar el plan.

## 2. Historia de origen
Ver `stories/US-03.md`.

> "Como persona que eligió un plan, quiero revisar un resumen de mi cotización y pagar, para quedar asegurada."

## 3. Reglas de negocio
| ID | Regla | Fuente |
|----|-------|--------|
| RN-03.1 | El resumen muestra tres bloques: datos del titular (paso 1), datos del vehículo (paso 1) y plan elegido (paso 2) con su precio final. | Historia |
| RN-03.2 | El número de documento del titular se muestra parcialmente enmascarado: solo los últimos 4 caracteres son visibles, el resto se sustituye por `*`. | Historia |
| RN-03.3 | El texto de los términos y condiciones proviene de Strapi, un documento por país, en estado publicado. El texto puede ser contenido enriquecido (rich text / blocks). | Historia + CLAUDE.md §4 |
| RN-03.4 | Desde el resumen el usuario puede navegar al paso 1 para editar datos o al paso 2 para cambiar el plan. Los valores ingresados se conservan (RN-01.8, ADR-005). | Historia |
| RN-03.5 | El botón "pagar" está deshabilitado hasta que el usuario marque explícitamente la casilla de aceptación de términos y condiciones. | Historia |
| RN-03.6 | El pago es simulado. No se capturan datos de tarjeta ni se llama a ninguna pasarela real. | CLAUDE.md §7 + Historia (contexto) |
| RN-03.7 | Mientras el pago simulado está en curso, el botón "pagar" queda deshabilitado y marcado con `aria-busy="true"`; no se puede enviar el pago dos veces. | Historia |
| RN-03.8 | Un pago exitoso muestra una pantalla de confirmación con un número de cotización simulado único por intento. | Historia |
| RN-03.9 | Un pago fallido muestra un mensaje de error claro, re-habilita el botón "pagar" y preserva todos los datos ingresados y el consentimiento de términos. | Historia |
| RN-03.10 | El paso 3 solo es accesible si el paso 1 y el paso 2 están completos. Si falta cualquiera, un `CanActivate` guard redirige al primer paso incompleto. | Historia (contexto) + ADR-005 |
| RN-03.11 | El número de documento completo no debe estar presente en el DOM del resumen; solo la versión enmascarada se renderiza. | Historia + CLAUDE.md §7 (privacidad) |

## 4. Criterios de aceptación

```gherkin
# AC-03.1 — Resumen completo
Scenario: El resumen muestra datos del titular, del vehículo y del plan elegido
  Given completé el paso 1 con datos válidos
  And seleccioné un plan en el paso 2
  When llego al paso 3
  Then veo un bloque con los datos del titular que ingresé
  And veo un bloque con los datos del vehículo que ingresé
  And veo un bloque con el plan elegido, su nombre y su precio final formateado en la moneda del país
```

```gherkin
# AC-03.2 — Documento enmascarado
Scenario Outline: El número de documento se muestra enmascarado
  Given el número de documento ingresado es <input>
  When veo el bloque de datos del titular en el resumen
  Then el valor mostrado es <masked>
  And los últimos 4 caracteres del documento son visibles
  And el documento completo no aparece en el DOM

  Examples:
    | input       | masked       |
    | 1023456789  | ******6789   |
    | 12345678-5  | *******78-5  |
    | 9876543     | ***6543      |
```

```gherkin
# AC-03.3 — Términos por país desde Strapi
Scenario Outline: El texto de términos y condiciones corresponde al país activo
  Given el país activo es <country>
  And Strapi tiene un documento `terms` publicado para <country>
  When llego al paso 3
  Then veo el contenido del documento `terms` configurado para <country>
  And el contenido se renderiza sin usar `innerHTML` sin sanitizar

  Examples:
    | country |
    | CO      |
    | CL      |
```

```gherkin
# AC-03.4 — Botón de pago deshabilitado hasta aceptar términos
Scenario: El botón "pagar" solo se habilita tras aceptar términos y condiciones
  Given estoy en el paso 3 con los términos cargados
  When la casilla de aceptación de términos está sin marcar
  Then el botón "pagar" está deshabilitado (`disabled`, `aria-disabled="true"`)
  When marco la casilla de aceptación
  Then el botón "pagar" queda habilitado
  When desmarco la casilla
  Then el botón "pagar" vuelve a estar deshabilitado
```

```gherkin
# AC-03.5 — Pago exitoso muestra confirmación con número de cotización
Scenario: Un pago simulado exitoso lleva a la pantalla de confirmación
  Given acepté los términos
  When pulso el botón "pagar"
  Then el botón queda deshabilitado y con `aria-busy="true"` mientras se procesa
  And al terminar el procesamiento veo una pantalla de confirmación
  And la confirmación muestra un número de cotización simulado único para este intento
```

```gherkin
# AC-03.6 — Pago rechazado muestra error y preserva datos
Scenario: Un pago simulado fallido permite reintentar sin perder información
  Given acepté los términos
  And la simulación está configurada para fallar (ver G-03.2)
  When pulso el botón "pagar"
  Then al terminar el procesamiento veo un mensaje de error de pago
  And el botón "pagar" vuelve a estar habilitado
  And la casilla de aceptación sigue marcada
  And los datos del paso 1 y el plan elegido no se pierden
  And al pulsar "pagar" de nuevo el flujo se repite
```

```gherkin
# AC-03.7 — No se puede enviar el pago dos veces
Scenario: Pulsar "pagar" múltiples veces durante el procesamiento no dispara múltiples pagos
  Given acepté los términos
  When pulso el botón "pagar"
  And pulso el botón "pagar" otra vez mientras aún se procesa
  Then solo se ejecuta un pago simulado
  And solo se muestra una confirmación (o un único error)
```

```gherkin
# AC-03.8 — Navegar a pasos anteriores conserva datos
Scenario Outline: Desde el resumen se puede volver a editar datos o cambiar de plan
  Given estoy en el paso 3
  When pulso la acción "<action>"
  Then regreso al <step>
  And los valores previamente ingresados se conservan
  And al volver al paso 3 el resumen sigue coincidiendo con lo elegido

  Examples:
    | action           | step    |
    | Editar datos     | paso 1  |
    | Cambiar plan     | paso 2  |
```

```gherkin
# AC-03.9 — Guard de acceso directo al paso 3 (agregado)
Scenario Outline: No se puede alcanzar el paso 3 sin completar los pasos previos
  Given el estado del wizard es <state>
  When intento navegar directamente a `/:country/paso-3`
  Then soy redirigido a <redirect>

  Examples:
    | state                                       | redirect |
    | sin datos de paso 1                         | paso 1   |
    | con datos de paso 1 pero sin plan elegido   | paso 2   |
    | con datos de paso 1 y plan elegido          | paso 3   |
```

```gherkin
# AC-03.10 — Estado de carga de términos (agregado)
Scenario: Mientras se obtiene el texto de términos desde Strapi se muestra un indicador
  Given la petición al CMS por `terms` aún no responde
  When abro el paso 3
  Then se muestra un indicador de carga accesible en el bloque de términos (`role="status"` o equivalente)
  And el botón "pagar" permanece deshabilitado hasta que los términos carguen
```

```gherkin
# AC-03.11 — Error de red al cargar términos (agregado)
Scenario: Si la petición de términos falla se muestra un estado de error controlado
  Given la petición a `/api/terms` devuelve un error de red o HTTP ≥ 500
  When abro el paso 3
  Then se muestra el mensaje de error de sistema definido en `system-messages.ts`
  And se ofrece una acción "reintentar" que vuelve a disparar la petición
  And el botón "pagar" permanece deshabilitado
  And el resto del resumen (datos del titular, vehículo y plan) se sigue mostrando
```

```gherkin
# AC-03.12 — Estado vacío de términos (agregado)
Scenario: No hay documento `terms` publicado para el país activo
  Given Strapi responde con cero documentos `terms` para el país activo
  When abro el paso 3
  Then se muestra un estado vacío con el mensaje de sistema correspondiente
  And el botón "pagar" permanece deshabilitado
  And la casilla de aceptación no se renderiza
```

```gherkin
# AC-03.13 — Precio final formateado por país (agregado)
Scenario Outline: El precio del plan se muestra en la moneda y formato del país activo
  Given el país activo es <country>
  And el plan elegido tiene precio final <amount>
  When veo el bloque del plan en el resumen
  Then el precio aparece formateado como <formatted>

  Examples:
    | country | amount  | formatted      |
    | CO      | 450000  | $ 450.000 COP  |
    | CL      | 35000   | $ 35.000 CLP   |
```
> Nota: los formatos concretos son una propuesta y dependen de G-03.6.

```gherkin
# AC-03.14 — Accesibilidad por teclado y lector de pantalla (agregado)
Scenario: El paso 3 es operable solo con teclado
  Given el paso 3 está cargado
  When navego el resumen únicamente con Tab / Shift+Tab / Enter / Space
  Then puedo alcanzar la casilla de términos, el botón "pagar", las acciones de volver y cualquier enlace a los términos
  And la casilla de aceptación tiene `label` asociado programáticamente
  And el botón "pagar" expone su estado con `aria-disabled` y `aria-busy` según corresponda
  And la pantalla de confirmación mueve el foco a un encabezado con `role="status"` o `aria-live="polite"`
  And axe-core no reporta violaciones `serious` ni `critical`
```

```gherkin
# AC-03.15 — Responsive 375 px y 1280 px (agregado)
Scenario Outline: El paso 3 es usable en móvil y en escritorio
  Given el viewport tiene ancho <width>
  When abro el paso 3
  Then los tres bloques del resumen son visibles sin scroll horizontal
  And el botón "pagar" mantiene un tamaño mínimo de toque de 44×44 px en móvil
  And el texto de términos es legible sin desbordar el contenedor

  Examples:
    | width   |
    | 375px   |
    | 1280px  |
    | 1280px  |
```

```gherkin
# AC-03.16 — El documento completo no aparece en el DOM (agregado)
Scenario: La máscara del número de documento es efectiva en el DOM
  Given el titular tiene documento `1023456789`
  When inspecciono el DOM del paso 3
  Then la cadena `1023456789` no aparece en ningún nodo de texto, atributo `title`, `aria-label` ni `data-*`
  And la cadena `******6789` (o equivalente) sí aparece
```

```gherkin
# AC-03.17 — Al salir de la confirmación el estado del wizard se limpia (agregado)
Scenario: Tras ver la confirmación, abandonar el flujo destruye el estado del wizard
  Given veo la pantalla de confirmación de un pago exitoso
  When navego a `/` o cierro el wizard
  Then el `WizardStore` se destruye (coherente con ADR-005)
  And si vuelvo a `/:country/paso-1` el formulario está vacío
```

## 5. Análisis de huecos
| ID | Hueco | Por qué importa | Propuesta | Decisión humana |
|----|-------|-----------------|-----------|-----------------|
| G-03.1 | Qué caracteres se enmascaran exactamente cuando el documento tiene separadores (guiones, puntos, DV del RUT). | AC-03.2 debe ser inequívoco: ¿se cuenta el DV como "último carácter"? ¿Se preserva el guion? Afecta tests y percepción de usuario. | Enmascarar carácter a carácter contando de derecha a izquierda **ignorando el guion del RUT**, de modo que siempre queden los 4 últimos caracteres **no separadores** visibles y el guion se preserve en su posición original. Ejemplos: `1023456789` → `******6789`; `12345678-5` → `*****678-5`. | |
| G-03.2 | Cómo se activa la simulación de pago rechazado para AC-03.6. | Sin un toggle explícito, el AC no se puede probar en e2e sin tocar código. | Añadir una query string `?simulatePaymentFailure=true` (o un flag en `system-messages.ts`) que fuerce el rechazo del próximo pago. En ausencia del flag, el pago **siempre** tiene éxito tras ~1.5 s. Playwright usa el flag; el flujo real en producción nunca lo lleva. | |
| G-03.3 | Formato exacto del número de cotización simulado (RN-03.8). | Define si es un UUID, un timestamp, un prefijo por país, etc. Impacta el test de AC-03.5 y la UX. | `QT-<country>-<yyyymmdd>-<base36 de 6 caracteres random>` (ej. `QT-CO-20261123-K3F9A2`). Genera legibilidad, unicidad práctica y trazabilidad por país. | |
| G-03.4 | Duración del "procesamiento" simulado y qué pasa en viewports lentos. | AC-03.5/AC-03.7 dependen de un tiempo durante el cual el botón está ocupado. Si es 0 ms, no hay forma de ver `aria-busy` ni probar el doble click. | Delay fijo de 1500 ms configurable vía constante `PAYMENT_SIMULATION_DELAY_MS` en `system-messages.ts` (o módulo equivalente de constantes). En tests, se puede reducir con un `inject()` sobrescrito. | |
| G-03.5 | Modelo de contenido de `terms`: ¿`text` plano, markdown, o Strapi Blocks? | ADR-003 §D5 anticipa que US-03 exigirá un renderer de bloques seguro. Si es rich text, hay que definir qué nodos se soportan y cómo se renderiza sin `innerHTML` directo. | Content-type `terms` con campo `body: blocks` (Strapi 5 rich text), renderizado con un componente `TermsBlocksRenderer` basado en `@strapi/blocks-react-renderer` o equivalente para Angular (o uno propio minimalista que soporte: paragraph, heading, list, link, bold, italic). Nuevo ADR requerido para el renderer. | |
| G-03.6 | Formato de moneda y separadores por país. | AC-03.13 depende de esto. CO y CL comparten símbolo `$` pero código ISO distinto; además el usuario podría esperar `COP` explícito para evitar ambigüedad. | Usar `Intl.NumberFormat(locale, { style: 'currency', currency })` con `locale = es-CO` y `currency = COP` para CO; `locale = es-CL` y `currency = CLP` para CL. Ambas monedas sin decimales (0 fracciones). Sufijo ISO explícito en el string final: `$ 450.000 COP`. | |
| G-03.7 | Permiso del rol Public para leer `terms` en Strapi. | ADR-003 solo habilitó `country.find` y `form-field.find`. Para esta spec hace falta `api::terms.terms.find` (o nombre equivalente). Sin esto, el front obtiene 403 y AC-03.3 falla. | Nuevo ADR (delta de ADR-003) que agrega `api::terms.terms.find` a `PUBLIC_READ_V3`. Permiso en código (`bootstrap`), nunca en el admin. | |
| G-03.8 | ¿El estado del wizard se puede reactivar tras una confirmación exitosa? | AC-03.17 destruye el store. Si el usuario pulsa "atrás" del navegador tras ver la confirmación, ¿qué ve? ¿Un paso 3 vacío? ¿Un redirect al home? | Tras pago exitoso, la pantalla de confirmación invalida el estado y cualquier navegación "atrás" al wizard dispara el guard de RN-03.10, que al no encontrar estado redirige a `paso-1`. La confirmación debe advertir "no uses el botón atrás del navegador" o reemplazar la entrada en el history (`router.navigate(..., { replaceUrl: true })`). | |
| G-03.9 | Copy de sistema para error de pago, error de red de términos y estado vacío. | Son textos de sistema (CLAUDE.md §4). Sin texto definido, el AC no es verificable. | Agregar entradas a `apps/web/src/app/core/system-messages.ts`: `payment.failure`, `payment.processing`, `terms.loadError`, `terms.empty`, `terms.retry`, `summary.editData`, `summary.changePlan`. | |
| G-03.10 | ¿El checkbox de términos es parte del `WizardStore` o solo estado local del componente? | Impacta AC-03.9 (guard) y qué pasa al navegar paso 3 → paso 2 → paso 3 (¿se conserva la aceptación?). | Estado **local** del componente del paso 3: el consentimiento se exige en cada entrada al paso. Esto evita persistir un consentimiento legal entre sesiones del flujo y es más conservador. Alternativa: persistir como `termsAcceptedAt: Date` en el store — más UX amigable pero legalmente discutible. | |
| G-03.11 | ¿Se registra algo del pago simulado (log, analítica)? | Si no, no hay forma de auditar los intentos en un entorno de demo/QA. | Log estructurado `logStructured('payment.simulated', { country, planDocumentId, outcome, quoteNumber })` sin PII; sin sink remoto en v1. Alineado con ADR-006. | |
| G-03.12 | ¿La aceptación de términos requiere también haber hecho scroll hasta el final del texto? | En algunos flujos legales se exige "leyó". Impacta UX y accesibilidad. | **No** en v1. El checkbox basta. Añadir un enlace "Ver términos completos" si el contenido se trunca en pantalla. | |
| G-03.13 | Comportamiento ante cambio de país durante el flujo (`/co/paso-3` → `/cl/paso-3` manual). | ADR-005 destruye el store al cambiar la rama `/:country`, lo que llevaría al nuevo país al paso 1 vacío. Pero AC-03.9 lo cubre como caso general de "estado incompleto". Vale la pena ser explícito. | Confirmar en AC: un cambio manual de país redirige a `paso-1` del nuevo país porque el guard no encuentra estado. Sin AC nuevo; sí mencionarlo en documentación. | |
| G-03.14 | ¿Se muestra una barra de progreso del wizard (paso 1/2/3)? | Mejora UX; no está en la historia. | Fuera de alcance de esta spec; registrar como mejora. | |
| G-03.15 | ¿Se permite imprimir o descargar la confirmación (PDF, mailto)? | Útil pero fuera de alcance. | Fuera de alcance de v1. Mostrar el número de cotización copiable con un botón "copiar al portapapeles" como mínimo aceptable. | |

## 6. Contrato de contenido (Strapi)

La pantalla del paso 3 consume del CMS un único documento de tipo `terms` publicado para el país activo. El resto del contenido del paso 3 (datos del titular, del vehículo y plan elegido) vive en el `WizardStore` y no requiere lecturas adicionales a Strapi (el plan ya fue cargado en el paso 2).

**Entidad conceptual: `Terms`**

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `documentId` | string | sí | Identificador de Strapi (Document Service API). |
| `country` | enum `CO` \| `CL` | sí | Determina para qué país aplica. Un documento por país. |
| `title` | string | sí | Título visible del bloque de términos (ej. "Términos y condiciones"). |
| `body` | blocks (rich text) | sí | Contenido legal. Ver G-03.5 para el conjunto de nodos soportados. |
| `effectiveDate` | date | no | Fecha desde la cual los términos aplican. Informativo en v1. |
| `version` | string | no | Etiqueta de versión legible (ej. `v1.0`). Útil para trazabilidad futura. |

**Reglas de consumo:**
- Solo se consumen documentos publicados (`publicationState=live`).
- Si hay más de un documento `terms` publicado para el mismo país, se usa el de `effectiveDate` más reciente (o el primero por `updatedAt` si no hay `effectiveDate`). Documentar en implementación.
- El front filtra por `country` igual al país activo.
- Se usa `populate` explícito para `body` si fuera necesario; prohibido `populate=*` (ADR-003 §D4).
- La respuesta se valida con un schema zod antes de usarse (ADR-006). Nodos de rich text con tipo desconocido se ignoran silenciosamente y se loguean con el `documentId`.
- El rol Public de Strapi necesita permiso `find` sobre `terms`. Este permiso **no está habilitado por ADR-003**; requiere un ADR delta (G-03.7).

## 7. Requisitos no funcionales
- **Accesibilidad:** navegación completa por teclado, `label` asociado al checkbox, `aria-disabled` y `aria-busy` en el botón "pagar", `role="status"` o `aria-live="polite"` para los cambios de estado (procesando, confirmación, error), foco visible, axe-core sin violaciones `serious` ni `critical` (AC-03.14). El contenido de rich text respeta jerarquía de headings y contraste.
- **Seguridad y privacidad:** número de documento enmascarado en el DOM (AC-03.16, RN-03.11); sin tokens en el front; sin captura de datos de pago; contenido rich de Strapi renderizado sin `innerHTML` sin sanitizar (ADR-003 §D5, G-03.5); respuesta de `terms` validada con zod (ADR-006); el pago simulado no envía PII fuera del cliente.
- **Responsive:** verificado a 375 px y 1280 px, sin scroll horizontal, controles táctiles ≥ 44×44 px en móvil (AC-03.15).
- **Estados:** carga de términos (AC-03.10), error de términos (AC-03.11), vacío de términos (AC-03.12), procesamiento de pago (AC-03.5), éxito (AC-03.5) y fallo (AC-03.6).
- **Rendimiento:** el bloque de resumen se renderiza instantáneamente desde el `WizardStore` sin esperar red; solo los términos requieren una petición. El pago simulado introduce exactamente el delay configurado (G-03.4), sin bloqueo del thread principal.
- **Compatibilidad:** última versión de Chrome, Safari, Firefox y Edge; iOS Safari y Android Chrome actuales. Coherente con SPEC-01 §7.
- **Trazabilidad:** el pago simulado emite un log estructurado por intento (G-03.11).

## 8. Fuera de alcance
- Integración con una pasarela de pago real (Mercado Pago, PayU, Webpay, Transbank, etc.).
- Captura, almacenamiento o transmisión de datos de tarjeta.
- Envío de correo de confirmación o generación de PDF.
- Impresión o descarga de la póliza / confirmación (G-03.15).
- Edición de los términos y condiciones desde el front (lo hace negocio en Strapi).
- Firma digital o de huella biométrica de los términos.
- Barra de progreso visual del wizard (G-03.14).
- Internacionalización más allá de CO/CL.
- Versionado histórico de términos aceptados (más allá del campo `version` informativo).
- Políticas antifraude, 3DS, OTP, SCA.

## 9. Preguntas abiertas
_Se llena durante la implementación si aparece algo no previsto. Cada entrada debe indicar quién la levantó y cuándo._

## 10. Trazabilidad
| AC | ADR | Commit(s) | Test(s) | Review |
|----|-----|-----------|---------|--------|
| AC-03.1 | | | | |
| AC-03.2 | | | | |
| AC-03.3 | | | | |
| AC-03.4 | | | | |
| AC-03.5 | | | | |
| AC-03.6 | | | | |
| AC-03.7 | | | | |
| AC-03.8 | | | | |
| AC-03.9 | | | | |
| AC-03.10 | | | | |
| AC-03.11 | | | | |
| AC-03.12 | | | | |
| AC-03.13 | | | | |
| AC-03.14 | | | | |
| AC-03.15 | | | | |
| AC-03.16 | | | | |
| AC-03.17 | | | | |

## 11. Changelog
| Versión | Fecha | Cambio | Aprobado por |
|---------|-------|--------|--------------|
| 1 | 2026-11-23 | Versión inicial (draft). | — |
