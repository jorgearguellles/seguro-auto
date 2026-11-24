---
id: ADR-009
title: Modelo de contenido `terms` en Strapi con `body: blocks` y renderer Angular seguro de Strapi Blocks
status: accepted
date: 2026-11-23
deciders: Jorge Argüelles
supersedes:
related: [SPEC-03, RN-03.3, RN-03.11, AC-03.3, AC-03.10, AC-03.11, AC-03.12, AC-03.14, G-03.5, ADR-001, ADR-003, ADR-006]
---

# ADR-009 — Modelo de contenido `terms` en Strapi con `body: blocks` y renderer Angular seguro de Strapi Blocks

## Contexto y problema

SPEC-03 exige que el texto de términos y condiciones del paso 3 provenga de Strapi, un documento por país en estado publicado (RN-03.3, AC-03.3). El contenido puede ser rich text (SPEC-03 §6, G-03.5). El renderizado debe cumplir **sin `innerHTML` sin sanitizar** (CLAUDE.md §7, AC-03.3), con `populate` explícito (ADR-003 §D4), validación zod (ADR-006, CLAUDE.md §7) y tolerancia a nodos desconocidos (patrón ADR-006: ignorar + loguear).

SPEC-03 ya tiene también:
- AC-03.10 (estado de carga de términos),
- AC-03.11 (error de red → reintentar),
- AC-03.12 (estado vacío: no hay documento publicado para el país).

Quedan por decidir, de manera **estructural** y acoplada:

1. **Modelo de contenido** del content-type `terms` en Strapi (atributos, relaciones, draft & publish).
2. **Tipo del campo `body`**: ¿`text` plano, `richtext` Markdown, o Strapi Blocks?
3. **Estrategia de renderizado seguro** en Angular (ADR-003 §D5 anticipó que US-03 lo requeriría).
4. **Qué bloques soporta v1** y qué ocurre con un bloque desconocido.
5. **Schema zod** de la respuesta y cómo integra con el patrón `parseXxx` de ADR-006.
6. **Cómo se selecciona un único documento** cuando negocio publica más de uno por país.

Esta decisión es bloqueante de AC-03.3; además define la superficie del renderer que puede reutilizarse en futuras pantallas (p. ej. una página de "sobre nosotros" si llegara a existir).

> Nota: los permisos del rol Public para `api::terms.terms.find` se tratan en **ADR-011 (PUBLIC_READ_V3)**. Este ADR no modifica el bootstrap de Strapi.

## Factores de decisión

- RN-03.3: el texto puede ser rich text. Si usamos `text`/`richtext` (markdown), pierde negritas, enlaces y listas nativas que negocio espera poder dar formato a un documento legal.
- CLAUDE.md §7 / AC-03.3: prohibido `innerHTML` sin sanitizar. Prohibido `DomSanitizer.bypassSecurityTrustHtml` sin análisis.
- CLAUDE.md §7: `populate` explícito; prohibido `populate=*`.
- ADR-006: toda respuesta de Strapi se valida con zod; nodos desconocidos se **ignoran + loguean**, no rompen la app. El mismo patrón se replica aquí.
- ADR-001: el content-type `country` ya existe con `code` como enum (`CO | CL`). Un `terms` por país se modela como relación `manyToOne → country`.
- AC-03.14: contenido renderizado debe respetar jerarquía de headings y contraste (accesibilidad); un renderer "a pelo" con solo `<p>` perdería esa jerarquía.
- Simplicidad: la opción más simple que cumple > la más robusta. Con 4 tipos de bloque alcanza para un documento legal corto.
- CLAUDE.md §2: sin `any`; tipado completo del árbol de bloques.
- No introducir dependencias innecesarias: `@strapi/blocks-react-renderer` es React, **no sirve** para Angular; una lib de Angular dedicada para Strapi Blocks no existe de forma consolidada → optamos por un renderer propio minimalista.

## Opciones consideradas

Dado que el ADR cubre varias sub-decisiones acopladas, cada una se enumera con sus alternativas.

### D1 — Tipo del campo `body`

1. **D1-A — `blocks` (Strapi 5 rich text nativo).** JSON estructurado como árbol de nodos tipados; cero HTML en la base de datos.
2. **D1-B — `richtext` (Markdown).** String Markdown; el front lo parsea con una lib (p. ej. `marked`) y lo renderiza.
3. **D1-C — `text` plano.** Sin formato; cualquier énfasis se pierde.
4. **D1-D — Varios campos (`paragraphs: component repetible`)**, uno por bloque, modelado a mano sin `blocks`.

