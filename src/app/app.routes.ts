import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/user-dashboard/user-dashboard.component')
        .then(m => m.UserDashboardComponent),
  },
  { path: '**', redirectTo: '' },
];
