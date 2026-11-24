---
id: SPEC-01
story: US-01
title: Formulario configurable de datos del titular y del vehículo
status: approved
version: 1
approved_by: Jorge Argüelles
approved_at: 2026-11-23
related_adrs: []
---

# SPEC-01 — Formulario configurable de datos del titular y del vehículo

## 1. Resumen
Primera pantalla del wizard de cotización. Un único build de Angular renderiza un formulario cuyos campos, orden, validaciones y textos se toman de Strapi por país (CO o CL). El usuario diligencia sus datos y los del vehículo para avanzar al paso 2 (planes). El equipo de negocio debe poder editar el formulario sin desplegar.

## 2. Historia de origen
Ver `stories/US-01.md`.

> "Como persona interesada en asegurar mi carro, quiero ingresar mis datos y los de mi vehículo en un formulario simple, para recibir opciones de seguro adecuadas a mi país y a mi vehículo."

## 3. Reglas de negocio
| ID | Regla | Fuente |
|----|-------|--------|
| RN-01.1 | Cada campo se configura en Strapi con: `label`, `tipo` (`text`, `number`, `select`, `date`, `checkbox`), `obligatoriedad`, `validaciones`, `texto de ayuda`, `mensaje de error`, `orden` y `país`. | Historia |
| RN-01.2 | Los campos de tipo `select` (p. ej. marca, ciudad) obtienen sus opciones desde Strapi. | Historia |
| RN-01.3 | El año del vehículo no puede ser posterior al año siguiente (año actual + 1) ni tener más de 20 años de antigüedad respecto al año actual. | Historia |
| RN-01.4 | El titular debe ser mayor de edad. | Historia |
| RN-01.5 | En Colombia el documento del titular es cédula de ciudadanía o cédula de extranjería, y el vehículo se identifica por su placa. | Historia (contexto) |
| RN-01.6 | En Chile el documento del titular es RUT y el vehículo se identifica por su patente. | Historia (contexto) |
| RN-01.7 | Al cambiar la configuración en Strapi (agregar, quitar o reordenar campos publicados) y recargar la aplicación, el formulario se actualiza sin cambios de código ni despliegue. | Historia |
| RN-01.8 | Al volver al paso 1 desde un paso posterior, los datos ingresados permanecen diligenciados. | Historia |
| RN-01.9 | El país activo se determina por el prefijo de ruta: `/co/…` → Colombia, `/cl/…` → Chile. Un `CanActivate` guard valida que el segmento sea `co` o `cl`; cualquier otro valor redirige a `/co`. | HITL-1 (G-01.1) |
| RN-01.10 | Catálogo cerrado de tipos de campo en v1: `text`, `number`, `select`, `date`, `checkbox`. Cualquier tipo fuera de este conjunto se ignora y se registra en log (ver AC-01.12). Agregar un tipo nuevo requiere nueva versión de spec. | HITL-1 (G-01.2) |
| RN-01.11 | El objeto `validations` de un campo puede contener: `required` (boolean), `min` (number), `max` (number), `minLength` (number), `maxLength` (number), `pattern` (string regex), `custom` (enum: `rut` \| `cedula_co` \| `placa_co` \| `patente_cl` \| `mayor_edad` \| `anio_vehiculo`). Negocio elige claves; la lógica vive en el front. | HITL-1 (G-01.3) |
| RN-01.12 | Reglas de los validadores custom: `cedula_co` = 6–10 dígitos numéricos; `placa_co` = `^[A-Z]{3}[0-9]{3}$` o `^[A-Z]{3}[0-9]{2}[A-Z]$`; `rut` = 7–8 dígitos + `-` + dígito verificador o `K` (algoritmo módulo 11); `patente_cl` = `^[A-Z]{2}[0-9]{4}$` (pre-2007) o `^[A-Z]{4}[0-9]{2}$` (post-2007). Implementados en `apps/web/src/app/core/validators/`. | HITL-1 (G-01.4) |
| RN-01.13 | El estado del wizard persiste solo en memoria (`WizardStore` con NgRx Signals). No se escribe nada en `localStorage` ni `sessionStorage`. El store se destruye al completar o abandonar el flujo. | HITL-1 (G-01.5) |
| RN-01.14 | Las validaciones se disparan `on blur` en el primer toque del campo. Una vez que el campo ya mostró un error, se revalida `on change` para feedback inmediato al corregir. | HITL-1 (G-01.6) |