### D2 — Cardinalidad por país

1. **D2-A — Un documento `terms` por país**, con relación `manyToOne → country`. Si hay más de uno publicado, se usa el de `effectiveDate` más reciente (fallback: `updatedAt`).
2. **D2-B — Un campo `terms` dentro del propio content-type `country`.** No un content-type independiente.
3. **D2-C — Un content-type `terms` sin relación, con `countryCode: enum`.** Sin relación, filtro directo.

### D3 — Estrategia de renderizado seguro en Angular

1. **D3-A — Renderer propio `TermsBlocksRenderer` basado en `@switch` sobre `node.type`**, un template Angular por tipo soportado, texto interpolado con `{{ }}` (escape nativo). Nodos desconocidos se omiten + loguean. Sin `innerHTML`, sin `DomSanitizer.bypassSecurityTrustHtml`.
2. **D3-B — Transformar el JSON de bloques a HTML string, luego `[innerHTML]` + `DomSanitizer` modo `SecurityContext.HTML`.** Angular sanitiza antes de renderizar.
3. **D3-C — Pre-renderizar a HTML en el backend (en una ruta custom de Strapi) y servir HTML**; el front usa `[innerHTML]` con `sanitize`.
4. **D3-D — Usar una librería third-party** de render de Strapi Blocks para Angular.

### D4 — Qué bloques soporta v1

1. **D4-A — `paragraph`, `heading` (niveles 2 y 3), `list` (ordered/unordered), `quote`**, y marcas de texto `bold`, `italic`, `link`. Suficiente para un documento legal.
2. **D4-B — Todos los bloques nativos de Strapi 5** (`paragraph`, `heading` 1–6, `list`, `quote`, `code`, `image`).
3. **D4-C — Solo `paragraph`** y nada más. Cualquier otro bloque se omite.

### D5 — Validación zod y tolerancia

1. **D5-A — `discriminatedUnion` por `type` para nodos** + parseo tolerante (el documento completo nunca falla; nodos inválidos se descartan y loguean con `documentId`).
2. **D5-B — Schema estricto**: cualquier nodo desconocido hace fallar el parseo del documento entero → estado de error (AC-03.11).
3. **D5-C — Sin zod**: `as unknown as TermsDocument` y confiar en Strapi. (Se incluye solo para descartar; contradice CLAUDE.md §7.)

## Decisión

### D1 — Tipo del campo `body`

Opción elegida: **D1-A — `blocks` (Strapi 5 rich text nativo).**

- Es el único tipo que da a negocio una UI WYSIWYG estructurada (negritas, listas, enlaces, headings) **sin** permitir HTML arbitrario — el editor de Strapi 5 produce un árbol JSON tipado, no un string HTML. Eso elimina de raíz la posibilidad de que negocio inyecte `<script>` por error o por descuido.
- El JSON estructurado se valida con zod trivialmente (ADR-006), discriminando por `type` de nodo.
- Markdown (D1-B) requiere parser en el front + confiar en el output del parser; además el admin de Strapi no tiene un editor Markdown WYSIWYG tan cómodo como Blocks.
- D1-D (componentes repetibles a mano) replica a medias lo que Blocks ya hace nativamente.

### D2 — Cardinalidad y relación

Opción elegida: **D2-A — Content-type `terms` con relación `manyToOne → country`.**

- Separar `terms` de `country` permite versionado de términos (campo `version`, `effectiveDate`) sin tocar la entidad `country`.
- La relación `manyToOne → country` reutiliza el mismo patrón que `form-field → country` (ADR-001) y futuramente `plan → country`. Un solo estilo de query y de filtro: `filters[country][code][$eq]=CO`.
- Se permite publicar más de un documento `terms` para el mismo país (p. ej. una versión actualizada preparada para efectividad futura). La regla de selección (RN-03.3, SPEC-03 §6) es: entre los publicados del país activo, el de `effectiveDate` más reciente; si ninguno tiene `effectiveDate`, el de `updatedAt` más reciente. El front hace `sort=effectiveDate:desc,updatedAt:desc&pagination[limit]=1`.
- D2-B (campo embebido en `country`) acopla el ciclo de vida de los términos al de la entidad país; pierde versionado claro y obliga a reeditar el documento país cada vez que cambien los T&C. D2-C (sin relación, con `countryCode: enum`) rompe la convención con ADR-001 y duplica la fuente de verdad del código de país.

