/**
 * System-level copy that never lives in Strapi.
 * Business copy (labels, errors, help text) always comes from Strapi.
 * See CLAUDE.md §4.
 */
export const SYSTEM_MESSAGES = {
  'form.loading': 'Cargando formulario...',
  'form.loadError': 'No pudimos cargar el formulario. Intenta de nuevo.',
  'form.empty': 'No hay campos configurados para tu país.',
  'form.retry': 'Reintentar',
  'wizard.step1.title': 'Datos del titular y del vehículo',
  'wizard.stepBlocked': 'Debes completar el paso anterior para continuar.',
  // Step 2 — plans (G-02.10, AC-02.10, AC-02.11, AC-02.12)
  'plans.loading': 'Cargando planes disponibles...',
  'plans.loadError': 'No pudimos cargar los planes. Intenta de nuevo.',
  'plans.retry': 'Reintentar',
  'plans.empty': 'No hay planes disponibles en este momento.',
  'plans.priceAdjustedLabel': 'Precio ajustado por antigüedad del vehículo',
  'plans.recommended': 'Recomendado',
  'plans.select': 'Seleccionar plan',
  'plans.selected': 'Plan seleccionado',
  'plans.continuar': 'Continuar',
  'plans.volver': 'Volver',
  // AC-02.11 / G-02.11 — selection cleared because plan was unpublished
  'plans.selectionCleared': 'El plan que tenías seleccionado ya no está disponible.',
  // Step 3 — summary and simulated payment (SPEC-03, ADR-010 G-03.9)
  'summary.title': 'Resumen y pago',
  'summary.yourData': 'Tus datos',
  'summary.yourPlan': 'Plan elegido',
  'summary.price': 'Precio final',
  'summary.terms': 'Términos y condiciones',
  'summary.accept': 'Acepto los términos y condiciones',
  'summary.pay': 'Pagar',
  'summary.paying': 'Procesando pago…',
  'summary.payError': 'No pudimos completar el pago. Por favor intenta nuevamente.',
  'summary.retry': 'Reintentar pago',
  'summary.confirmed': 'Tu cotización ha sido confirmada',
  'summary.quoteNumber': 'Número de cotización',
  'summary.back': 'Cambiar plan',
  'summary.editData': 'Editar datos',
  'summary.loading': 'Cargando términos y condiciones...',
  'summary.loadError': 'No pudimos cargar los términos. Intenta nuevamente.',
  'summary.loadRetry': 'Reintentar',
} as const;

export type SystemMessageKey = keyof typeof SYSTEM_MESSAGES;