## 4. Criterios de aceptación

```gherkin
# AC-01.1 — Formulario configurado por país
Scenario Outline: El formulario muestra solo los campos del país activo, en el orden configurado
  Given existen campos publicados en Strapi para Colombia y para Chile
  And el país activo es <country>
  When abro la aplicación en el paso 1
  Then veo únicamente los campos cuyo `país` es <country>
  And los campos aparecen en el orden ascendente definido por el atributo `orden` de Strapi
  And cada campo muestra su `label` y su `texto de ayuda` configurados

  Examples:
    | country |
    | CO      |
    | CL      |
```

```gherkin
# AC-01.2 — Mensaje de error configurado por campo
Scenario: Un campo que no cumple su validación muestra el mensaje configurado en Strapi
  Given estoy en el paso 1 con el formulario cargado
  When ingreso en un campo un valor que viola su validación configurada
  And el campo pierde el foco
  Then veo exactamente el `mensaje de error` configurado en Strapi para ese campo, junto al campo
  And el campo queda marcado como inválido (atributo `aria-invalid="true"`)
  And el botón que avanza al paso 2 permanece deshabilitado
```

```gherkin
# AC-01.3 — Campos obligatorios bloquean el avance
Scenario: No se puede pasar al paso 2 si hay campos obligatorios vacíos o inválidos
  Given el formulario del país activo tiene al menos un campo marcado como obligatorio
  When intento avanzar al paso 2 sin diligenciar o con un valor inválido en un campo obligatorio
  Then permanezco en el paso 1
  And cada campo obligatorio inválido muestra su `mensaje de error` configurado
  And el foco se mueve al primer campo inválido
```

```gherkin
# AC-01.4 — Reflejo de cambios de Strapi sin despliegue
Scenario: Un nuevo campo publicado en Strapi aparece al recargar
  Given un campo adicional se publica en Strapi para el país activo
  When recargo la aplicación
  Then el nuevo campo se renderiza en la posición indicada por su `orden`
  And no se ha desplegado una nueva versión del front
```

```gherkin
# AC-01.5 — Persistencia entre pasos
Scenario: Volver al paso 1 conserva los datos
  Given diligencié el formulario del paso 1 con valores válidos
  And avancé al paso 2
  When vuelvo al paso 1
  Then cada campo conserva el valor que ingresé
  And los mensajes de error previos no se muestran hasta que vuelva a interactuar
```

```gherkin
# AC-01.6 — Año del vehículo en rango (agregado)
Scenario Outline: El año del vehículo respeta el rango permitido
  Given el año actual es Y
  When ingreso el año <year_input>
  Then el campo es <state>
  And si es inválido, muestro el `mensaje de error` configurado

  Examples:
    | year_input | state   |
    | Y + 2      | inválido |
    | Y + 1      | válido   |
    | Y          | válido   |
    | Y - 20     | válido   |
    | Y - 21     | inválido |
```

```gherkin
# AC-01.7 — Mayoría de edad del titular (agregado)
Scenario Outline: La fecha de nacimiento del titular implica mayoría de edad
  Given el país activo es <country>
  When ingreso una fecha de nacimiento cuya edad resultante es <age>
  Then el campo es <state>

  Examples:
    | country | age | state    |
    | CO      | 17  | inválido |
    | CO      | 18  | válido   |
    | CL      | 17  | inválido |
    | CL      | 18  | válido   |
```

```gherkin
# AC-01.8 — Opciones de select cargadas desde Strapi (agregado)
Scenario: Un campo select presenta las opciones publicadas en Strapi
  Given un campo de tipo `select` (p. ej. marca) está publicado para el país activo con N opciones
  When el paso 1 termina de cargar
  Then el control muestra las N opciones en el orden configurado
  And el valor por defecto es el configurado (si existe) o ninguno seleccionado
```

