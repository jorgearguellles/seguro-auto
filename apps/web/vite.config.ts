/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Use jsdom for tests that need DOM (Angular TestBed)
    // Pure validator tests don't need DOM but jsdom won't hurt them
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.e2e.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/app/**/*.ts'],
      exclude: ['src/app/**/*.spec.ts', 'src/main.ts'],
    },
  },
});