### Esquema concreto

**Content-type `terms`** (Draft & Publish activo, `uid: api::terms.terms`):

| Campo | Tipo Strapi | Obligatorio | Notas |
|---|---|---|---|
| `documentId` | string (automático) | sí | Identificador del Document Service API de Strapi 5. |
| `title` | string | sí | Título visible del bloque (ej. "Términos y condiciones"). SPEC-03 §6. |
| `body` | blocks | sí | Contenido legal estructurado. Ver D4 para bloques soportados en v1. |
| `effectiveDate` | date | no | Fecha de efectividad (SPEC-03 §6). Se usa para seleccionar el documento más reciente cuando hay más de uno publicado. |
| `version` | string | no | Etiqueta legible (`v1.0`). SPEC-03 §6. Informativo en v1. |
| `country` | relation `manyToOne → country` | sí | Filtro por país. |

**Query canónica del front:**

```
GET /api/termss
  ?filters[country][code][$eq]=CO
  &sort=effectiveDate:desc,updatedAt:desc
  &pagination[limit]=1
  &populate[country]=true
```

- Sin parámetro `status`, Strapi 5 devuelve solo publicados (coherente con AC-01.15 y SPEC-03 §6).
- `populate[country]=true`, nunca `populate=*` (ADR-003 §D4).
- Si la respuesta es un array vacío → **AC-03.12 (estado vacío)**: no se renderiza el bloque de términos, el botón "pagar" permanece deshabilitado, y la casilla de aceptación no se renderiza.
- Si la petición falla (error de red o HTTP ≥ 500) → **AC-03.11**: mensaje de `terms.loadError` de `system-messages.ts` + acción "reintentar".

> Nota sobre el nombre del endpoint: Strapi 5 pluraliza el `singularName` del content-type. Si el pluralName es `terms`, el endpoint es `/api/terms`; si es `termss` (default por regla simple de `+s`), será `/api/termss`. En el seed se fija explícitamente `pluralName: 'terms'` y `singularName: 'terms-doc'` para obtener `/api/terms` sin el plural extraño. Documentado en el seed del CMS.

### D3 — Estrategia de renderizado seguro

Opción elegida: **D3-A — Renderer propio `TermsBlocksRenderer` con `@switch` sobre `node.type`, template Angular por tipo, texto interpolado con `{{ }}`.**

- Cero `innerHTML`, cero `DomSanitizer.bypassSecurityTrustHtml`, cero `[innerHTML]`. El árbol de bloques recorre el DOM Angular exclusivamente con interpolación (`{{ node.text }}`) y binding de atributos (`[attr.href]`). La interpolación Angular escapa HTML por defecto; los `[attr.href]` se validan antes (ver "Validación de enlaces" abajo).
- D3-B (sanitizar HTML string con `DomSanitizer`) funciona pero introduce un paso serialize→sanitize→deserialize innecesario. Y abre la puerta a que, en el futuro, alguien use `bypassSecurityTrustHtml` "porque Angular no me deja ver un `<em>`".
- D3-C (pre-renderizar en backend) mueve el problema de seguridad al CMS y rompe el principio de ADR-006 (el contrato entre CMS y front son los datos, no HTML).
- D3-D (lib third-party) no hay un paquete consolidado de Angular para Strapi Blocks; `@strapi/blocks-react-renderer` es React. Rechazado.

#### Contrato del renderer (v1)

Interfaz pública:

```ts
// apps/web/src/app/features/wizard/terms/terms-blocks-renderer.component.ts
export type TermsBlockNode =
  | ParagraphNode
  | HeadingNode
  | ListNode
  | QuoteNode;

export type InlineNode =
  | TextNode          // { type: 'text', text: string, bold?: boolean, italic?: boolean }
  | LinkNode;         // { type: 'link', url: string, children: TextNode[] }

@Component({
  selector: 'app-terms-blocks-renderer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // template con @for sobre blocks + @switch por node.type, @for sobre inline children
})
export class TermsBlocksRendererComponent {
  readonly blocks = input.required<readonly TermsBlockNode[]>();
}
```

**Bloques soportados en v1 (D4-A):**