```gherkin
# AC-01.9 — Estado de carga del formulario (agregado)
Scenario: Mientras se obtiene la configuración desde Strapi se muestra un indicador de carga
  Given la petición al CMS aún no responde
  When abro el paso 1
  Then se muestra un indicador de carga accesible (`role="status"` o equivalente)
  And los campos no están disponibles para edición hasta que termine la carga
```

```gherkin
# AC-01.10 — Error de red al cargar la configuración (agregado)
Scenario: Si la petición al CMS falla el usuario ve un estado de error controlado
  Given la petición de configuración de campos devuelve un error de red o HTTP ≥ 500
  When abro el paso 1
  Then se muestra el mensaje de error de sistema definido en `system-messages.ts`
  And se ofrece una acción de "reintentar" que vuelve a disparar la petición
  And no se renderiza el formulario con datos parciales
```

```gherkin
# AC-01.11 — Estado vacío de configuración (agregado)
Scenario: No hay campos publicados para el país activo
  Given Strapi responde con cero campos para el país activo
  When abro el paso 1
  Then se muestra un estado vacío con el mensaje de sistema correspondiente
  And el botón para avanzar al paso 2 permanece deshabilitado
```

```gherkin
# AC-01.12 — Campo desconocido se ignora sin romper la app (agregado)
Scenario: El schema zod encuentra un tipo de campo no soportado
  Given Strapi publica un campo con un `tipo` que el front no reconoce
  When se parsea la respuesta con zod
  Then ese campo se omite del renderizado
  And se registra una entrada de log con el `documentId` del campo ignorado
  And el resto del formulario se renderiza con normalidad
```

```gherkin
# AC-01.13 — Accesibilidad por teclado y lector de pantalla (agregado)
Scenario: El formulario es operable solo con teclado
  Given el paso 1 está cargado
  When navego el formulario únicamente con Tab / Shift+Tab / Enter / Space
  Then puedo alcanzar y diligenciar todos los campos en orden lógico
  And cada campo tiene `label` asociado programáticamente
  And los mensajes de error se asocian con `aria-describedby` al campo correspondiente
  And axe-core no reporta violaciones `serious` ni `critical`
```

```gherkin
# AC-01.14 — Responsive 375 px y 1280 px (agregado)
Scenario Outline: El formulario es usable en móvil y en escritorio
  Given el viewport tiene ancho <width>
  When abro el paso 1
  Then todos los campos son visibles sin scroll horizontal
  And los controles mantienen un tamaño mínimo de toque de 44×44 px en móvil

  Examples:
    | width   |
    | 375px   |
    | 1280px  |
```

```gherkin
# AC-01.15 — Solo se consumen campos publicados (agregado)
Scenario: Un campo en estado borrador no se renderiza
  Given un campo existe en Strapi en estado `draft` (no publicado)
  When abro el paso 1
  Then ese campo no aparece en el formulario
```

