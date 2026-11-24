/**
 * Playwright configuration for e2e tests.
 * All HTTP calls to Strapi are mocked via page.route() — no live server required.
 * Chromium only for CI speed; add more browsers in the DoD checklist if needed.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'list',
  use: {
    // The Angular dev server must be running on 4200.
    // For CI: start it with `ng serve` before running playwright.
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Optionally auto-start the dev server for local development:
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:4200',
  //   reuseExistingServer: !process.env['CI'],
  // },
});
