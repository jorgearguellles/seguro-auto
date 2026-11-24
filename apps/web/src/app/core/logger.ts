/**
 * Structured logging helper.
 * In dev: writes to console.warn with a stable event key for grep.
 * In prod: replace with a remote sink (OpenTelemetry, etc.).
 * See ADR-006 §Design concreto.
 */
export function logStructured(event: string, payload: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.warn(`[seguro-auto] ${event}`, payload);
}