## 5. Análisis de huecos
| ID | Hueco | Por qué importa | Propuesta | Decisión humana |
|----|-------|-----------------|-----------|-----------------|
| G-01.1 | Cómo se determina el país activo (CO vs CL) en una única URL. | Define cómo el front consulta Strapi y cómo se renderiza el formulario correcto. Afecta ruteo, SEO, i18n y tests e2e. | Prefijo de ruta `/:country` (`co`\|`cl`) con `CanActivate` guard. | **Resuelto → RN-01.9** |
| G-01.2 | Catálogo cerrado de `tipos` de campo soportados (`text`, `number`, `select`, `date`, `checkbox`) y qué pasa si llega otro. | El front necesita un conjunto cerrado para tipar con zod y renderizar sin `any`. | 5 tipos cerrados en v1; tipo desconocido → ignorado + log; nuevo tipo = nueva spec. | **Resuelto → RN-01.10** |
| G-01.3 | Qué validaciones específicas se pueden configurar por tipo (regex, min, max, minLength, maxLength, patrón de documento por país, etc.). | Sin un contrato de validaciones, Strapi y el front divergen y el negocio no sabe qué puede pedir. | Schema `{required, min, max, minLength, maxLength, pattern, custom}` con enum de validadores custom. | **Resuelto → RN-01.11** |
| G-01.4 | Reglas concretas de formato para documento y matrícula por país. | Si no se definen aquí, cada equipo las inventa distinto. | 4 validadores custom con regex/algoritmo precisos; implementados en `apps/web/src/app/core/validators/`. | **Resuelto → RN-01.12** |
| G-01.5 | Persistencia de datos del formulario al recargar la página o cerrar el navegador (RN-01.8 solo cubre navegación entre pasos). | Impacta UX y privacidad; también define si se usa `sessionStorage`, `localStorage` o solo memoria. | Solo memoria (`WizardStore` signals); no se toca storage por privacidad PII. | **Resuelto → RN-01.13** |
| G-01.6 | Momento en que se disparan las validaciones (al escribir, al perder foco, al enviar). | Impacta accesibilidad y percepción de usabilidad. | `on blur` primer toque; `on change` después del primer error. | **Resuelto → RN-01.14** |
| G-01.7 | Internacionalización de números, fechas y mayúsculas. | Formatos difieren entre CO y CL (separador decimal, formato de fecha). | Usar `Intl` del navegador con `locale` derivado del país activo; fechas en formato `dd/MM/yyyy` para ambos, pero confirmar. | _pendiente_ |
| G-01.8 | Dependencias entre campos (p. ej. modelo depende de marca, ciudad depende de departamento). | Si existen, el modelo de Strapi y el renderer deben soportarlo desde v1. | Fuera de alcance de v1 salvo que se confirme lo contrario; registrar como seguimiento para v2. | _pendiente_ |
| G-01.9 | Política de caché del formulario (cuánto vive la configuración en el cliente antes de volver a pedirla). | La historia dice "al recargar" aparece el cambio; sin política de caché el cambio podría tardar en llegar. | Sin caché persistente en v1: cada carga de paso 1 pide la configuración al proxy; nginx puede cachear con TTL corto (p. ej. 30 s). | _pendiente_ |
| G-01.10 | Copy del estado vacío y del estado de error (AC-01.10, AC-01.11). | Son copy de sistema (no viven en Strapi según CLAUDE.md §4) y necesitan texto definitivo. | Agregar entradas en `apps/web/src/app/core/system-messages.ts`: `form.loadError`, `form.empty`, `form.retry`. | _pendiente_ |
| G-01.11 | Analítica / tracking del paso 1 (eventos, campos). | Si se quiere medir abandono o errores de validación hay que instrumentarlo desde el inicio. | Fuera de alcance de v1. | _pendiente_ |
| G-01.12 | Prevención de doble envío al avanzar al paso 2. | Evita inconsistencias si el usuario hace doble click en "Siguiente". | Deshabilitar el botón mientras se procesa y usar guard de navegación. | _pendiente_ |
| G-01.13 | Comportamiento ante respuesta parcial de Strapi (algunos campos válidos, otros corruptos). | Define si se muestra lo bueno o se falla cerrado. | Renderizar los campos válidos (AC-01.12) y loguear los corruptos; si no queda ningún campo válido, tratarlo como estado vacío (AC-01.11). | _pendiente_ |
| G-01.14 | Soporte de autocompletado del navegador (`autocomplete="name"`, `"bday"`, etc.). | Mejora UX y accesibilidad en móvil; requiere que Strapi exponga un hint o que el front mapee por tipo/rol. | Permitir un campo opcional `autocomplete` en la configuración del campo; si no viene, inferir por `tipo` cuando sea posible. | _pendiente_ |

## 6. Contrato de contenido (Strapi)

La pantalla del paso 1 necesita, como mínimo, obtener del CMS la lista de campos publicados para el país activo. El modelo de datos final lo decide el ADR correspondiente; aquí solo se enumera lo que la vista consume.