| `type` | Elemento DOM | Notas |
|---|---|---|
| `paragraph` | `<p>` | Hijos inline. |
| `heading` (level 2) | `<h2>` | Level 1 queda reservado al título del paso; solo 2 y 3 se renderizan dentro del body. |
| `heading` (level 3) | `<h3>` | |
| `list` (`format: 'unordered'`) | `<ul><li>` | |
| `list` (`format: 'ordered'`) | `<ol><li>` | |
| `quote` | `<blockquote>` | Hijos inline. |

**Marcas inline soportadas en v1:**

| Marca | Elemento DOM | Notas |
|---|---|---|
| texto plano | `{{ node.text }}` | Interpolación Angular → escape nativo. |
| `bold: true` | `<strong>` | Se envuelve el texto. |
| `italic: true` | `<em>` | Se envuelve el texto. |
| `link` | `<a [attr.href]="safeUrl" rel="noopener noreferrer" target="_blank">` | Ver validación de enlaces abajo. |

**Bloques / marcas desconocidos (incluye `heading` niveles 1, 4, 5, 6; `code`; `image`; marcas `underline`, `strikethrough`, etc.):**
- Se **omiten silenciosamente** del renderizado (coherente con ADR-006 y AC-01.12 aplicado a nodos).
- Se emite un log estructurado: `logStructured('terms.unsupportedNode', { documentId, type, path })`, sin PII.
- El resto del documento sigue renderizándose normalmente.

**Validación de enlaces** (seguridad defensiva):

- `url` debe empezar por `https://`, `http://`, `mailto:` o ser ruta relativa (`/...`). Cualquier otro esquema (`javascript:`, `data:`, `file:`, `vbscript:`) hace que el nodo link se degrade a texto plano (se renderiza el `children` sin el `<a>`).
- Esta comprobación vive en una pura función `isSafeUrl(url: string): boolean` en `apps/web/src/app/core/url-safety.ts`, cubierta por tests unitarios.
- Atributos obligatorios en `<a>`: `rel="noopener noreferrer"`, `target="_blank"`. Definidos en el template, no en el schema.

### D5 — Validación zod y tolerancia

Opción elegida: **D5-A — `discriminatedUnion` por `type` para nodos + parseo tolerante.**

- Un nodo con `type` fuera del enum soportado se descarta y loguea; el resto del documento sigue válido → AC-03.12 solo se dispara si Strapi devuelve **cero documentos**, no si un nodo es raro.
- D5-B (fallar el documento entero ante un nodo raro) es una regresión UX: un bloque nuevo publicado en Strapi (por ejemplo `image`) rompería el paso 3 entero. Inaceptable.
- D5-C (sin zod) contradice CLAUDE.md §7.

**Ubicación:** `apps/web/src/app/core/schemas/terms.schema.ts` (coherente con `angular-conventions` §1 y ADR-006).

**Schema (resumido):**

```ts
import { z } from 'zod';

export const countryCodeSchema = z.enum(['CO', 'CL']);

// -- inline nodes --
const textNodeSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
});

const linkNodeSchema = z.object({
  type: z.literal('link'),
  url: z.string().min(1),
  children: z.array(textNodeSchema).min(1),
});

const inlineNodeSchema = z.discriminatedUnion('type', [
  textNodeSchema,
  linkNodeSchema,
]);

// -- block nodes --
const paragraphNodeSchema = z.object({
  type: z.literal('paragraph'),
  children: z.array(z.unknown()), // se parsea elemento-a-elemento (tolerante)
});

const headingNodeSchema = z.object({
  type: z.literal('heading'),
  level: z.union([z.literal(2), z.literal(3)]),
  children: z.array(z.unknown()),
});

const listItemSchema = z.object({
  type: z.literal('list-item'),
  children: z.array(z.unknown()),
});

const listNodeSchema = z.object({
  type: z.literal('list'),
  format: z.enum(['ordered', 'unordered']),
  children: z.array(listItemSchema),
});

const quoteNodeSchema = z.object({
  type: z.literal('quote'),
  children: z.array(z.unknown()),
});

const blockNodeSchema = z.discriminatedUnion('type', [
  paragraphNodeSchema,
  headingNodeSchema,
  listNodeSchema,
  quoteNodeSchema,
]);

// -- document --
export const termsDocumentSchema = z.object({
  documentId: z.string().min(1),
  title: z.string().min(1),
  body: z.array(z.unknown()).default([]), // se parsea elemento-a-elemento
  effectiveDate: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  country: z.object({ code: countryCodeSchema }),
});
export type TermsDocument = z.infer<typeof termsDocumentSchema>;
```

