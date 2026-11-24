/**
 * Bootstrap for apps/cms.
 *
 * Responsibilities (ADR-003 D2-A):
 *  1. Ensure Public role has exactly the read permissions declared in PUBLIC_READ_V1.
 *     Mode: additive (never deletes permissions already in the admin — accepted for v1).
 *  2. Run the idempotent seed (CO and CL countries + form fields).
 *
 * PUBLIC_READ_V1 is the authoritative list of Public permissions for SPEC-01.
 * Adding an entry requires a new ADR or supersede of ADR-003.
 *
 * [AC-01.4]  Changes in Strapi are reflected without deploy.
 * [AC-01.15] Only published entries returned by REST (Strapi 5 default).
 * [ADR-003]  Permissions defined in code, never manually in the admin.
 */

import { seed } from './seed';
import type { Core } from '@strapi/strapi';

// ---------------------------------------------------------------------------
// Permission contract — ADR-003 §D1-A
// ---------------------------------------------------------------------------

const PUBLIC_READ_V1: readonly string[] = [
  'api::country.country.find',
  'api::form-field.form-field.find',
  // api::plan.plan.find → added in ADR for US-02
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

  for (const action of PUBLIC_READ_V1) {
    const exists = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({ where: { action, role: publicRole.id } });

    if (!exists) {
      await strapi.db
        .query('plugin::users-permissions.permission')
        .create({ data: { action, role: publicRole.id } });
      strapi.log.info(`[bootstrap] Public permission granted: ${action}`);
    } else {
      strapi.log.debug(`[bootstrap] Public permission already exists: ${action}`);
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