**Entidad conceptual: `FormField`**

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `documentId` | string | sí | Identificador de Strapi (Document Service API). |
| `country` | enum `CO` \| `CL` | sí | Determina en qué país se muestra. |
| `name` | string (slug) | sí | Clave estable para el modelo de datos del formulario. |
| `label` | string | sí | Etiqueta visible. |
| `type` | enum `text` \| `number` \| `select` \| `date` \| `checkbox` | sí | Catálogo cerrado (ver G-01.2). |
| `required` | boolean | sí | Si el campo es obligatorio. |
| `helpText` | string | no | Texto de ayuda bajo el campo. |
| `errorMessage` | string | sí | Mensaje mostrado cuando falla cualquier validación del campo. |
| `order` | number | sí | Orden ascendente de renderizado. |
| `validations` | `{ required?, min?, max?, minLength?, maxLength?, pattern?, custom? }` | no | Ver RN-01.11 y RN-01.12. `custom` es enum de validadores registrados en el front. |
| `options` | lista de `{ value, label, order }` | condicional | Solo para `type = select`. |
| `defaultValue` | string \| number \| boolean | no | Valor inicial del campo. |
| `autocomplete` | string | no | Hint para el navegador (ver G-01.14). |

**Reglas de consumo:**
- Solo se consumen campos publicados (`publicationState=live`).
- El front filtra por `country` igual al país activo.
- Se usa `populate` explícito para `options`; prohibido `populate=*`.
- La respuesta se valida con un schema zod antes de usarse; campos con `type` fuera del enum se ignoran y se loguean (AC-01.12).
- El rol Public de Strapi solo necesita permiso `find` sobre esta entidad (coherente con CLAUDE.md §7).

## 7. Requisitos no funcionales
- **Accesibilidad:** navegación completa por teclado, `label` asociado a cada input, `aria-invalid` y `aria-describedby` para errores, foco visible, axe-core sin violaciones `serious` ni `critical` (AC-01.13).
- **Seguridad:** el front llama a `/api` mismo origen vía proxy nginx como rol Public; cero tokens en el cliente; toda respuesta pasa por zod; copy de sistema en `system-messages.ts`, copy de negocio desde Strapi; texto enriquecido (si lo hubiera en `helpText`) renderizado sin `innerHTML` sin sanitizar.
- **Responsive:** verificado a 375 px y 1280 px, sin scroll horizontal, controles táctiles ≥ 44×44 px en móvil (AC-01.14).
- **Estados:** carga (AC-01.9), error (AC-01.10), vacío (AC-01.11), y éxito (formulario válido habilita el botón de avanzar).
- **Rendimiento:** la configuración se pide una vez por entrada al paso 1; render estable sin parpadeo entre skeleton y formulario.
- **Compatibilidad:** última versión de Chrome, Safari, Firefox y Edge; móviles iOS Safari y Android Chrome actuales.

## 8. Fuera de alcance
- Envío real de la cotización o integración con aseguradoras.
- Cálculo de primas o planes (es US-02).
- Pago (es US-03).
- Internacionalización más allá de CO/CL.
- Dependencias dinámicas entre campos (G-01.8).
- Guardar borradores entre sesiones (G-01.5).
- Analítica y tracking (G-01.11).
- Edición del formulario desde el front (lo configura negocio en Strapi).

## 9. Preguntas abiertas
_Se llena durante la implementación si aparece algo no previsto. Cada entrada debe indicar quién la levantó y cuándo._

## 10. Trazabilidad
| AC | ADR | Commit(s) | Test(s) | Review |
|----|-----|-----------|---------|--------|
| AC-01.1 | | | | |
| AC-01.2 | | | | |
| AC-01.3 | | | | |
| AC-01.4 | | | | |
| AC-01.5 | | | | |
| AC-01.6 | | | | |
| AC-01.7 | | | | |
| AC-01.8 | | | | |
| AC-01.9 | | | | |
| AC-01.10 | | | | |
| AC-01.11 | | | | |
| AC-01.12 | | | | |
| AC-01.13 | | | | |
| AC-01.14 | | | | |
| AC-01.15 | | | | |

## 11. Changelog
| Versión | Fecha | Cambio | Aprobado por |
|---------|-------|--------|--------------|
| 1 | 2026-11-23 | Versión inicial (draft). | — |
| 1 | 2026-11-23 | HITL-1: G-01.1–G-01.6 resueltos → RN-01.9–RN-01.14. Status → approved. | Jorge Argüelles |
