import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { createAuthClient } from 'better-auth/client';
import { organizationClient, twoFactorClient } from 'better-auth/client/plugins';
import { firstValueFrom } from 'rxjs';

export type OrgRole = 'owner' | 'admin' | 'supervisor' | 'agent' | 'reviewer' | 'developer' | 'viewer';

export interface Me {
  user: { id: string; email: string; name: string; emailVerified: boolean };
  activeOrganizationId: string | null;
  organizations: { id: string; name: string; slug: string; role: OrgRole[] }[];
}

/** Turns an auth library error into a message we can show the user. */
function failure(error: { message?: string; status?: number } | null): never {
  throw new Error(error?.message || 'Something went wrong. Please try again.');
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  // Same origin as the app: the dev server proxies /api to the API, and production serves both behind one domain.
  private readonly client = createAuthClient({
    baseURL: window.location.origin,
    basePath: '/api/auth',
    plugins: [organizationClient(), twoFactorClient()],
  });

  private readonly meState = signal<Me | null | undefined>(undefined);
  /** `undefined` = not loaded yet, `null` = signed out. */
  readonly me = this.meState.asReadonly();
  readonly activeOrg = computed(() => {
    const me = this.meState();
    return me?.organizations.find((o) => o.id === me.activeOrganizationId) ?? null;
  });
  readonly isAdmin = computed(() => this.activeOrg()?.role.some((r) => r === 'owner' || r === 'admin') ?? false);

  /** Loads the current user once; pass `force` after anything that changes the session. */
  async load(force = false): Promise<Me | null> {
    if (!force && this.meState() !== undefined) return this.meState()!;
    try {
      const me = await firstValueFrom(this.http.get<Me>('/api/me'));
      this.meState.set(me);
      return me;
    } catch {
      this.meState.set(null);
      return null;
    }
  }

  async signUp(input: { name: string; email: string; password: string }): Promise<void> {
    const { error } = await this.client.signUp.email({ ...input, callbackURL: '/onboarding/organization' });
    if (error) failure(error);
  }

  async signIn(input: { email: string; password: string }): Promise<void> {
    const { error } = await this.client.signIn.email({ ...input, callbackURL: '/' });
    if (error) {
      if (error.status === 403) throw new Error('Please confirm your email first. We have sent you a new link.');
      failure(error);
    }
    await this.load(true);
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.client.signIn.social({ provider: 'google', callbackURL: `${window.location.origin}/` });
    if (error) failure(error);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.client.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
    if (error) failure(error);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { error } = await this.client.resetPassword({ token, newPassword });
    if (error) failure(error);
  }

  async signOut(): Promise<void> {
    await this.client.signOut();
    this.meState.set(null);
  }

  async createOrganization(name: string): Promise<void> {
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await this.client.organization.create({ name, slug });
    if (error || !data) failure(error);
    await this.setActiveOrganization(data.id);
  }

  async setActiveOrganization(organizationId: string): Promise<void> {
    const { error } = await this.client.organization.setActive({ organizationId });
    if (error) failure(error);
    await this.load(true);
  }
}
