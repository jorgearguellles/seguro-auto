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
} as const;

export type SystemMessageKey = keyof typeof SYSTEM_MESSAGES;
