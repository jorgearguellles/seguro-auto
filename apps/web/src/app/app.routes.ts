/**
 * Application routes.
 * /:country branch uses CanMatch guard (ADR-002).
 * WizardStore is provided per-route for lifecycle isolation (ADR-005).
 */
import { type Routes } from '@angular/router';
import { countryGuard } from './country/country.guard';
import { step2Guard, step3Guard } from './wizard/wizard-step.guard';
import { confirmacionGuard } from './wizard/confirmacion.guard';
import { WizardStore } from './wizard/wizard.store';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'co',
  },
  {
    path: ':country',
    canMatch: [countryGuard],
    providers: [WizardStore],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'paso-1',
      },
      {
        path: 'paso-1',
        loadComponent: () =>
          import('./features/applicant-form/applicant-form.component').then(
            (m) => m.ApplicantFormComponent,
          ),
      },
      {
        path: 'paso-2',
        canActivate: [step2Guard],
        loadComponent: () =>
          import('./features/plans/plans.component').then(
            (m) => m.PlansComponent,
          ),
      },
      {
        path: 'paso-3',
        canActivate: [step3Guard],
        loadComponent: () =>
          import('./features/summary/summary.component').then(
            (m) => m.SummaryComponent,
          ),
      },
      {
        // ADR-010 §D3-A — confirmation route; guard requires quoteNumber in store
        path: 'confirmacion',
        canActivate: [confirmacionGuard],
        loadComponent: () =>
          import('./features/confirmacion/confirmacion.component').then(
            (m) => m.ConfirmacionComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'co',
  },
];
