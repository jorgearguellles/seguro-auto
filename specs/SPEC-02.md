---
id: SPEC-02
story: US-02
title: Lista de planes por país con selección persistente y ajuste de precio simulado
status: approved
version: 1
approved_by:
approved_at:
related_adrs: []
---

# SPEC-02 — Lista de planes por país con selección persistente y ajuste de precio simulado

## 1. Resumen
Segunda pantalla del wizard de cotización. Tras completar el paso 1, el usuario ve la lista de planes publicados y activos del país activo, cada uno con su precio en la moneda local, sus coberturas y sus beneficios. Un plan puede estar marcado como "recomendado" y se distingue visualmente. El precio base puede ajustarse mediante una regla simulada que depende de los datos capturados en el paso 1 (antigüedad del vehículo). El usuario selecciona un único plan y continúa al paso 3 (resumen y pago). Al volver al paso 1 no se pierden los datos ya diligenciados. El equipo de negocio controla los planes, coberturas, beneficios, orden, marca de recomendado y precio base desde Strapi sin desplegar.

## 2. Historia de origen
Ver `stories/US-02.md`.

> "Como persona que está cotizando, quiero ver los planes disponibles para mi país con su precio y coberturas, para elegir el que mejor se ajuste a mis necesidades."

## 3. Reglas de negocio
| ID | Regla | Fuente |
|----|-------|--------|
| RN-02.1 | Cada plan se configura en Strapi con: `nombre`, `descripción corta`, `precio base`, `moneda`, `coberturas`, `beneficios`, `orden`, `recomendado` (boolean), `estado activo` (boolean) y `país`. | Historia |
| RN-02.2 | Solo se muestran los planes publicados y activos (`active = true`) del país activo. | Historia |
| RN-02.3 | El precio se muestra en la moneda del país y con formato de locale: Colombia → `COP` con locale `es-CO`; Chile → `CLP` con locale `es-CL`. En ambos casos sin decimales (ambas monedas en la práctica se muestran enteras). | Historia + CLAUDE.md §4 |
| RN-02.4 | El precio final puede ajustarse respecto al precio base mediante una regla simulada basada en los datos del paso 1. La regla está documentada y es determinista. | Historia |
| RN-02.5 | Solo se puede seleccionar un plan a la vez. La selección persiste en `WizardStore` como `selectedPlanId` (`documentId` del plan). | Historia + ADR-005 |
| RN-02.6 | El plan marcado como `recomendado = true` se distingue visualmente del resto (badge, borde o color de énfasis). Si ningún plan está marcado, no se destaca ninguno. Si hay más de uno marcado, todos se muestran como recomendados (no es responsabilidad del front elegir uno). | Historia |
| RN-02.7 | Los planes se renderizan en orden ascendente por el atributo `orden` de Strapi. Empates se resuelven por `documentId` ascendente. | Historia (contexto) |
| RN-02.8 | No se puede llegar al paso 2 sin haber completado el paso 1 con datos válidos. Un guard (`step2Guard`) consulta `WizardStore.applicant()`; si es `null`, redirige a `/:country/paso-1`. | SPEC-01 RN-01.8 + ADR-005 camino de evolución |
| RN-02.9 | Volver al paso 1 desde el paso 2 (vía botón "Atrás" o navegación directa) no borra los datos del paso 1 ni la selección de plan del paso 2. | SPEC-01 RN-01.8 + ADR-005 |
| RN-02.10 | Cambiar de país (`/co` → `/cl`) destruye el `WizardStore` y, por tanto, también la selección de plan (ADR-005). | ADR-005 |
| RN-02.11 | El copy de negocio (nombre del plan, descripción, coberturas, beneficios, etiqueta "recomendado") viene de Strapi. El copy de sistema (estados de carga, error, vacío, mensaje "sin planes disponibles") vive en `apps/web/src/app/core/system-messages.ts`. | CLAUDE.md §4 |

### Fórmula de ajuste de precio (regla simulada, RN-02.4)

- **Entrada:** `basePrice` (number, en unidades menores de la moneda del plan) + `applicant.vehicleYear` (number, del `WizardStore`).
- **Variable:** `currentYear` = año del sistema en el momento del render de la lista de planes.
- **Regla:**
  - Si `vehicleYear < currentYear - 5` ⇒ `finalPrice = round(basePrice × 1.10)` (recargo del 10 % por antigüedad).
  - En cualquier otro caso ⇒ `finalPrice = basePrice`.
