/**
 * URL safety check for renderer links (ADR-009 §D3-A).
 * Only https://, http://, mailto:, and relative paths (/...) are considered safe.
 * Any other scheme (javascript:, data:, vbscript:, file:) degrades to plain text.
 * AC-03.3
 */

const SAFE_PROTOCOLS = ['https:', 'http:', 'mailto:'];

/**
 * Returns true if the URL is safe to use in an anchor href.
 * Relative paths (starting with /) are always safe.
 */
export function isSafeUrl(url: string): boolean {
  if (url.startsWith('/')) return true;
  try {
    const parsed = new URL(url);
    return SAFE_PROTOCOLS.includes(parsed.protocol);
  } catch {
    // Unparseable URL — treat as unsafe
    return false;
  }
}