**Función de parseo tolerante** (siguiendo el patrón `parseFormFields` de ADR-006):

```ts
export function parseTermsResponse(raw: unknown): TermsDocument | null {
  const envelopeSchema = z.object({ data: z.array(z.unknown()) });
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) {
    logStructured('terms.envelopeInvalid', { issues: envelope.error.issues });
    return null;
  }
  if (envelope.data.data.length === 0) {
    return null; // AC-03.12 — estado vacío
  }

  // Se selecciona el primer elemento (la query ya ordena por effectiveDate desc).
  const first = envelope.data.data[0];
  const doc = termsDocumentSchema.safeParse(first);
  if (!doc.success) {
    const documentId = (first as { documentId?: string } | null)?.documentId ?? 'unknown';
    logStructured('terms.documentDiscarded', { documentId, issues: doc.error.issues });
    return null;
  }

  const sanitizedBody = sanitizeBlocks(doc.data.body, doc.data.documentId);
  return { ...doc.data, body: sanitizedBody as unknown as TermsBlockNode[] };
}

function sanitizeBlocks(raw: unknown[], documentId: string): TermsBlockNode[] {
  const out: TermsBlockNode[] = [];
  for (const node of raw) {
    const parsed = blockNodeSchema.safeParse(node);
    if (!parsed.success) {
      const type = (node as { type?: string } | null)?.type ?? 'unknown';
      logStructured('terms.unsupportedNode', { documentId, type });
      continue;
    }
    // Para cada block, también sanear sus children inline (texto, link).
    out.push(sanitizeBlockChildren(parsed.data, documentId));
  }
  return out;
}
```

- El cliente HTTP en `core/` llama a `/api/terms?...` y pasa la respuesta por `parseTermsResponse` antes de devolver. El tipo de retorno es `TermsDocument | null`; no hay `unknown` escapando de `core/`.
- `logStructured` reutiliza el helper definido en ADR-006.

### Consecuencias

- ✅ Positiva: UX del admin óptima — negocio edita términos con el WYSIWYG nativo de Strapi 5 Blocks; no escribe Markdown ni JSON.
- ✅ Positiva: Cero vectores de XSS — no hay HTML en la base de datos ni `innerHTML` en el front. Toda la superficie DOM pasa por templates Angular interpolados.
- ✅ Positiva: Tolerancia a datos parciales — un bloque nuevo publicado en Strapi (tipo `image`, `code`) no rompe el paso 3; se omite y loguea.
- ✅ Positiva: Modelo coherente con ADR-001 (relación `manyToOne → country`) y ADR-006 (patrón `parseXxx` tolerante).
- ✅ Positiva: Versionado de términos preparado (`effectiveDate`, `version`) para evolución legal sin re-modelar.
- ⚠️ Negativa: El renderer propio es **código a mantener**. Si Strapi 5 cambia el shape de los nodos entre menores, hay que actualizar el schema. → Mitigación: la superficie de bloques v1 es pequeña (4 bloques, 3 marcas); los tests unitarios con fixtures reales detectan cambios; el schema zod descarta nodos irreconocibles sin romper la app.
- ⚠️ Negativa: Negocio puede usar en el editor un bloque no soportado (p. ej. `image`) y creer que se publica. **El resultado es que el usuario final no lo ve** — silencio parcial, igual que en ADR-006. → Mitigación: `logStructured('terms.unsupportedNode', ...)` queda en logs; en el `README` del CMS se documenta la lista v1 de bloques soportados; una task futura puede ser un endpoint `/health/content/terms` que reporte bloques no soportados por documento.
- ⚠️ Negativa: La regla "primero el de `effectiveDate` más reciente" depende de que negocio rellene correctamente `effectiveDate`. Si lo deja vacío en varios documentos publicados, el orden pasa a `updatedAt` desc → el último editado gana. → Mitigación: aceptable para v1; el admin muestra el campo opcionalmente; se documenta la regla en el `README`.
- ⚠️ Negativa: La query usa `pagination[limit]=1` para traer solo uno. Si el filtro `country.code` fuese incorrecto (bug), nunca lo detectaríamos porque siempre llega algo. → Mitigación: en el test e2e `AC-03.3` se verifica con CO y CL que el contenido cambia según país activo.
- ⚠️ Negativa: `link` con `url` no segura se degrada a texto plano — el usuario ve texto sin enlace. → Mitigación: aceptable; el log `terms.unsafeUrl` lo señala al operador.
- ⚠️ Negativa: El pluralName debe fijarse a `terms` en Strapi (el default sería `termss`). Si el seed olvida fijarlo, la URL del endpoint cambia. → Mitigación: el seed del CMS fija `pluralName: 'terms'` explícitamente y hay test de integración que hace `GET /api/terms` y espera 200.