- **Redondeo:** `Math.round` al entero más cercano (sin decimales), para alinearse con el formato de COP/CLP (RN-02.3).
- **Independencia de moneda:** la fórmula multiplica un número; la moneda se aplica solo en el formateo final.
- **Observabilidad en UI:** cuando se aplica el recargo, el front muestra el precio final con una etiqueta "precio ajustado por antigüedad del vehículo" (copy de sistema). No se muestra el precio base tachado en v1 (ver G-02.6).
- **Ausencia de `vehicleYear`:** si el paso 1 no capturó `vehicleYear` (posible si Strapi no publica ese campo), no se aplica recargo → `finalPrice = basePrice`.

## 4. Criterios de aceptación

```gherkin
# AC-02.1 — Planes del país activo, publicados y activos
Scenario Outline: Solo se muestran los planes publicados y activos del país activo
  Given existen planes publicados y activos para Colombia y para Chile
  And existe al menos un plan en estado `draft` y otro con `active = false` para el país <country>
  And el país activo es <country>
  When llego al paso 2
  Then veo únicamente los planes publicados y con `active = true` cuyo `país` es <country>
  And los planes aparecen en orden ascendente por el atributo `orden` de Strapi
  And los planes en `draft` no aparecen
  And los planes con `active = false` no aparecen

  Examples:
    | country |
    | CO      |
    | CL      |
```

```gherkin
# AC-02.2 — Formato de precio por país
Scenario Outline: El precio se muestra en la moneda y formato del país
  Given el país activo es <country>
  And un plan tiene `precio base` = <base>
  And la regla de ajuste no aplica (vehículo con `vehicleYear >= currentYear - 5`)
  When veo el plan en la lista
  Then el precio se muestra como <formatted>
  And el símbolo o código de moneda corresponde a <currency>

  Examples:
    | country | base    | currency | formatted           |
    | CO      | 1200000 | COP      | $ 1.200.000         |
    | CL      | 45000   | CLP      | $ 45.000            |
```

```gherkin
# AC-02.3 — Ajuste de precio por antigüedad del vehículo
Scenario Outline: El precio se ajusta cuando el vehículo supera 5 años de antigüedad
  Given el año actual es Y
  And el paso 1 registró `vehicleYear` = <year>
  And un plan tiene `precio base` = 1000000
  When veo el plan en la lista del paso 2
  Then el precio mostrado es <final>
  And si hay recargo, se muestra la etiqueta de "precio ajustado por antigüedad del vehículo"
  And si no hay recargo, no se muestra esa etiqueta

  Examples:
    | year  | final   | recargo |
    | Y     | 1000000 | no      |
    | Y - 5 | 1000000 | no      |
    | Y - 6 | 1100000 | sí      |
    | Y - 20| 1100000 | sí      |
```

```gherkin
# AC-02.4 — Plan recomendado distinguido visualmente
Scenario: Un plan marcado como recomendado se distingue del resto
  Given un plan tiene `recomendado = true` en Strapi
  And otros planes tienen `recomendado = false`
  When veo la lista de planes
  Then el plan recomendado muestra un indicador visual accesible (badge/texto "Recomendado" con `aria-label` o equivalente)
  And los planes no recomendados no muestran ese indicador
  And el indicador es perceptible por lector de pantalla
```

```gherkin
# AC-02.5 — Selección única de plan
Scenario: Seleccionar un plan reemplaza la selección previa
  Given estoy en la lista de planes
  And no he seleccionado ningún plan
  When selecciono el plan A
  Then el plan A queda marcado como seleccionado (`aria-pressed="true"` o equivalente semántico)
  And el resto de planes no está marcado como seleccionado
  When selecciono el plan B
  Then el plan B queda marcado como seleccionado
  And el plan A deja de estar marcado como seleccionado
```

```gherkin
# AC-02.6 — Avanzar al paso 3 requiere selección
Scenario: El botón "Continuar" solo se habilita si hay un plan seleccionado
  Given estoy en la lista de planes sin selección
  Then el botón "Continuar" está deshabilitado
  When selecciono un plan
  Then el botón "Continuar" se habilita
  When pulso "Continuar"
  Then navego al paso 3 (resumen)
  And `WizardStore.selectedPlanId` contiene el `documentId` del plan elegido
```

