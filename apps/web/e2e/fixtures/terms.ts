/**
 * Reusable mock payloads for Strapi terms responses.
 * All data is fictional (US-03 / SPEC-03).
 */

/** Single valid CO terms document with heading, paragraph and unordered list. */
export const CO_TERMS_RESPONSE = {
  data: [
    {
      documentId: 'terms-co-1',
      title: 'Términos y Condiciones CO',
      body: [
        {
          type: 'heading',
          level: 2,
          children: [{ type: 'text', text: 'Condiciones generales' }],
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: 'Al contratar este seguro usted acepta los siguientes términos.',
            },
          ],
        },
        {
          type: 'list',
          format: 'unordered',
          children: [
            {
              type: 'list-item',
              children: [{ type: 'text', text: 'Cobertura válida en Colombia' }],
            },
            {
              type: 'list-item',
              children: [{ type: 'text', text: 'Vigencia de 12 meses' }],
            },
          ],
        },
      ],
      effectiveDate: '2026-01-01',
      country: { code: 'CO' },
    },
  ],
};

/** Empty terms list — empty-state test (AC-03.12). */
export const EMPTY_TERMS_RESPONSE = { data: [] };