### Validación

- **Test unitario** (`terms.schema.spec.ts`, Vitest, título `AC-03.3 parses terms blocks document`): fixture con 1 documento publicado CO con `body` de 4 bloques válidos → `parseTermsResponse` devuelve `TermsDocument` con 4 bloques.
- **Test unitario** (`AC-03.12 empty state when no published terms`): respuesta `{ data: [] }` → devuelve `null` + ningún log de error.
- **Test unitario** (`terms.unsupportedNode is logged and discarded`): fixture con un bloque `image` y uno `paragraph` → devuelve documento con solo el paragraph; `logStructured` recibe `'terms.unsupportedNode'` con `type: 'image'` y el `documentId`.
- **Test unitario** (`link with javascript: url degrades to plain text`): fixture con link `url: 'javascript:alert(1)'` → el renderer produce texto plano, no `<a>`; `logStructured` recibe `'terms.unsafeUrl'`.
- **Test unitario** (`inline bold/italic rendered as <strong>/<em>, no innerHTML`): fixture → el DOM resultante contiene `<strong>` y `<em>` pero ninguna llamada a `[innerHTML]` ni `bypassSecurityTrustHtml`.
- **Test unitario** (`heading level 1, 4, 5, 6 are discarded`): fixture con `heading` level 1 y level 4 → se omiten; level 2 y 3 se mantienen.
- **Test de integración HTTP** (CMS smoke, cubierto también por ADR-011): `curl /api/terms?filters[country][code][$eq]=CO&populate[country]=true` devuelve un array con el documento esperado; pluralName fijado a `terms`.
- **Test Playwright** (`AC-03.3 terms from Strapi per country`): recorrer paso 3 en `/co` y en `/cl` → el texto visible del bloque de términos difiere.
- **Test Playwright** (`AC-03.3 no innerHTML in terms rendering`): inspeccionar el DOM renderizado y verificar que el componente `app-terms-blocks-renderer` no usa `[innerHTML]` en ninguno de sus nodos (puede hacerse con un `data-test-safe-render` attribute y un `expect` sobre su presencia).
- **Grep en CI** (`review-checklist`): `grep -R -nE '\[innerHTML\]|bypassSecurityTrust' apps/web/src/app/features/wizard/terms` → build falla si encuentra algo.
- **Revisión manual en HITL-2:** el admin de Strapi muestra el campo `body` como editor Blocks nativo (barra de formato con bold/italic/listas/enlaces/headings).

## Pros y contras de las opciones

### D1-A — `body: blocks` (elegida)
- ✅ Estructurado y tipable; cero HTML en la base de datos.
- ✅ UX de admin WYSIWYG nativa de Strapi 5.
- ✅ Validación directa con zod `discriminatedUnion`.
- ❌ Requiere un renderer propio en Angular (no hay lib consolidada).

### D1-B — `body: richtext` (Markdown)
- ✅ Formato familiar; hay parsers Markdown probados.
- ❌ El admin de Strapi no da un WYSIWYG tan cómodo para markdown.
- ❌ Introduce una dependencia nueva (`marked` o similar) + sanitización del HTML resultante.
- ❌ Si alguien usa HTML dentro del markdown (p. ej. `<iframe>`), el parser lo deja pasar — superficie XSS más grande.

### D1-C — `body: text` plano
- ✅ Simplicidad máxima.
- ❌ No cumple SPEC-03 §6 (contenido enriquecido esperado).
- ❌ Negocio no puede resaltar palabras ni poner listas.

### D1-D — Componentes repetibles a mano
- ✅ Totalmente controlado.
- ❌ Reinventa Blocks con peor UX en el admin.

### D2-A — `terms` con relación `manyToOne → country` (elegida)
- ✅ Patrón uniforme con `form-field` (ADR-001) y futuros content-types.
- ✅ Versionado sin tocar `country`.
- ❌ Un join más (`populate[country]=true`).