```gherkin
# AC-02.7 — Persistencia de la selección entre pasos
Scenario: Volver al paso 2 conserva el plan seleccionado
  Given seleccioné un plan en el paso 2
  And avancé al paso 3
  When vuelvo al paso 2
  Then el mismo plan aparece marcado como seleccionado
  And el botón "Continuar" está habilitado
```

```gherkin
# AC-02.8 — Volver al paso 1 no pierde datos (agregado)
Scenario: Volver al paso 1 desde el paso 2 conserva los datos del paso 1
  Given diligencié el formulario del paso 1 con valores válidos
  And avancé al paso 2
  When vuelvo al paso 1 (botón "Atrás" o navegación por URL)
  Then los campos del paso 1 conservan los valores ingresados (hereda AC-01.5)
  And si vuelvo al paso 2, el plan previamente seleccionado (si lo hubo) sigue marcado
```

```gherkin
# AC-02.9 — Guard de acceso al paso 2 (agregado)
Scenario: No se puede entrar al paso 2 sin haber completado el paso 1
  Given `WizardStore.applicant()` es `null` (nunca se completó el paso 1)
  When intento navegar directamente a `/:country/paso-2`
  Then soy redirigido a `/:country/paso-1`
  And no se renderiza la lista de planes
```

```gherkin
# AC-02.10 — Estado de carga de los planes (agregado)
Scenario: Mientras se obtienen los planes desde Strapi se muestra un indicador de carga
  Given la petición al CMS aún no responde
  When abro el paso 2
  Then se muestra un indicador de carga accesible (`role="status"` o equivalente)
  And no se muestran planes parciales
  And el botón "Continuar" permanece deshabilitado
```

```gherkin
# AC-02.11 — Error de red al cargar los planes (agregado)
Scenario: Si la petición de planes falla el usuario ve un estado de error controlado
  Given la petición de planes devuelve un error de red o HTTP ≥ 500
  When abro el paso 2
  Then se muestra el mensaje de error de sistema definido en `system-messages.ts` (`plans.loadError`)
  And se ofrece una acción de "reintentar" que vuelve a disparar la petición
  And no se muestra la lista de planes con datos parciales
```

```gherkin
# AC-02.12 — Sin planes disponibles
Scenario: No hay planes activos y publicados para el país
  Given Strapi responde con cero planes publicados y activos para el país activo
  When llego al paso 2
  Then se muestra el mensaje de sistema `plans.empty` ("no hay planes disponibles en este momento")
  And el botón "Continuar" permanece deshabilitado
  And no se muestra la lista de planes
```

```gherkin
# AC-02.13 — Plan corrupto se descarta sin romper la lista (agregado)
Scenario: El schema zod encuentra un plan con datos inválidos
  Given Strapi publica un plan al que le falta `precio base` o `moneda`
  When se parsea la respuesta con zod
  Then ese plan se omite de la lista
  And se registra una entrada de log con el `documentId` del plan descartado
  And el resto de planes se renderizan con normalidad
  And si tras el filtro no queda ningún plan, se muestra el estado vacío (AC-02.12)
```

```gherkin
# AC-02.14 — Accesibilidad por teclado y lector de pantalla (agregado)
Scenario: La lista de planes es operable solo con teclado
  Given el paso 2 está cargado con al menos un plan
  When navego la lista únicamente con Tab / Shift+Tab / Enter / Space
  Then puedo alcanzar cada plan en orden visual
  And puedo seleccionar un plan con Enter o Space
  And el plan seleccionado comunica su estado a lectores de pantalla (`aria-pressed` o `role="radio"` + `aria-checked`)
  And el foco visible es evidente en cada plan
  And axe-core no reporta violaciones `serious` ni `critical`
```

```gherkin
# AC-02.15 — Responsive 375 px y 1280 px (agregado)
Scenario Outline: La lista de planes es usable en móvil y en escritorio
  Given el viewport tiene ancho <width>
  When abro el paso 2 con N planes
  Then los planes son visibles sin scroll horizontal
  And los controles mantienen un tamaño mínimo de toque de 44×44 px en móvil
  And a 1280 px los planes se presentan en disposición horizontal o grid; a 375 px en lista vertical

  Examples:
    | width   |
    | 375px   |
    | 1280px  |
```

