/**
 * Zod schema for the Strapi `terms` content-type response.
 * Tolerant parsing: invalid blocks are discarded + logged (ADR-009 D5-A, ADR-006).
 * Returns the first (most recent by effectiveDate) document, or null if none (AC-03.12).
 * AC-03.3, AC-03.10, AC-03.11, AC-03.12
 */
import { z } from 'zod';
import { logStructured } from '../logger';

// ---- Inline nodes ----

export const textNodeSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
});
export type TextNode = z.infer<typeof textNodeSchema>;

export const linkNodeSchema = z.object({
  type: z.literal('link'),
  url: z.string().min(1),
  children: z.array(textNodeSchema).min(1),
});
export type LinkNode = z.infer<typeof linkNodeSchema>;

export const inlineNodeSchema = z.discriminatedUnion('type', [
  textNodeSchema,
  linkNodeSchema,
]);
export type InlineNode = z.infer<typeof inlineNodeSchema>;

// ---- Block nodes (D4-A: paragraph, heading 2/3, list ordered/unordered, quote) ----

const paragraphNodeSchema = z.object({
  type: z.literal('paragraph'),
  children: z.array(z.unknown()),
});
export type ParagraphNode = { type: 'paragraph'; children: InlineNode[] };

const headingNodeSchema = z.object({
  type: z.literal('heading'),
  level: z.union([z.literal(2), z.literal(3)]),
  children: z.array(z.unknown()),
});
export type HeadingNode = { type: 'heading'; level: 2 | 3; children: InlineNode[] };

const listItemSchema = z.object({
  type: z.literal('list-item'),
  children: z.array(z.unknown()),
});

const listNodeSchema = z.object({
  type: z.literal('list'),
  format: z.enum(['ordered', 'unordered']),
  children: z.array(listItemSchema),
});
export type ListItemNode = { type: 'list-item'; children: InlineNode[] };
export type ListNode = {
  type: 'list';
  format: 'ordered' | 'unordered';
  children: ListItemNode[];
};

const quoteNodeSchema = z.object({
  type: z.literal('quote'),
  children: z.array(z.unknown()),
});
export type QuoteNode = { type: 'quote'; children: InlineNode[] };

/** Discriminated union of all supported block types (ADR-009 §D4-A). */
export type Block = ParagraphNode | HeadingNode | ListNode | QuoteNode;

const rawBlockNodeSchema = z.discriminatedUnion('type', [
  paragraphNodeSchema,
  headingNodeSchema,
  listNodeSchema,
  quoteNodeSchema,
]);

// ---- Document ----

const termsDocumentRawSchema = z.object({
  documentId: z.string().min(1),
  title: z.string().min(1),
  body: z.array(z.unknown()).default([]),
  effectiveDate: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  country: z.object({ code: z.enum(['CO', 'CL']) }),
});

export interface TermsDocument {
  documentId: string;
  title: string;
  body: Block[];
  effectiveDate?: string | null;
  version?: string | null;
  country: { code: 'CO' | 'CL' };
}

// ---- Inline sanitizer ----

function sanitizeInlineChildren(
  rawChildren: unknown[],
  documentId: string,
): InlineNode[] {
  const out: InlineNode[] = [];
  for (const child of rawChildren) {
    const result = inlineNodeSchema.safeParse(child);
    if (!result.success) {
      const type = (child as { type?: string } | null)?.type ?? 'unknown';
      logStructured('terms.unsupportedNode', { documentId, type, path: 'inline' });
      continue;
    }
    out.push(result.data);
  }
  return out;
}

// ---- Block sanitizer (tolerant, ADR-009 D5-A) ----

function sanitizeBlockChildren(
  block: z.infer<typeof rawBlockNodeSchema>,
  documentId: string,
): Block {
  switch (block.type) {
    case 'paragraph':
      return {
        type: 'paragraph',
        children: sanitizeInlineChildren(block.children, documentId),
      };
    case 'heading':
      return {
        type: 'heading',
        level: block.level,
        children: sanitizeInlineChildren(block.children, documentId),
      };
    case 'list':
      return {
        type: 'list',
        format: block.format,
        children: block.children.map((item) => ({
          type: 'list-item' as const,
          children: sanitizeInlineChildren(item.children, documentId),
        })),
      };
    case 'quote':
      return {
        type: 'quote',
        children: sanitizeInlineChildren(block.children, documentId),
      };
  }
}

function sanitizeBlocks(rawBlocks: unknown[], documentId: string): Block[] {
  const out: Block[] = [];
  for (const node of rawBlocks) {
    const parsed = rawBlockNodeSchema.safeParse(node);
    if (!parsed.success) {
      const type = (node as { type?: string } | null)?.type ?? 'unknown';
      logStructured('terms.unsupportedNode', { documentId, type });
      continue;
    }
    out.push(sanitizeBlockChildren(parsed.data, documentId));
  }
  return out;
}

// ---- Public parser (ADR-009 D5-A, AC-03.12) ----

/**
 * parseTerms — tolerantly parses the Strapi `{ data: [...] }` envelope.
 * - Invalid envelope → null + logs.
 * - Empty data array → null (AC-03.12 empty state, no log error).
 * - First element selected (query already sorts effectiveDate:desc).
 * - Invalid document → null + logs.
 * - Unknown blocks are discarded + logged; rest of document remains valid.
 */
export function parseTerms(raw: unknown): TermsDocument | null {
  const envelopeSchema = z.object({ data: z.array(z.unknown()) });
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) {
    logStructured('terms.envelopeInvalid', { issues: envelope.error.issues });
    return null;
  }

  if (envelope.data.data.length === 0) {
    // AC-03.12 — empty state; not an error
    return null;
  }

  const first = envelope.data.data[0];
  const doc = termsDocumentRawSchema.safeParse(first);
  if (!doc.success) {
    const documentId =
      (first as { documentId?: string } | null)?.documentId ?? 'unknown';
    logStructured('terms.documentDiscarded', {
      documentId,
      issues: doc.error.issues,
    });
    return null;
  }

  const sanitizedBody = sanitizeBlocks(doc.data.body, doc.data.documentId);
  return {
    documentId: doc.data.documentId,
    title: doc.data.title,
    body: sanitizedBody,
    effectiveDate: doc.data.effectiveDate,
    version: doc.data.version,
    country: doc.data.country,
  };
}
