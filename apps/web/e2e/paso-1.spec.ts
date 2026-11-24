/**
 * E2E tests for US-01 — Paso 1: Formulario de datos del titular y vehículo.
 *
 * All Strapi HTTP calls are mocked with page.route().
 * No real Strapi instance is required.
 *
 * axe-core is injected per page load; violations at 'serious'/'critical' fail the test.
 * Keyboard-only test navigates without any mouse interaction.
 *
 * AC-01.1  — country-scoped field rendering and order
 * AC-01.2  — blur triggers error message from Strapi config
 * AC-01.3  — invalid form blocks advance; focus moves to first error
 * AC-01.4  — new Strapi field appears without code change
 * AC-01.5  — data persists when navigating back from paso-2
 * AC-01.9  — loading indicator while request is pending
 * AC-01.10 — 500 error shows retry button
 * AC-01.11 — empty Strapi response shows empty state; advance disabled
 * AC-01.13 — full keyboard navigation + axe audit
 * AC-01.14 — responsive: 375 px and 1280 px
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import {
  CO_FIELDS_RESPONSE,
  CL_FIELDS_RESPONSE,
  CO_FIELDS_WITH_EXTRA,
  EMPTY_FIELDS_RESPONSE,
} from './fixtures/form-fields';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_GLOB = '**/api/form-fields**';

/** Mock the form-fields API once with the given payload. */
async function mockFields(page: Page, body: unknown): Promise<void> {
  await page.route(API_GLOB, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/** Mock the form-fields API to respond with an HTTP 500 error. */
async function mockFieldsError(page: Page): Promise<void> {
  await page.route(API_GLOB, async (route: Route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  });
}

/**
 * Mock the form-fields API with a hanging promise so we can assert
 * the loading state before it resolves. Fulfills with CO_FIELDS_RESPONSE
 * after a short delay resolved by calling the returned resolve fn.
 */
async function mockFieldsPending(page: Page): Promise<() => Promise<void>> {
  let routeRef: Route | null = null;
  await page.route(API_GLOB, (route: Route) => {
    routeRef = route;
    // Intentionally do not fulfill — leaves request hanging.
  });
  return async () => {
    if (routeRef) {
      await routeRef.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CO_FIELDS_RESPONSE),
      });
    }
  };
}

/**
 * Inject axe-core and run audit; fail on serious/critical violations.
 *
 * Requires axe-core to be installed:
 *   npm --prefix apps/web install --save-dev axe-core
 *
 * axe-core is loaded from node_modules into the page context.
 */
async function runAxe(page: Page): Promise<void> {
  // Load axe-core from the local node_modules package.
  // If axe-core is not installed, this will throw — add it as a devDependency.
  await page.addScriptTag({
    path: require.resolve('axe-core/axe.min.js'),
  });
  const violations = await page.evaluate(async () => {
    // axe is injected globally by addScriptTag above
    const axe = (window as unknown as { axe: { run: Function } }).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    return (result.violations as Array<{ id: string; impact: string; description: string }>).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
  });
  if (violations.length > 0) {
    const summary = violations
      .map((v) => `[${v.impact}] ${v.id}: ${v.description}`)
      .join('\n');
    throw new Error(`axe found ${violations.length} serious/critical violation(s):\n${summary}`);
  }
}

// ---------------------------------------------------------------------------
// AC-01.1 — Formulario configurado por país
// ---------------------------------------------------------------------------