```gherkin
# AC-02.16 — Moneda del plan coherente con el país (agregado)
Scenario: La moneda del plan debe coincidir con la moneda esperada del país
  Given un plan publicado tiene `moneda` distinta a la esperada del país activo (ej. plan CO con `moneda = CLP`)
  When se parsea la respuesta con zod
  Then ese plan se descarta y se registra en log
  And no se muestra en la lista
```

## 5. Análisis de huecos
| ID | Hueco | Por qué importa | Propuesta | Decisión humana |
|----|-------|-----------------|-----------|-----------------|
| G-02.1 | Modelo de contenido de `coberturas` y `beneficios` en Strapi. La historia no fija si son arrays de strings, componentes repetibles con `label + descripción`, o texto rich. | Impacta el content-type de Strapi, los permisos del rol Public, el populate y el schema zod. Afecta a ADR dedicado. | Modelar ambos como componentes repetibles (`plan.coverage`, `plan.benefit`) con `label: string` obligatorio + `description: string` opcional + `order: integer`. Texto plano (coherente con la postura anti-XSS de ADR-003 D5). Alternativa aceptable: lista de strings. | ✅ aceptado |
| G-02.2 | Enum de `moneda` y relación con `país`. La historia dice "pesos colombianos o pesos chilenos" pero no fija si la moneda la elige negocio por plan o se deriva del país. | Si la moneda es redundante con el país, almacenarla introduce drift (AC-02.16 lo mitiga pero no lo elimina). | Enum cerrado `COP` \| `CLP` en Strapi; validar en zod que `plan.currency` coincide con la moneda esperada del `plan.country.code` (AC-02.16). Alternativa: no almacenar `currency`, derivarlo del país en el front. | ✅ aceptado |
| G-02.3 | Umbral exacto de la regla de ajuste de precio. Historia solo dice "regla simulada documentada". Elegimos `vehicleYear < currentYear - 5` ⇒ +10 %, pero es una propuesta del spec-writer. | Impacta directamente lo que ve el usuario y los tests de AC-02.3. Si negocio quiere otro umbral o otro porcentaje, hay que ajustar fórmula y ACs. | Umbral 5 años, recargo 10 %, redondeo al entero. Valores en constantes `PRICE_ADJUST_THRESHOLD_YEARS = 5` y `PRICE_ADJUST_SURCHARGE = 0.10` en `apps/web/src/app/core/pricing.ts` para cambios triviales. | ✅ aceptado |
| G-02.4 | Qué datos del paso 1 pueden influir en el precio además de `vehicleYear`. La historia no lo acota. | Si el ajuste es "solo antigüedad" en v1 debemos decirlo explícitamente para que un futuro agente no agregue factores sin ADR. | V1: solo `vehicleYear`. Cualquier otro factor (edad del titular, ciudad, marca) requiere nueva versión de spec. | ✅ aceptado |
| G-02.5 | Clave exacta en `applicant` para el año del vehículo. SPEC-01 permite que negocio defina los `key` de los campos (`vehicleYear`, `anioVehiculo`, `year`...). | La fórmula de ajuste necesita leer un valor del `WizardStore.applicant()`; si la `key` depende de la configuración de Strapi, se rompe la fórmula al renombrar el campo. | Definir `VEHICLE_YEAR_FIELD_KEY = 'vehicleYear'` como contrato: el seed de Strapi debe usar exactamente esa `key` para el campo de año. Si llega `null`/`undefined`, no se ajusta el precio. | ✅ aceptado |
| G-02.6 | Cómo se visualiza el ajuste: ¿precio base tachado + precio final, o solo precio final + etiqueta? | UX y confianza del usuario; también afecta accesibilidad (texto tachado requiere `aria-label` adecuado). | Solo precio final + etiqueta de sistema "precio ajustado por antigüedad del vehículo". Sin tachado en v1 para no confundir al no tener descuentos. | ✅ aceptado |
| G-02.7 | Preselección inicial del plan. Historia no dice si al entrar debe venir uno marcado por defecto (p. ej. el recomendado). | Impacta AC-02.6 (habilitar Continuar) y UX: si se preselecciona, el usuario puede avanzar sin interactuar. | V1: no preseleccionar. El usuario debe elegir explícitamente. Ventaja: obliga a decisión consciente; desventaja: un click extra. | ✅ aceptado |
| G-02.8 | Semántica ARIA de la selección: ¿radiogroup (`role="radiogroup"` + `role="radio"`) o botones con `aria-pressed`? | Afecta AC-02.14 y la experiencia con lector de pantalla. | `role="radiogroup"` con `role="radio"` + `aria-checked` por plan: es la semántica correcta para "selección única entre N opciones" y permite navegación con flechas, estándar de accesibilidad. | ✅ aceptado |
| G-02.9 | Caché de la respuesta de planes. | SPEC-01 G-01.9 quedó pendiente; esta spec hereda el mismo hueco para planes. | Sin caché persistente en v1: cada entrada al paso 2 pide la lista. Si se aplica caché HTTP en nginx, usar TTL corto (p. ej. 30 s). Documentar junto con G-01.9. | ✅ aceptado |
| G-02.10 | Copy de sistema para estados vacío/error/carga y para la etiqueta de precio ajustado. | Son textos de sistema (CLAUDE.md §4) y necesitan copy definitivo. | Agregar en `apps/web/src/app/core/system-messages.ts`: `plans.loading`, `plans.loadError`, `plans.retry`, `plans.empty`, `plans.priceAdjustedLabel`. | ✅ aceptado |
| G-02.11 | Qué pasa si `selectedPlanId` guardado en `WizardStore` ya no existe cuando se vuelve al paso 2 (porque negocio despublicó el plan). | El usuario podría avanzar al paso 3 con un plan fantasma, o quedar sin selección sin aviso. | Al cargar planes, si `WizardStore.selectedPlanId` no está en la lista actual, limpiar la selección (`selectedPlanId = null`) y mostrar un aviso de sistema `plans.selectionCleared`. | ✅ aceptado |
| G-02.12 | Permisos del rol Public: ADR-003 (`PUBLIC_READ_V1`) aún no incluye `api::plan.plan.find`. | Sin este permiso, la petición devuelve 403 y AC-02.1/AC-02.11 no se pueden distinguir. El ADR de US-02 (pendiente) debe agregarlo. | Delegar al architect: nuevo ADR que amplía `PUBLIC_READ_V1` → `PUBLIC_READ_V2` añadiendo `api::plan.plan.find`. No decisión de esta spec; solo la señalamos. | ✅ aceptado |
| G-02.13 | Doble click en "Continuar". | Puede disparar doble navegación o doble registro de estado. | Deshabilitar el botón mientras se procesa; hereda la propuesta de G-01.12. | ✅ aceptado |
| G-02.14 | Instrumentación/analítica de selección de plan. | Si negocio quiere medir qué plan se elige más, hay que instrumentar. | Fuera de alcance de v1 (coherente con G-01.11). | ✅ aceptado |
| G-02.15 | Comportamiento al cambiar los datos del paso 1 después de haber seleccionado un plan. | Si el usuario vuelve al paso 1 y modifica `vehicleYear` entrando/saliendo del umbral de recargo, el precio mostrado en paso 2 debe recalcularse. | El precio se calcula en cada render del paso 2 a partir de `WizardStore.applicant().vehicleYear`; no se cachea en el store. Si el plan seleccionado sigue existiendo, mantener selección; el precio se actualiza automáticamente. | ✅ aceptado |

