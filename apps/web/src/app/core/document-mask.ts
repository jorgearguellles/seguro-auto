/**
 * Document masking utilities for the summary step (AC-03.2, AC-03.16, RN-03.11, G-03.1).
 *
 * maskDocument  — masks all but the last 4 non-separator characters.
 * isDocumentKey — detects document-number field keys by prefix, regardless of
 *                 the country suffix appended by the seed (e.g. `documentNumber_CO`,
 *                 `rut_CL`, `cedula`). Fixed in F-03-1.1.
 */

/** Separator characters that are preserved in position but not counted as visible chars. */
const SEPARATORS = new Set(['-', '.', ' ']);

/**
 * Masks a document number so only the last 4 non-separator characters are visible.
 * Separators preserve their position (G-03.1, AC-03.2, RN-03.11).
 *
 * Examples:
 *   '1023456789'  → '******6789'
 *   '12345678-5'  → '*****678-5'
 *   '9876543'     → '***6543'
 */
export function maskDocument(doc: string): string {
  if (!doc) return '';

  // Collect non-separator character positions (right to left)
  const positions: number[] = [];
  for (let i = doc.length - 1; i >= 0; i--) {
    if (!SEPARATORS.has(doc[i])) {
      positions.push(i);
    }
  }

  // The first 4 entries in `positions` are the rightmost non-separator chars (visible)
  const visibleSet = new Set(positions.slice(0, 4));

  let result = '';
  for (let i = 0; i < doc.length; i++) {
    if (SEPARATORS.has(doc[i])) {
      result += doc[i]; // preserve separator
    } else if (visibleSet.has(i)) {
      result += doc[i]; // visible
    } else {
      result += '*'; // mask
    }
  }
  return result;
}

/**
 * Returns true if the form-field key corresponds to a document number.
 * Uses prefix matching (case-insensitive) so country-suffixed keys like
 * `documentNumber_CO`, `rut_CL`, `cedula_123` are all matched (F-03-1.1).
 *
 * Supported prefixes:
 *   - documentNumber  (CO, generic)
 *   - rut             (CL)
 *   - cedula          (CO legacy)
 */
export function isDocumentKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.startsWith('documentnumber') ||
    lower.startsWith('rut') ||
    lower.startsWith('cedula')
  );
}
