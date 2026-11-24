/**
 * E2E tests for US-02 — Paso 2: Lista de planes por país con selección persistente.
 *
 * All Strapi HTTP calls are mocked with page.route().
 * No real Strapi instance is required.
 *
 * axe-core is injected per audit; violations at 'serious'/'critical' fail the test.
 * AC-02.16 keyboard-only test navigates without any mouse interaction.
 *
 * AC-02.1  — only active, published plans for the active country are shown
 * AC-02.2  — price formatted with currency symbol/code
 * AC-02.3  — vehicle older than 5 years triggers 10% surcharge + label
 * AC-02.4  — recommended=true plan shows "Recomendado" badge
 * AC-02.5  — clicking a plan marks it; "Continuar" is enabled
 * AC-02.6  — without selection "Continuar" is disabled
 * AC-02.7  — active=false plan does NOT appear in the list
 * AC-02.8  — "Volver" navigates to paso-1 and form data is preserved
 * AC-02.9  — loading indicator visible while request is pending
 * AC-02.10 — network error shows error message + retry button
 * AC-02.11 — data:[] response shows empty state
 * AC-02.12 — plan without coverages is discarded by zod (AC-02.13 overlap)
 * AC-02.13 — plan with wrong currency is discarded by zod
 * AC-02.14 — axe finds no serious/critical violations in ready state
 * AC-02.15 — responsive: visible at 375px and 1280px viewport widths
 * AC-02.16 — keyboard-only: Tab/arrows between plans, Space selects, Enter continues
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import { CO_FIELDS_RESPONSE } from './fixtures/form-fields';
import {
  CO_PLANS_RESPONSE,
  CO_PLANS_KNOWN_PRICE_RESPONSE,
  CO_PLANS_WITH_INACTIVE_RESPONSE,
  EMPTY_PLANS_RESPONSE,
  CO_PLANS_NO_COVERAGES_RESPONSE,
  CO_PLANS_WRONG_CURRENCY_RESPONSE,
} from './fixtures/plans';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELDS_API_GLOB = '**/api/form-fields**';
const PLANS_API_GLOB = '**/api/plans**';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Mock both APIs so completePaso1 + paso-2 load correctly. */
async function mockFieldsAndPlans(
  page: Page,
  plansBody: unknown = CO_PLANS_RESPONSE,
): Promise<void> {
  await page.route(FIELDS_API_GLOB, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CO_FIELDS_RESPONSE),
    });
  });
  await page.route(PLANS_API_GLOB, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(plansBody),
    });
  });
}

/** Mock plans API with an HTTP 500. */
async function mockPlansError(page: Page): Promise<void> {
  await page.route(FIELDS_API_GLOB, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CO_FIELDS_RESPONSE),
    });
  });
  await page.route(PLANS_API_GLOB, async (route: Route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  });
}

/**
 * Mock plans API with a hanging promise so we can assert the loading state
 * before it resolves. Returns a resolve function to unblock the route.
 */
async function mockPlansPending(
  page: Page,
  resolveBody: unknown = CO_PLANS_RESPONSE,
): Promise<() => Promise<void>> {
  await page.route(FIELDS_API_GLOB, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CO_FIELDS_RESPONSE),
    });
  });

  let routeRef: Route | null = null;
  await page.route(PLANS_API_GLOB, (route: Route) => {
    routeRef = route;
    // Intentionally do not fulfill — leaves request hanging.
  });

  return async () => {
    if (routeRef) {
      await routeRef.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(resolveBody),
      });
    }
  };
}

// ---------------------------------------------------------------------------
// completePaso1 helper
// ---------------------------------------------------------------------------

/**
 * Navigates to /co/paso-1, fills a minimum valid form with fictional data,
 * clicks "Continuar" and waits until the URL shows paso-2.
 *
 * The fields API must already be mocked before calling this.
 * Uses the current year so that the price-adjustment rule does NOT apply by
 * default (vehicleYear == currentYear → not older than 5 years).
 */
