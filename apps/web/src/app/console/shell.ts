import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const NAV: { heading?: string; items: NavItem[] }[] = [
  {
    items: [
      { path: '/setup', label: 'Get started', icon: 'rocket_launch' },
      { path: '/command-center', label: 'Command Center', icon: 'space_dashboard' },
      { path: '/calls', label: 'Live calls', icon: 'call' },
      { path: '/tickets', label: 'Tickets', icon: 'confirmation_number' },
      { path: '/customers', label: 'Customers', icon: 'groups' },
      { path: '/kyc', label: 'KYC review', icon: 'badge' },
      { path: '/follow-ups', label: 'Follow-ups', icon: 'schedule_send' },
    ],
  },
  {
    heading: 'Configure',
    items: [
      { path: '/agent-studio', label: 'Agent Studio', icon: 'graphic_eq' },
      { path: '/integrations', label: 'Integrations', icon: 'hub' },
      { path: '/settings/audit', label: 'Audit log', icon: 'policy', adminOnly: true },
    ],
  },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatButtonModule, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <nav class="side" aria-label="Main">
        <div class="logo"><span class="mark">AI</span> INSURE</div>

        <button class="org" [matMenuTriggerFor]="orgMenu" aria-label="Switch organisation">
          <span class="org-avatar">{{ initial(auth.activeOrg()?.name) }}</span>
          <span class="org-name">{{ auth.activeOrg()?.name }}</span>
          <mat-icon>unfold_more</mat-icon>
        </button>
        <mat-menu #orgMenu="matMenu">
          @for (org of auth.me()?.organizations ?? []; track org.id) {
            <button mat-menu-item (click)="switchOrg(org.id)">
              <mat-icon>{{ org.id === auth.activeOrg()?.id ? 'check' : '' }}</mat-icon>{{ org.name }}
            </button>
          }
          <button mat-menu-item routerLink="/onboarding/organization"><mat-icon>add</mat-icon>New organisation</button>
        </mat-menu>

        @for (group of nav; track $index) {
          @if (group.heading) {
            <div class="heading">{{ group.heading }}</div>
          }
          @for (item of group.items; track item.path) {
            @if (!item.adminOnly || auth.isAdmin()) {
              <a [routerLink]="item.path" routerLinkActive="active">
                <mat-icon>{{ item.icon }}</mat-icon>{{ item.label }}
              </a>
            }
          }
        }

        <div class="spacer"></div>
        <button class="user" [matMenuTriggerFor]="userMenu">
          <span class="avatar">{{ initial(auth.me()?.user?.name) }}</span>
          <span class="who">
            <span class="name">{{ auth.me()?.user?.name }}</span>
            <span class="email">{{ auth.me()?.user?.email }}</span>
          </span>
        </button>
        <mat-menu #userMenu="matMenu">
          <button mat-menu-item (click)="signOut()"><mat-icon>logout</mat-icon>Sign out</button>
        </mat-menu>
      </nav>
      <main><router-outlet /></main>
    </div>
  `,
  styles: `
    .shell { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; }
    .side { background: var(--ai-surface); border-right: 1px solid var(--ai-border); padding: 16px 12px; display: flex; flex-direction: column; gap: 2px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
    .logo { font-weight: 700; letter-spacing: 0.04em; color: var(--ai-ink); padding: 4px 8px 16px; display: flex; align-items: center; gap: 8px; }
    .mark { background: var(--ai-primary); color: #fff; border-radius: 6px; padding: 2px 6px; font-size: 13px; }
    .org, .user { display: flex; align-items: center; gap: 10px; width: 100%; border: 1px solid var(--ai-border); background: #fff; border-radius: 8px; padding: 8px; cursor: pointer; font: inherit; color: inherit; text-align: left; margin-bottom: 12px; }
    .org-avatar, .avatar { width: 28px; height: 28px; border-radius: 6px; background: var(--ai-primary-soft); color: var(--ai-primary); display: grid; place-items: center; font-weight: 600; font-size: 13px; flex: none; }
    .avatar { border-radius: 50%; }
    .org-name { flex: 1; font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .org mat-icon { color: var(--ai-muted); font-size: 18px; width: 18px; height: 18px; }
    .heading { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ai-muted); padding: 16px 10px 6px; }
    a { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; color: var(--ai-text); text-decoration: none; font-size: 14px; font-weight: 500; }
    a mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--ai-muted); }
    a:hover { background: var(--ai-bg); }
    a.active { background: var(--ai-primary-soft); color: var(--ai-primary-strong); }
    a.active mat-icon { color: var(--ai-primary); }
    .spacer { flex: 1; }
    .user { margin: 8px 0 0; border: none; }
    .user:hover { background: var(--ai-bg); }
    .who { display: flex; flex-direction: column; min-width: 0; }
    .name { font-weight: 600; font-size: 13.5px; }
    .email { font-size: 12px; color: var(--ai-muted); overflow: hidden; text-overflow: ellipsis; }
    main { min-width: 0; }
    @media (max-width: 800px) {
      .shell { grid-template-columns: 1fr; }
      .side { position: static; height: auto; }
    }
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly nav = NAV;

  protected initial(name: string | undefined): string {
    return (name ?? '?').trim().charAt(0).toUpperCase();
  }

  async switchOrg(id: string): Promise<void> {
    await this.auth.setActiveOrganization(id);
    // Reload the current view so nothing from the previous organisation stays on screen.
    await this.router.navigateByUrl('/setup', { onSameUrlNavigation: 'reload' });
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