## 6. Contrato de contenido (Strapi)

La pantalla del paso 2 necesita, como mínimo, obtener del CMS la lista de planes publicados y activos para el país activo. El modelo de datos final lo decide el ADR correspondiente (pendiente para US-02); aquí solo se enumera lo que la vista consume.

**Entidad conceptual: `Plan`**

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `documentId` | string | sí | Identificador de Strapi (Document Service API). Clave estable para `selectedPlanId`. |
| `country` | relación → `country` (enum `CO` \| `CL`) | sí | Determina en qué país se muestra. |
| `name` | string | sí | Nombre del plan (visible). |
| `shortDescription` | string | sí | Descripción corta visible bajo el nombre. |
| `basePrice` | number entero no negativo | sí | Precio base en unidades enteras de la moneda (COP o CLP). |
| `currency` | enum `COP` \| `CLP` | sí | Debe coincidir con la moneda esperada del `country` (AC-02.16). |
| `coverages` | lista de `{ label, description?, order }` | sí (≥1) | Coberturas del plan. Ver G-02.1 para forma final. |
| `benefits` | lista de `{ label, description?, order }` | no | Beneficios adicionales. Ver G-02.1. |
| `order` | number entero | sí | Orden ascendente de renderizado. |
| `recommended` | boolean | sí | Default `false`. Puede haber 0, 1 o N marcados como recomendados. |
| `active` | boolean | sí | Default `true`. Solo se consumen los que tengan `true`. |