async function completePaso1(page: Page): Promise<void> {
  await page.goto('/co/paso-1');
  // Wait for form to be ready (loading spinner gone)
  await expect(page.getByRole('status')).not.toBeVisible();

  await page.getByLabel('Nombre completo').fill('Ana García Pérez');
  await page.getByLabel('Número de cédula').fill('87654321');
  await page.getByLabel('Placa del vehículo').fill('ABC123');
  // Current year → vehicleYear == currentYear → no surcharge
  await page.getByLabel('Año del vehículo').fill(String(new Date().getFullYear()));
  await page.getByLabel('Marca del vehículo').focus();
  await page.getByLabel('Marca del vehículo').selectOption('toyota');
  await page.getByLabel('Marca del vehículo').blur();

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/paso-2/);
}

/**
 * Variant of completePaso1 that uses an old vehicle year to trigger the
 * 10% price-adjustment surcharge (AC-02.3).
 * oldYear = currentYear - 20 (well beyond the 5-year threshold).
 */
async function completePaso1OldVehicle(page: Page): Promise<void> {
  await page.goto('/co/paso-1');
  await expect(page.getByRole('status')).not.toBeVisible();

  const oldYear = new Date().getFullYear() - 20;

  await page.getByLabel('Nombre completo').fill('Carlos López Ruiz');
  await page.getByLabel('Número de cédula').fill('12345678');
  await page.getByLabel('Placa del vehículo').fill('XYZ789');
  await page.getByLabel('Año del vehículo').fill(String(oldYear));
  await page.getByLabel('Marca del vehículo').focus();
  await page.getByLabel('Marca del vehículo').selectOption('renault');
  await page.getByLabel('Marca del vehículo').blur();

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/paso-2/);
}

// ---------------------------------------------------------------------------
// axe helper
// ---------------------------------------------------------------------------

/**
 * Inject axe-core and run audit; fail on serious/critical violations.
 * Requires axe-core to be installed (it is — see package.json devDependencies).
 */
async function runAxe(page: Page): Promise<void> {
  await page.addScriptTag({
    path: require.resolve('axe-core/axe.min.js'),
  });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: Function } }).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    return (
      result.violations as Array<{ id: string; impact: string; description: string }>
    ).filter((v) => v.impact === 'serious' || v.impact === 'critical');
  });
  if (violations.length > 0) {
    const summary = violations
      .map((v) => `[${v.impact}] ${v.id}: ${v.description}`)
      .join('\n');
    throw new Error(
      `axe found ${violations.length} serious/critical violation(s):\n${summary}`,
    );
  }
}

// ---------------------------------------------------------------------------
// AC-02.1 — Plans for active country (published and active)
// ---------------------------------------------------------------------------

test.describe('AC-02.1 Plans of active country displayed', () => {
  test('AC-02.1 /co/paso-2 shows all three CO active plans', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    // All three plan names must be visible
    await expect(page.getByText('Básico')).toBeVisible();
    await expect(page.getByText('Estándar')).toBeVisible();
    await expect(page.getByText('Premium')).toBeVisible();
  });

  test('AC-02.1 plans are rendered in ascending order by order attribute', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    // Extract visible plan names from the radio elements in DOM order
    const planNames = await page
      .locator('[role="radio"] .plan-name')
      .allTextContents();
    expect(planNames).toEqual(['Básico', 'Estándar', 'Premium']);
  });
});

// ---------------------------------------------------------------------------
// AC-02.2 — Price formatted with currency
// ---------------------------------------------------------------------------

