import type { Routes } from '@angular/router';
import { signedIn, signedOut, withOrganization } from './core/guards';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./auth/auth-layout').then((m) => m.AuthLayout),
    canActivate: [signedOut],
    children: [
      { path: 'login', loadComponent: () => import('./auth/login').then((m) => m.Login), title: 'Sign in · AI Insure' },
      { path: 'signup', loadComponent: () => import('./auth/signup').then((m) => m.Signup), title: 'Create account · AI Insure' },
      {
        path: 'forgot-password',
        loadComponent: () => import('./auth/forgot-password').then((m) => m.ForgotPassword),
        title: 'Reset password · AI Insure',
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./auth/reset-password').then((m) => m.ResetPassword),
        title: 'New password · AI Insure',
      },
    ],
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./auth/auth-layout').then((m) => m.AuthLayout),
    canActivate: [signedIn],
    children: [
      {
        path: 'organization',
        loadComponent: () => import('./onboarding/create-organization').then((m) => m.CreateOrganization),
        title: 'Your company · AI Insure',
      },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./console/shell').then((m) => m.Shell),
    canActivate: [withOrganization],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'setup' },
      { path: 'setup', loadComponent: () => import('./onboarding/setup').then((m) => m.Setup), title: 'Set up · AI Insure' },
      {
        path: 'command-center',
        loadComponent: () => import('./console/coming-soon').then((m) => m.ComingSoon),
        data: { title: 'Command Center', milestone: 'M2', icon: 'space_dashboard' },
      },
      {
        path: 'calls',
        loadComponent: () => import('./console/coming-soon').then((m) => m.ComingSoon),
        data: { title: 'Live calls', milestone: 'M2', icon: 'call' },
      },
      {
        path: 'tickets',
        loadComponent: () => import('./console/coming-soon').then((m) => m.ComingSoon),
        data: { title: 'Tickets', milestone: 'M2', icon: 'confirmation_number' },
      },
      {
        path: 'customers',
        loadComponent: () => import('./console/coming-soon').then((m) => m.ComingSoon),
        data: { title: 'Customers', milestone: 'M1', icon: 'groups' },
      },
      {
        path: 'kyc',
        loadComponent: () => import('./console/coming-soon').then((m) => m.ComingSoon),
        data: { title: 'KYC review', milestone: 'M3', icon: 'badge' },
      },
      {
        path: 'follow-ups',
        loadComponent: () => import('./console/coming-soon').then((m) => m.ComingSoon),
        data: { title: 'Follow-ups', milestone: 'M4', icon: 'schedule_send' },
      },
      {
        path: 'agent-studio',
        loadComponent: () => import('./console/coming-soon').then((m) => m.ComingSoon),
        data: { title: 'Agent Studio', milestone: 'M2', icon: 'graphic_eq' },
      },
      {
        path: 'integrations',
        loadComponent: () => import('./console/coming-soon').then((m) => m.ComingSoon),
        data: { title: 'Integrations', milestone: 'M3–M7', icon: 'hub' },
      },
      { path: 'settings/audit', loadComponent: () => import('./console/audit-log').then((m) => m.AuditLog), title: 'Audit log · AI Insure' },
    ],
  },
  { path: '**', redirectTo: '' },
];