**Reglas de consumo:**
- Solo se consumen planes publicados (sin parámetro `status`; Strapi 5 oculta drafts por defecto).
- El front filtra por `country.code = <país activo>` y por `active = true`.
- Se usa `populate` explícito para `coverages`, `benefits` y `country` (solo campo `code`). Prohibido `populate=*`.
- La respuesta se valida con un schema zod (patrón ADR-006). Planes con forma inválida se descartan y se loguean con su `documentId` (AC-02.13). La coherencia `currency` ↔ `country` también se valida (AC-02.16).
- El rol Public de Strapi necesita permiso `find` sobre `plan` (coherente con CLAUDE.md §7; implica delta sobre ADR-003 `PUBLIC_READ_V1`, ver G-02.12).

## 7. Requisitos no funcionales
- **Accesibilidad:** navegación completa por teclado, agrupación semántica correcta para selección única (ver G-02.8), `aria-checked` / `aria-pressed` reflejan el estado real, foco visible, axe-core sin violaciones `serious` ni `critical` (AC-02.14). La etiqueta "Recomendado" es perceptible por lectores de pantalla (AC-02.4).
- **Seguridad:** el front llama a `/api` mismo origen vía proxy nginx como rol Public (ADR-002/ADR-003); cero tokens en el cliente; toda respuesta pasa por zod (ADR-006); copy de sistema en `system-messages.ts`, copy de negocio desde Strapi; texto plano de coberturas y beneficios renderizado por interpolación Angular (hereda la postura anti-XSS de ADR-003 D5; si en el futuro se admite rich text, requiere ADR dedicado).
- **Responsive:** verificado a 375 px y 1280 px, sin scroll horizontal, controles táctiles ≥ 44×44 px en móvil (AC-02.15).
- **Estados:** carga (AC-02.10), error (AC-02.11), vacío (AC-02.12), selección (AC-02.5), listo para avanzar (AC-02.6).
- **Rendimiento:** la lista de planes se pide una vez por entrada al paso 2; render estable sin parpadeo entre skeleton y lista. El cálculo del precio ajustado es local y O(N) con N = número de planes; sin re-fetch al volver.
- **Compatibilidad:** última versión de Chrome, Safari, Firefox y Edge; móviles iOS Safari y Android Chrome actuales.
- **Internacionalización numérica:** uso de `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })` y `Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })`. Confirmar formato definitivo en HITL-1 (relacionado con G-01.7, aún pendiente en SPEC-01).

## 8. Fuera de alcance
- Envío real de la cotización o integración con aseguradoras (es US-03).
- Cálculo real actuarial de primas; la fórmula de ajuste es simulada y documentada en §3.
- Pago (es US-03).
- Internacionalización más allá de CO/CL.
- Rich text en coberturas, beneficios o descripción (texto plano en v1).
- Filtros, ordenamientos o comparadores de planes elegidos por el usuario (orden lo define negocio desde Strapi).
- Preselección automática de plan (G-02.7).
- Analítica y tracking de selección (G-02.14).
- Caché persistente de planes en el cliente (G-02.9).
- Factores adicionales de ajuste de precio más allá de `vehicleYear` (G-02.4).

## 9. Preguntas abiertas
_Se llena durante la implementación si aparece algo no previsto. Cada entrada debe indicar quién la levantó y cuándo._

## 10. Trazabilidad
| AC | ADR | Commit(s) | Test(s) | Review |
|----|-----|-----------|---------|--------|
| AC-02.1 | | | | |
| AC-02.2 | | | | |
| AC-02.3 | | | | |
| AC-02.4 | | | | |
| AC-02.5 | | | | |
| AC-02.6 | | | | |
| AC-02.7 | | | | |
| AC-02.8 | | | | |
| AC-02.9 | | | | |
| AC-02.10 | | | | |
| AC-02.11 | | | | |
| AC-02.12 | | | | |
| AC-02.13 | | | | |
| AC-02.14 | | | | |
| AC-02.15 | | | | |
| AC-02.16 | | | | |

## 11. Changelog
| Versión | Fecha | Cambio | Aprobado por |
|---------|-------|--------|--------------|
| 1 | 2026-11-23 | Versión inicial (draft). | — |