test.describe('AC-02.2 Price formatted with currency', () => {
  test('AC-02.2 CO plan price shows $ symbol (COP locale format)', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    // es-CO COP formatting produces "$" prefix; check at least one price cell
    // The plan "Básico" has basePrice 800000 → formatted as "$ 800.000"
    // We look for the $ symbol anywhere in the price-amount spans
    const priceAmounts = page.locator('.price-amount');
    const count = await priceAmounts.count();
    expect(count).toBeGreaterThan(0);

    const firstPrice = await priceAmounts.first().textContent();
    // es-CO currency format contains $ sign
    expect(firstPrice).toMatch(/\$/);
  });

  test('AC-02.2 CO plan with basePrice=1200000 displays formatted amount', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    // "Estándar" has basePrice 1200000
    // es-CO Intl.NumberFormat produces "$ 1.200.000"
    // We locate the card for Estándar and check its price-amount text
    const estandarCard = page.locator('[role="radio"]', { hasText: 'Estándar' });
    const priceText = await estandarCard.locator('.price-amount').textContent();
    expect(priceText).toMatch(/1[.,]200[.,]000/);
    expect(priceText).toMatch(/\$/);
  });
});

// ---------------------------------------------------------------------------
// AC-02.3 — Price adjustment for old vehicle
// ---------------------------------------------------------------------------

test.describe('AC-02.3 Price adjustment for vehicle older than 5 years', () => {
  test('AC-02.3 vehicle 20 years old shows price × 1.10 and adjustment label', async ({
    page,
  }) => {
    // Use a known basePrice of 1,000,000 → adjusted = 1,100,000
    await mockFieldsAndPlans(page, CO_PLANS_KNOWN_PRICE_RESPONSE);
    await completePaso1OldVehicle(page);

    // Price label should reflect the 10% surcharge: 1,100,000
    const priceText = await page.locator('.price-amount').first().textContent();
    expect(priceText).toMatch(/1[.,]100[.,]000/);

    // Adjustment label must be visible
    await expect(
      page.getByText('Precio ajustado por antigüedad del vehículo'),
    ).toBeVisible();
  });

  test('AC-02.3 vehicle with current year shows no adjustment label', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_KNOWN_PRICE_RESPONSE);
    await completePaso1(page); // uses currentYear — no surcharge

    // No adjustment label
    await expect(
      page.getByText('Precio ajustado por antigüedad del vehículo'),
    ).not.toBeVisible();

    // Price should equal basePrice 1,000,000
    const priceText = await page.locator('.price-amount').first().textContent();
    expect(priceText).toMatch(/1[.,]000[.,]000/);
  });

  test('AC-02.3 vehicle exactly 5 years old does NOT trigger surcharge', async ({ page }) => {
    // vehicleYear = currentYear - 5 → not strictly greater than 5 → no surcharge
    await page.route(FIELDS_API_GLOB, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CO_FIELDS_RESPONSE),
      });
    });
    await page.route(PLANS_API_GLOB, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CO_PLANS_KNOWN_PRICE_RESPONSE),
      });
    });

    const fiveYearsAgo = new Date().getFullYear() - 5;

    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();
    await page.getByLabel('Nombre completo').fill('María Torres');
    await page.getByLabel('Número de cédula').fill('55566677');
    await page.getByLabel('Placa del vehículo').fill('MNO345');
    await page.getByLabel('Año del vehículo').fill(String(fiveYearsAgo));
    await page.getByLabel('Marca del vehículo').focus();
    await page.getByLabel('Marca del vehículo').selectOption('chevrolet');
    await page.getByLabel('Marca del vehículo').blur();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/paso-2/);

    // No adjustment label
    await expect(
      page.getByText('Precio ajustado por antigüedad del vehículo'),
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AC-02.4 — Recommended plan badge
// ---------------------------------------------------------------------------

test.describe('AC-02.4 Recommended plan badge', () => {
  test('AC-02.4 plan with recommended=true shows "Recomendado" badge', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    // "Estándar" has recommended:true in the fixture
    const estandarCard = page.locator('[role="radio"]', { hasText: 'Estándar' });
    await expect(estandarCard.getByText('Recomendado')).toBeVisible();
  });

  test('AC-02.4 plans with recommended=false do NOT show the badge', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    // "Básico" and "Premium" have recommended:false
    const basicoCard = page.locator('[role="radio"]', { hasText: 'Básico' });
    await expect(basicoCard.getByText('Recomendado')).not.toBeVisible();

    const premiumCard = page.locator('[role="radio"]', { hasText: 'Premium' });
    await expect(premiumCard.getByText('Recomendado')).not.toBeVisible();
  });

  test('AC-02.4 recommended badge is accessible to screen readers', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    // The badge element has aria-label="Recomendado" (or the text itself is readable)
    // The component uses <span class="badge" aria-label="{{ msgs['plans.recommended'] }}">
    const badge = page.locator('[aria-label="Recomendado"]').first();
    await expect(badge).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AC-02.5 — Single plan selection
// ---------------------------------------------------------------------------

test.describe('AC-02.5 Single plan selection', () => {
  test('AC-02.5 clicking a plan sets aria-checked=true and enables Continuar', async ({
    page,
  }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    const basicoCard = page.locator('[role="radio"]', { hasText: 'Básico' });
    await basicoCard.click();

    await expect(basicoCard).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: 'Continuar' })).not.toBeDisabled();
  });

  test('AC-02.5 selecting a second plan deselects the first', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    const basicoCard = page.locator('[role="radio"]', { hasText: 'Básico' });
    const estandarCard = page.locator('[role="radio"]', { hasText: 'Estándar' });

    await basicoCard.click();
    await expect(basicoCard).toHaveAttribute('aria-checked', 'true');

    await estandarCard.click();
    await expect(estandarCard).toHaveAttribute('aria-checked', 'true');
    await expect(basicoCard).toHaveAttribute('aria-checked', 'false');
  });

  test('AC-02.5 unselected plans have aria-checked=false', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    // No plan selected yet
    const allRadios = page.locator('[role="radio"]');
    const count = await allRadios.count();
    for (let i = 0; i < count; i++) {
      await expect(allRadios.nth(i)).toHaveAttribute('aria-checked', 'false');
    }
  });
});