### D2-B — Campo embebido en `country`
- ✅ Menos content-types.
- ❌ Acopla el ciclo de vida de los T&C al de la entidad país.
- ❌ Pierde versionado natural.

### D2-C — `terms` con `countryCode: enum`
- ✅ Sin populate.
- ❌ Duplica la fuente de verdad de los códigos de país.
- ❌ Rompe la convención establecida en ADR-001.

### D3-A — Renderer propio con `@switch` (elegida)
- ✅ Cero `innerHTML`, cero `DomSanitizer.bypassSecurityTrustHtml`.
- ✅ Tipado completo; narrowing precioso con `discriminatedUnion`.
- ❌ Código a mantener si Strapi cambia el shape de nodos.

### D3-B — `[innerHTML]` + `DomSanitizer`
- ✅ Menos código de render.
- ❌ Introduce un paso `JSON → HTML string → sanitize → DOM` sin valor.
- ❌ Abre la puerta a que alguien escriba `bypassSecurityTrustHtml` después.

### D3-C — Pre-render en el backend
- ✅ Front más simple.
- ❌ Mueve la lógica de seguridad al CMS; rompe el contrato "backend expone datos, front hace render" (ADR-006).

### D3-D — Lib third-party
- ❌ `@strapi/blocks-react-renderer` es React; no sirve.
- ❌ No hay lib Angular consolidada para Strapi Blocks a la fecha.

### D4-A — 4 bloques + 3 marcas (elegida)
- ✅ Cobertura suficiente para un documento legal corto.
- ✅ Superficie pequeña → tests exhaustivos.
- ❌ Si negocio necesita imagen o tabla en el futuro, requiere ampliar.

### D4-B — Todos los bloques nativos
- ✅ Nada se "pierde" si negocio los usa.
- ❌ Más bloques = más superficie de render = más superficie de bugs.
- ❌ `image` abre tema de `src`: nueva fuente externa, CSP, descarga, etc. Fuera de alcance de v1.

### D4-C — Solo `paragraph`
- ❌ Negocio no puede estructurar un documento legal mínimamente.

### D5-A — `discriminatedUnion` tolerante (elegida)
- ✅ Patrón uniforme con ADR-006.
- ✅ Un bloque raro no rompe el paso 3.
- ❌ Silencio parcial — se discute en consecuencias.

### D5-B — Estricto (fallar el documento)
- ✅ Problemas visibles de inmediato.
- ❌ Un bloque nuevo publicado rompe el paso 3 en producción — regresión UX inaceptable.

### D5-C — Sin zod
- ❌ Contradice CLAUDE.md §7.

## Nueva dependencia

Este ADR **no introduce dependencias nuevas**. `zod` ya está en CLAUDE.md §2. El renderer propio usa solo Angular estándar (`@switch`, `@for`, interpolación, binding de atributos). No se añade `marked`, no se añade `@strapi/blocks-react-renderer`, no se añade `DomSanitizer` para este caso.

## Camino de evolución

- **Soporte para `image`:** cuando negocio lo pida, nuevo ADR que introduce `imageNodeSchema` + política de hosts permitidos + atributos `alt` obligatorios. Requiere definir si las imágenes vienen del Media Library de Strapi (mismo origen tras proxy) o de un CDN externo (CSP).
- **Soporte para `code` y `table`:** aditivo al `discriminatedUnion`.
- **Acceptación con "leyó hasta el final":** fuera de v1 (G-03.12). Si llega, se añade un `IntersectionObserver` sobre el último bloque sin cambiar el modelo de contenido.
- **Más países (MX, PE):** extender el enum `countryCodeSchema` y agregar documentos en Strapi. Zero cambios en el renderer.
- **Equipo de 5 personas:** la lista v1 de bloques soportados queda documentada en la skill `strapi-content-model`; ampliarla exige nuevo ADR.
- **Negocio pide HTML embebido ("quiero un badge"):** se rechaza; la vía correcta es extender el enum de bloques, no abrir una puerta de HTML.

## Changelog

- 2026-11-23: Endpoint URL changed to `/api/legal-terms` per ADR-012. The plural name "terms" conflicts with Strapi 5 internals. Las referencias a `/api/terms` en §Esquema concreto, §Consecuencias y §Validación quedan superseded por ADR-012 (solo el fragmento del endpoint URL / `pluralName`); el resto del ADR (modelo de contenido, zod, renderer, bootstrap de permisos) permanece vigente.