test.describe('AC-01.1 Country-scoped field rendering', () => {
  test('AC-01.1 /co/paso-1 shows only CO fields in configured order', async ({ page }) => {
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');

    // Wait for form to be ready (loading spinner gone)
    await expect(page.getByRole('status')).not.toBeVisible();

    // All CO labels are present
    await expect(page.getByLabel('Nombre completo')).toBeVisible();
    await expect(page.getByLabel('Número de cédula')).toBeVisible();
    await expect(page.getByLabel('Placa del vehículo')).toBeVisible();
    await expect(page.getByLabel('Año del vehículo')).toBeVisible();
    await expect(page.getByLabel('Marca del vehículo')).toBeVisible();

    // CL-only field (RUT) must NOT appear
    await expect(page.getByLabel('RUT')).not.toBeVisible();

    // Fields appear in ascending order by checking DOM order of labels
    const labels = await page.locator('.field-label').allTextContents();
    const labelsClean = labels.map((l) => l.replace('*', '').trim());
    const expectedOrder = [
      'Nombre completo',
      'Número de cédula',
      'Placa del vehículo',
      'Año del vehículo',
      'Marca del vehículo',
    ];
    for (let i = 0; i < expectedOrder.length; i++) {
      expect(labelsClean[i]).toBe(expectedOrder[i]);
    }
  });

  test('AC-01.1 /cl/paso-1 shows only CL fields in configured order', async ({ page }) => {
    await mockFields(page, CL_FIELDS_RESPONSE);
    await page.goto('/cl/paso-1');

    await expect(page.getByRole('status')).not.toBeVisible();

    await expect(page.getByLabel('Nombre completo')).toBeVisible();
    await expect(page.getByLabel('RUT')).toBeVisible();
    await expect(page.getByLabel('Patente del vehículo')).toBeVisible();

    // CO-only fields must NOT appear
    await expect(page.getByLabel('Número de cédula')).not.toBeVisible();
    await expect(page.getByLabel('Placa del vehículo')).not.toBeVisible();
  });

  test('AC-01.1 each field shows its label and help text from Strapi', async ({ page }) => {
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');

    await expect(page.getByRole('status')).not.toBeVisible();

    // "Nombre completo" has helpText configured
    await expect(page.getByText('Tal como aparece en su cédula')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AC-01.2 — Mensaje de error configurado por campo
// ---------------------------------------------------------------------------

test.describe('AC-01.2 Configured error message on blur', () => {
  test('AC-01.2 entering invalid cedula then blurring shows Strapi error message', async ({
    page,
  }) => {
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    const cedulaInput = page.getByLabel('Número de cédula');
    await cedulaInput.fill('ABC'); // invalid: not digits
    await cedulaInput.blur();

    // The error message is from Strapi config
    await expect(page.getByText('Cédula inválida (6–10 dígitos)')).toBeVisible();

    // Field must have aria-invalid="true" (AC-01.13)
    await expect(cedulaInput).toHaveAttribute('aria-invalid', 'true');

    // AC-01.2 spec: button must be disabled when form is invalid.
    // NOTE: this test FAILS on the current implementation — see BUG-01 in handoff.
    // The implementation only disables the button during isSubmitting(), not on invalid state.
    const submitBtn = page.getByRole('button', { name: 'Continuar' });
    await expect(submitBtn).toBeDisabled();
  });

  test('AC-01.2 entering invalid plate then blurring shows plate error message', async ({
    page,
  }) => {
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    const plateInput = page.getByLabel('Placa del vehículo');
    await plateInput.fill('123'); // invalid plate
    await plateInput.blur();

    await expect(page.getByText('Placa inválida (ej. ABC123)')).toBeVisible();
    await expect(plateInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('AC-01.2 fixing an invalid field removes the error message', async ({ page }) => {
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    const cedulaInput = page.getByLabel('Número de cédula');
    await cedulaInput.fill('ABC');
    await cedulaInput.blur();
    await expect(page.getByText('Cédula inválida (6–10 dígitos)')).toBeVisible();

    // Now fix the value — after first error, re-validates on change (RN-01.14)
    await cedulaInput.fill('12345678');
    await expect(page.getByText('Cédula inválida (6–10 dígitos)')).not.toBeVisible();
    await expect(cedulaInput).not.toHaveAttribute('aria-invalid', 'true');
  });
});

// ---------------------------------------------------------------------------
// AC-01.3 — Campos obligatorios bloquean el avance
// ---------------------------------------------------------------------------

test.describe('AC-01.3 Required fields block advance', () => {
  test('AC-01.3 clicking Continuar with empty form stays on paso-1 and shows all errors', async ({
    page,
  }) => {
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    await page.getByRole('button', { name: 'Continuar' }).click();

    // Still on paso-1
    await expect(page).toHaveURL(/paso-1/);

    // Required error messages are shown for all required fields
    await expect(page.getByText('El nombre es obligatorio')).toBeVisible();
    await expect(page.getByText('Cédula inválida (6–10 dígitos)')).toBeVisible();
    await expect(page.getByText('Placa inválida (ej. ABC123)')).toBeVisible();
  });

  test('AC-01.3 focus moves to first invalid field after failed submit', async ({ page }) => {
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    await page.getByRole('button', { name: 'Continuar' }).click();

    // The first field (fullName, order 1) should receive focus
    const firstField = page.getByLabel('Nombre completo');
    await expect(firstField).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// AC-01.4 — Reflejo de cambios de Strapi sin despliegue
// ---------------------------------------------------------------------------

test.describe('AC-01.4 New Strapi field appears without code change', () => {
  test('AC-01.4 extra field from Strapi renders at its configured order position', async ({
    page,
  }) => {
    await mockFields(page, CO_FIELDS_WITH_EXTRA);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    // The extra field (order 6) must be visible
    await expect(page.getByLabel('Ciudad de residencia')).toBeVisible();
    await expect(page.getByText('Ciudad donde reside actualmente')).toBeVisible();

    // It should appear after the original 5 fields
    const labels = await page.locator('.field-label').allTextContents();
    const labelsClean = labels.map((l) => l.replace('*', '').trim());
    const cityIndex = labelsClean.indexOf('Ciudad de residencia');
    expect(cityIndex).toBe(5); // 0-indexed, 6th position
  });
});

// ---------------------------------------------------------------------------
// AC-01.5 — Persistencia entre pasos
// ---------------------------------------------------------------------------

test.describe('AC-01.5 Data persists when navigating back from paso-2', () => {
  test('AC-01.5 filled values are restored after going to paso-2 and back', async ({ page }) => {
    // Also mock paso-2 route guard needs applicant set, so we fill and submit the form
    await page.route(API_GLOB, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CO_FIELDS_RESPONSE),
      });
    });

    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    // Fill all required fields with valid fictional data
    await page.getByLabel('Nombre completo').fill('Ana García Pérez');
    await page.getByLabel('Número de cédula').fill('87654321');
    await page.getByLabel('Placa del vehículo').fill('ABC123');
    await page.getByLabel('Año del vehículo').fill(String(new Date().getFullYear()));
    await page.getByLabel('Marca del vehículo').selectOption('toyota');

    // Click Continuar — step2Guard allows because applicant is set in ngOnDestroy
    // We intercept navigation to paso-2 and immediately go back
    await page.getByRole('button', { name: 'Continuar' }).click();

    // We may land on paso-2 or be redirected; go back to paso-1
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    // Values should be restored
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Ana García Pérez');
    await expect(page.getByLabel('Número de cédula')).toHaveValue('87654321');
    await expect(page.getByLabel('Placa del vehículo')).toHaveValue('ABC123');
    await expect(page.getByLabel('Año del vehículo')).toHaveValue(
      String(new Date().getFullYear()),
    );
    await expect(page.getByLabel('Marca del vehículo')).toHaveValue('toyota');

    // No error messages should be pre-shown (AC-01.5)
    await expect(page.getByText('El nombre es obligatorio')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AC-01.9 — Estado de carga
// ---------------------------------------------------------------------------

test.describe('AC-01.9 Loading indicator while request is pending', () => {
  test('AC-01.9 shows accessible loading indicator before Strapi responds', async ({ page }) => {
    const fulfill = await mockFieldsPending(page);

    // Navigate without waiting for full load (request is intentionally pending)
    const gotoPromise = page.goto('/co/paso-1', { waitUntil: 'domcontentloaded' });

    // Loading indicator with role="status" should be visible
    await expect(page.getByRole('status')).toBeVisible();

    // Fields are NOT available while loading
    await expect(page.getByLabel('Nombre completo')).not.toBeVisible();

    // Fulfill the pending request
    await fulfill();
    await gotoPromise;

    // Loading indicator goes away
    await expect(page.getByRole('status')).not.toBeVisible();
    await expect(page.getByLabel('Nombre completo')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AC-01.10 — Error de red al cargar la configuración
// ---------------------------------------------------------------------------

test.describe('AC-01.10 Network error shows retry button', () => {
  test('AC-01.10 Strapi 500 shows system error message and retry button', async ({ page }) => {
    await mockFieldsError(page);
    await page.goto('/co/paso-1');

    // Error state message from system-messages.ts
    await expect(
      page.getByText('No pudimos cargar el formulario. Intenta de nuevo.'),
    ).toBeVisible();

    // Retry button is present
    const retryBtn = page.getByRole('button', { name: 'Reintentar' });
    await expect(retryBtn).toBeVisible();

    // Form is NOT rendered (no field inputs)
    await expect(page.getByLabel('Nombre completo')).not.toBeVisible();
  });

  test('AC-01.10 clicking Reintentar triggers a new request', async ({ page }) => {
    let callCount = 0;
    await page.route(API_GLOB, async (route) => {
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
          body: JSON.stringify(CO_FIELDS_RESPONSE),
        });
      }
    });

    await page.goto('/co/paso-1');
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();

    await page.getByRole('button', { name: 'Reintentar' }).click();

    // After retry the form should load
    await expect(page.getByLabel('Nombre completo')).toBeVisible();
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// AC-01.11 — Estado vacío de configuración
// ---------------------------------------------------------------------------

test.describe('AC-01.11 Empty configuration state', () => {
  test('AC-01.11 Strapi returns empty array — empty state visible, advance disabled', async ({
    page,
  }) => {
    await mockFields(page, EMPTY_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');

    // Empty state message
    await expect(
      page.getByText('No hay campos configurados para tu país.'),
    ).toBeVisible();

    // No form fields rendered
    await expect(page.getByLabel('Nombre completo')).not.toBeVisible();

    // No "Continuar" button in empty state (or it's absent)
    await expect(page.getByRole('button', { name: 'Continuar' })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AC-01.13 — Accesibilidad por teclado y lector de pantalla
// ---------------------------------------------------------------------------

test.describe('AC-01.13 Keyboard navigation and axe audit', () => {
  test('AC-01.13 all fields reachable with Tab; axe finds no serious/critical violations', async ({
    page,
  }) => {
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    // Run axe on the loaded form
    await runAxe(page);

    // Tab through all fields by keyboard only
    // Start from body, Tab to first field
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Nombre completo')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Número de cédula')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Placa del vehículo')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Año del vehículo')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Marca del vehículo')).toBeFocused();

    await page.keyboard.press('Tab');
    // Should reach the submit button
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeFocused();
  });

  test('AC-01.13 each field has a programmatically associated label', async ({ page }) => {
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    const fields = [
      'Nombre completo',
      'Número de cédula',
      'Placa del vehículo',
      'Año del vehículo',
      'Marca del vehículo',
    ];

    for (const label of fields) {
      // getByLabel uses aria labelledby / for= association
      const control = page.getByLabel(label);
      await expect(control).toBeVisible();
    }
  });

  test('AC-01.13 error message associated via aria-describedby', async ({ page }) => {
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    const cedulaInput = page.getByLabel('Número de cédula');
    await cedulaInput.fill('ABC');
    await cedulaInput.blur();

    await expect(page.getByText('Cédula inválida (6–10 dígitos)')).toBeVisible();

    // aria-describedby must reference the error element's id
    const describedBy = await cedulaInput.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(describedBy).toContain('error-documentNumber');
  });

  test('AC-01.13 keyboard-only wizard: Tab/Enter submits form with valid data', async ({
    page,
  }) => {
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    // Fill form entirely by keyboard
    await page.keyboard.press('Tab'); // focus Nombre completo
    await page.keyboard.type('Pedro Rodríguez');

    await page.keyboard.press('Tab'); // focus Número de cédula
    await page.keyboard.type('98765432');

    await page.keyboard.press('Tab'); // focus Placa del vehículo
    await page.keyboard.type('XYZ789');

    await page.keyboard.press('Tab'); // focus Año del vehículo
    await page.keyboard.type(String(new Date().getFullYear()));

    await page.keyboard.press('Tab'); // focus Marca del vehículo (select)
    // Select first real option: ArrowDown skips the placeholder "—" and selects next option
    await page.keyboard.press('ArrowDown'); // moves to first option (toyota)

    await page.keyboard.press('Tab'); // focus Continuar button
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeFocused();
    await page.keyboard.press('Enter'); // submit

    // Should navigate away from paso-1 (to paso-2)
    await expect(page).toHaveURL(/paso-2/);
  });

  test('AC-01.13 axe audit on loading state has no serious/critical violations', async ({
    page,
  }) => {
    const fulfill = await mockFieldsPending(page);
    const gotoPromise = page.goto('/co/paso-1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status')).toBeVisible();

    await runAxe(page);

    await fulfill();
    await gotoPromise;
  });

  test('AC-01.13 axe audit on error state has no serious/critical violations', async ({
    page,
  }) => {
    await mockFieldsError(page);
    await page.goto('/co/paso-1');
    await expect(page.getByText('No pudimos cargar el formulario. Intenta de nuevo.')).toBeVisible();

    await runAxe(page);
  });

  test('AC-01.13 axe audit on empty state has no serious/critical violations', async ({
    page,
  }) => {
    await mockFields(page, EMPTY_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByText('No hay campos configurados para tu país.')).toBeVisible();

    await runAxe(page);
  });
});

// ---------------------------------------------------------------------------
// AC-01.14 — Responsive 375px y 1280px
// ---------------------------------------------------------------------------

test.describe('AC-01.14 Responsive layout', () => {
  test('AC-01.14 375px: no horizontal scroll, all fields visible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    // No horizontal scroll: scrollWidth should equal clientWidth (or ≤ viewport)
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // All fields still visible
    await expect(page.getByLabel('Nombre completo')).toBeVisible();
    await expect(page.getByLabel('Número de cédula')).toBeVisible();
    await expect(page.getByLabel('Placa del vehículo')).toBeVisible();
  });

  test('AC-01.14 375px: interactive controls are at least 44px tall', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    // Check the first text input height
    const inputHeight = await page.getByLabel('Nombre completo').evaluate(
      (el) => el.getBoundingClientRect().height,
    );
    expect(inputHeight).toBeGreaterThanOrEqual(44);

    // Check the submit button height
    const btnHeight = await page
      .getByRole('button', { name: 'Continuar' })
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(btnHeight).toBeGreaterThanOrEqual(44);
  });

  test('AC-01.14 1280px: no horizontal scroll, correct desktop layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    await expect(page.getByLabel('Nombre completo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
  });

  test('AC-01.14 1280px: form is centered within max-width container', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockFields(page, CO_FIELDS_RESPONSE);
    await page.goto('/co/paso-1');
    await expect(page.getByRole('status')).not.toBeVisible();

    // The form wrapper should not span the full 1280px width
    const formWidth = await page.locator('.form-page').evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    expect(formWidth).toBeLessThan(1280);
  });
});