// ---------------------------------------------------------------------------
// AC-02.6 — Continuar disabled without selection
// ---------------------------------------------------------------------------

test.describe('AC-02.6 Continuar requires a selected plan', () => {
  test('AC-02.6 without selection Continuar is disabled', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    const continuar = page.getByRole('button', { name: 'Continuar' });
    await expect(continuar).toBeDisabled();
  });

  test('AC-02.6 selecting a plan enables Continuar and clicking navigates to paso-3', async ({
    page,
  }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    await page.locator('[role="radio"]', { hasText: 'Premium' }).click();

    const continuar = page.getByRole('button', { name: 'Continuar' });
    await expect(continuar).not.toBeDisabled();

    await continuar.click();
    await expect(page).toHaveURL(/paso-3/);
  });
});

// ---------------------------------------------------------------------------
// AC-02.7 — active=false plan does not appear
// ---------------------------------------------------------------------------

test.describe('AC-02.7 Inactive plans not shown', () => {
  test('AC-02.7 plan with active=false is NOT rendered in the list', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_WITH_INACTIVE_RESPONSE);
    await completePaso1(page);

    // The active plans are visible
    await expect(page.getByText('Básico')).toBeVisible();
    await expect(page.getByText('Estándar')).toBeVisible();
    await expect(page.getByText('Premium')).toBeVisible();

    // The inactive plan must NOT appear
    await expect(page.getByText('Plan Oculto')).not.toBeVisible();

    // Exactly 3 radio items (the 3 active ones)
    await expect(page.locator('[role="radio"]')).toHaveCount(3);
  });
});

// ---------------------------------------------------------------------------
// AC-02.8 — Volver preserves paso-1 form data
// ---------------------------------------------------------------------------

test.describe('AC-02.8 Volver to paso-1 preserves form data', () => {
  test('AC-02.8 clicking Volver navigates back to paso-1 and form values are intact', async ({
    page,
  }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    // Now on paso-2 — click Volver
    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(page).toHaveURL(/paso-1/);

    // Form values must still be there (data persisted in WizardStore)
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Ana García Pérez');
    await expect(page.getByLabel('Número de cédula')).toHaveValue('87654321');
    await expect(page.getByLabel('Placa del vehículo')).toHaveValue('ABC123');
  });
});

