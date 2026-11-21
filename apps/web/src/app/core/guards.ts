import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/** Signed-in users only. These guards are for navigation; the API enforces access on every request. */
export const signedIn: CanActivateFn = async () => {
  const me = await inject(AuthService).load();
  return me ? true : inject(Router).parseUrl('/login');
};

/** Signed-in users with an active organisation. */
export const withOrganization: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const me = await auth.load();
  if (!me) return router.parseUrl('/login');
  if (!me.activeOrganizationId) {
    const first = me.organizations[0];
    if (!first) return router.parseUrl('/onboarding/organization');
    await auth.setActiveOrganization(first.id);
  }
  return true;
};

/** Pages like login and sign-up: send signed-in users onwards. */
export const signedOut: CanActivateFn = async () => {
  const me = await inject(AuthService).load();
  return me ? inject(Router).parseUrl('/') : true;
};
