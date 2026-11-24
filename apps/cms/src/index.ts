/**
 * Bootstrap for apps/cms.
 *
 * Responsibilities (ADR-003 D2-A, ADR-008, ADR-011):
 *  1. Ensure Public role has exactly the read permissions declared in PUBLIC_READ_V3.
 *     Mode: additive (never deletes permissions already in the admin — accepted for v1).
 *  2. Run the idempotent seed (CO and CL countries + form fields + plans + terms).
 *
 * PUBLIC_READ_V3 supersedes PUBLIC_READ_V2 (ADR-011 D2-A).
 * PUBLIC_READ_V2 is preserved only in git history and ADR-008.
 * PUBLIC_READ_V1 is preserved only in git history and ADR-003.
 * Adding an entry requires a new ADR (PUBLIC_READ_V4) or supersede of ADR-011.
 *
 * [AC-01.4]  Changes in Strapi are reflected without deploy.
 * [AC-01.15] Only published entries returned by REST (Strapi 5 default).
 * [AC-02.1]  Public role can read plans list without token.
 * [AC-03.3]  Public role can read terms without token.
 * [ADR-003]  Permissions defined in code, never manually in the admin.
 * [ADR-008]  PUBLIC_READ_V2 adds api::plan.plan.find to V1.
 * [ADR-011]  PUBLIC_READ_V3 adds api::terms.terms.find to V2.
 */

import { seed } from './seed';
import type { Core } from '@strapi/strapi';

// ---------------------------------------------------------------------------
// Permission contract — ADR-011 §D2-A (supersedes ADR-008 §D1-A)
// PUBLIC_READ_V3 — contrato de permisos del rol Public tras ADR-011.
// Agregar un elemento requiere nuevo ADR (supersede este) o versión V4.
// ---------------------------------------------------------------------------

const PUBLIC_READ_V3: readonly string[] = [
  'api::country.country.find',       // from V1 (ADR-003) — needed for filters and populate
  'api::form-field.form-field.find', // from V1 (ADR-003) — SPEC-01
  'api::plan.plan.find',             // from V2 (ADR-008) — SPEC-02 [AC-02.1]
  'api::terms.terms.find',           // NEW in V3 (ADR-011) — SPEC-03 [AC-03.3]
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensurePublicPermissions(strapi: Core.Strapi): Promise<void> {
  const publicRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (!publicRole) {
    strapi.log.warn('[bootstrap] Public role not found. Users-permissions plugin may not be initialized yet.');
    return;
  }

  for (const action of PUBLIC_READ_V3) {
    const exists = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({ where: { action, role: publicRole.id } });

    if (!exists) {
      await strapi.db
        .query('plugin::users-permissions.permission')
        .create({ data: { action, role: publicRole.id } });
      strapi.log.info(`[bootstrap] Public permission granted: ${action}`);
    } else {
      strapi.log.debug(`[bootstrap] Public permission already exists (V3): ${action}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export default {
  async bootstrap({ strapi }: { strapi: Core.Strapi }): Promise<void> {
    await ensurePublicPermissions(strapi);
    await seed(strapi);
  },
};