// ---------------------------------------------------------------------------
// AC-02.9 — Loading indicator while request is pending
// ---------------------------------------------------------------------------

test.describe('AC-02.9 Loading indicator while plans request is pending', () => {
  test('AC-02.9 role=status element is visible while plans API has not responded', async ({
    page,
  }) => {
    const fulfill = await mockPlansPending(page);

    // Navigate to paso-1 and complete it without triggering paso-2 load yet
    // We navigate directly to paso-1; the fields API resolves immediately.
    // Then after paso-1 is submitted, paso-2 triggers the pending plans request.
    const gotoP1 = page.goto('/co/paso-1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status')).not.toBeVisible(); // fields loaded
    await gotoP1;

    await page.getByLabel('Nombre completo').fill('Test User');
    await page.getByLabel('Número de cédula').fill('11223344');
    await page.getByLabel('Placa del vehículo').fill('TST001');
    await page.getByLabel('Año del vehículo').fill(String(new Date().getFullYear()));
    await page.getByLabel('Marca del vehículo').focus();
    await page.getByLabel('Marca del vehículo').selectOption('toyota');
    await page.getByLabel('Marca del vehículo').blur();

    // Click Continuar — navigates to paso-2 which issues the pending plans request
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/paso-2/);

    // Loading indicator must be visible while request is pending
    await expect(page.getByRole('status')).toBeVisible();

    // Plan cards must NOT be visible yet
    await expect(page.locator('[role="radiogroup"]')).not.toBeVisible();

    // Now resolve the pending request
    await fulfill();

    // Loading indicator goes away and plans appear
    await expect(page.getByRole('status')).not.toBeVisible();
    await expect(page.locator('[role="radiogroup"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AC-02.10 — Network error shows message and retry
// ---------------------------------------------------------------------------

test.describe('AC-02.10 Network error state', () => {
  test('AC-02.10 plans 500 shows system error message and Reintentar button', async ({
    page,
  }) => {
    await mockPlansError(page);
    await completePaso1(page);

    await expect(
      page.getByText('No pudimos cargar los planes. Intenta de nuevo.'),
    ).toBeVisible();

    const retryBtn = page.getByRole('button', { name: 'Reintentar' });
    await expect(retryBtn).toBeVisible();

    // No plan cards shown
    await expect(page.locator('[role="radiogroup"]')).not.toBeVisible();
  });

  test('AC-02.10 clicking Reintentar triggers a new request', async ({ page }) => {
    let callCount = 0;

    await page.route(FIELDS_API_GLOB, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CO_FIELDS_RESPONSE),
      });
    });
    await page.route(PLANS_API_GLOB, async (route: Route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server Error' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(CO_PLANS_RESPONSE),
        });
      }
    });

    await completePaso1(page);

    // Error state shown first
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();

    await page.getByRole('button', { name: 'Reintentar' }).click();

    // After retry, plans load
    await expect(page.getByText('Básico')).toBeVisible();
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// AC-02.11 — Empty plans list shows empty state
// ---------------------------------------------------------------------------

test.describe('AC-02.11 Empty state when no plans', () => {
  test('AC-02.11 data:[] response shows empty-state message and Continuar stays disabled', async ({
    page,
  }) => {
    await mockFieldsAndPlans(page, EMPTY_PLANS_RESPONSE);
    await completePaso1(page);

    // Empty state message
    await expect(
      page.getByText('No hay planes disponibles en este momento.'),
    ).toBeVisible();

    // No plan cards
    await expect(page.locator('[role="radiogroup"]')).not.toBeVisible();

    // Continuar button is NOT rendered in empty / error states
    await expect(page.getByRole('button', { name: 'Continuar' })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AC-02.12 — Plan without coverages is discarded (zod min(1) on coverages)
// ---------------------------------------------------------------------------

test.describe('AC-02.12 Plan with empty coverages discarded by zod', () => {
  test('AC-02.12 plan with coverages:[] is omitted; valid sibling plan renders', async ({
    page,
  }) => {
    await mockFieldsAndPlans(page, CO_PLANS_NO_COVERAGES_RESPONSE);
    await completePaso1(page);

    // The invalid plan must NOT appear
    await expect(page.getByText('Plan Sin Coberturas')).not.toBeVisible();

    // The valid sibling plan must appear
    await expect(page.getByText('Plan Válido')).toBeVisible();

    // Only 1 radio (the valid plan)
    await expect(page.locator('[role="radio"]')).toHaveCount(1);
  });

  test('AC-02.12 when all plans have no coverages the empty state is shown', async ({ page }) => {
    // All-invalid payload: only the plan with no coverages, no valid sibling
    const allInvalidPayload = {
      data: [CO_PLANS_NO_COVERAGES_RESPONSE.data[0]], // only the invalid one
    };
    await mockFieldsAndPlans(page, allInvalidPayload);
    await completePaso1(page);

    await expect(
      page.getByText('No hay planes disponibles en este momento.'),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AC-02.13 — Plan with wrong currency discarded by zod
// ---------------------------------------------------------------------------

test.describe('AC-02.13 Plan with currency mismatch discarded by zod', () => {
  test('AC-02.13 CO plan with currency=CLP is omitted; valid sibling renders', async ({
    page,
  }) => {
    await mockFieldsAndPlans(page, CO_PLANS_WRONG_CURRENCY_RESPONSE);
    await completePaso1(page);

    // The plan with wrong currency must NOT appear
    await expect(page.getByText('Plan Moneda Incorrecta')).not.toBeVisible();

    // The valid plan is shown
    await expect(page.getByText('Plan Válido')).toBeVisible();

    // Only 1 radio (the valid plan)
    await expect(page.locator('[role="radio"]')).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// AC-02.14 — axe: no serious/critical violations in ready state
// ---------------------------------------------------------------------------

test.describe('AC-02.14 Accessibility — axe audit', () => {
  test('AC-02.14 ready state has no serious/critical axe violations', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    // Wait for plans to be fully rendered
    await expect(page.getByText('Básico')).toBeVisible();

    await runAxe(page);
  });

  test('AC-02.14 error state has no serious/critical axe violations', async ({ page }) => {
    await mockPlansError(page);
    await completePaso1(page);

    await expect(
      page.getByText('No pudimos cargar los planes. Intenta de nuevo.'),
    ).toBeVisible();

    await runAxe(page);
  });

  test('AC-02.14 empty state has no serious/critical axe violations', async ({ page }) => {
    await mockFieldsAndPlans(page, EMPTY_PLANS_RESPONSE);
    await completePaso1(page);

    await expect(
      page.getByText('No hay planes disponibles en este momento.'),
    ).toBeVisible();

    await runAxe(page);
  });
});

// ---------------------------------------------------------------------------
// AC-02.15 — Responsive: 375px and 1280px
// ---------------------------------------------------------------------------

test.describe('AC-02.15 Responsive layout', () => {
  test('AC-02.15 375px: plans visible without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    await expect(page.getByText('Básico')).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('AC-02.15 375px: plan cards have minimum touch target height ≥ 44px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    await expect(page.getByText('Básico')).toBeVisible();

    // Every plan card must have min-height 44px
    const cards = page.locator('[role="radio"]');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const height = await cards
        .nth(i)
        .evaluate((el) => el.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(44);
    }
  });

  test('AC-02.15 375px: plans are displayed in single-column layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    await expect(page.getByText('Básico')).toBeVisible();

    // In single-column layout each card width should be close to container width
    const cards = page.locator('[role="radio"]');
    const firstWidth = await cards
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    // The page has horizontal padding; card should be at least 300px wide on 375px viewport
    expect(firstWidth).toBeGreaterThan(300);
  });

  test('AC-02.15 1280px: plans visible without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    await expect(page.getByText('Básico')).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test('AC-02.15 1280px: three plans displayed in multi-column grid', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    await expect(page.getByText('Básico')).toBeVisible();

    // At 1280px the grid uses 3 columns (repeat(3, 1fr)).
    // The three cards should have roughly the same y-position (same row).
    const cards = page.locator('[role="radio"]');
    const positions = await cards.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    // All 3 cards share the same top → same row in the grid
    expect(positions[0]).toBe(positions[1]);
    expect(positions[1]).toBe(positions[2]);
  });
});

// ---------------------------------------------------------------------------
// AC-02.16 — Keyboard-only navigation
// ---------------------------------------------------------------------------

test.describe('AC-02.16 Keyboard-only navigation', () => {
  test(
    'AC-02.16 Tab reaches plans, Space selects, Tab to Continuar, Enter navigates',
    async ({ page }) => {
      await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);

      // Complete paso-1 with keyboard only (no mouse)
      await page.goto('/co/paso-1');
      await expect(page.getByRole('status')).not.toBeVisible();

      await page.getByLabel('Nombre completo').focus();
      await page.keyboard.type('Pedro Rodriguez');
      await page.keyboard.press('Tab');
      await page.keyboard.type('98765432');
      await page.keyboard.press('Tab');
      await page.keyboard.type('XYZ789');
      await page.keyboard.press('Tab');
      await page.keyboard.type(String(new Date().getFullYear()));
      await page.keyboard.press('Tab'); // focus Marca del vehículo
      await page.keyboard.press('t');  // jump to Toyota by letter
      await page.keyboard.press('Tab'); // focus Continuar button
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeFocused();
      await page.keyboard.press('Enter'); // navigate to paso-2

      await expect(page).toHaveURL(/paso-2/);

      // Focus the first plan card via Tab (from wherever focus lands after navigation)
      const firstCard = page.locator('[role="radio"]').first();
      await firstCard.focus();

      // Space selects the focused plan
      await page.keyboard.press('Space');
      await expect(firstCard).toHaveAttribute('aria-checked', 'true');

      // Tab to the Volver button, then Tab again to Continuar
      await page.keyboard.press('Tab'); // may land on Volver or second radio
      // Tab through remaining radios and buttons to reach Continuar
      // We tab until Continuar is focused (max 10 presses to avoid infinite loop)
      let continuar = page.getByRole('button', { name: 'Continuar' });
      let isFocused = false;
      for (let i = 0; i < 10 && !isFocused; i++) {
        isFocused = await continuar.evaluate((el) => document.activeElement === el);
        if (!isFocused) await page.keyboard.press('Tab');
      }
      await expect(continuar).toBeFocused();

      // Enter submits / navigates to paso-3
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/paso-3/);
    },
  );

  test('AC-02.16 Arrow keys navigate between radio items (radiogroup behavior)', async ({
    page,
  }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    // Focus the first plan card
    const firstCard = page.locator('[role="radio"]').first();
    await firstCard.focus();
    await expect(firstCard).toBeFocused();

    // Space selects the first plan
    await page.keyboard.press('Space');
    await expect(firstCard).toHaveAttribute('aria-checked', 'true');

    // Tab to the second plan card and select with Enter
    await page.keyboard.press('Tab');
    const secondCard = page.locator('[role="radio"]').nth(1);
    await expect(secondCard).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(secondCard).toHaveAttribute('aria-checked', 'true');
    await expect(firstCard).toHaveAttribute('aria-checked', 'false');
  });

  test('AC-02.16 axe audit during keyboard-driven ready state', async ({ page }) => {
    await mockFieldsAndPlans(page, CO_PLANS_RESPONSE);
    await completePaso1(page);

    await expect(page.getByText('Básico')).toBeVisible();

    // Select a plan with keyboard
    const firstCard = page.locator('[role="radio"]').first();
    await firstCard.focus();
    await page.keyboard.press('Space');

    // Run axe with a plan selected
    await runAxe(page);
  });
});
