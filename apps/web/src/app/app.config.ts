/**
 * Application bootstrap configuration.
 * Provides router, HttpClient (for StrapiClient via /api proxy).
 * No tokens, no absolute Strapi URLs (CLAUDE.md §7, ADR-003).
 */
import { type ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
  ],
};
