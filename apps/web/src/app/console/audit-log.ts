import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-audit-log',
  imports: [DatePipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h1>Audit log</h1>
      @if (audit.value(); as a) {
        <span class="badge" [class.bad]="!a.chainIntact">
          <mat-icon>{{ a.chainIntact ? 'verified' : 'gpp_bad' }}</mat-icon>
          {{ a.chainIntact ? 'Tamper check passed' : 'Tamper check failed' }}
        </span>
      }
    </header>
    <p class="muted">Every change in this workspace, in order. Entries can't be edited or deleted.</p>

    <div class="card">
      @if (audit.isLoading()) {
        <p class="pad muted">Loading…</p>
      } @else if (audit.error()) {
        <p class="pad error-text">Couldn't load the audit log.</p>
      } @else {
        <table>
          <thead>
            <tr><th>When</th><th>Action</th><th>Target</th><th>By</th></tr>
          </thead>
          <tbody>
            @for (e of audit.value()?.entries ?? []; track e.id) {
              <tr>
                <td>{{ e.createdAt | date: 'd MMM y, HH:mm:ss' }}</td>
                <td><code>{{ e.action }}</code></td>
                <td>{{ e.targetType ?? '—' }}</td>
                <td>{{ e.actorName ?? (e.actorUserId ? 'Deleted user' : 'System') }}</td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="muted">No activity yet.</td></tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: `
    :host { display: block; padding: 32px; max-width: 1120px; }
    header { display: flex; align-items: center; gap: 16px; }
    h1 { font-size: 24px; font-weight: 600; }
    .badge { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 500; color: var(--ai-success); background: #ecfdf3; border-radius: 999px; padding: 4px 10px 4px 6px; }
    .badge mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .badge.bad { color: var(--ai-danger); background: #fef2f2; }
    .pad { padding: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; font-size: 12px; font-weight: 600; color: var(--ai-muted); padding: 12px 16px; border-bottom: 1px solid var(--ai-border); }
    td:first-child { white-space: nowrap; }
    td { padding: 12px 16px; border-bottom: 1px solid var(--ai-border); }
    tr:last-child td { border-bottom: none; }
    code { font-size: 13px; background: var(--ai-bg); padding: 2px 6px; border-radius: 4px; }
  `,
})
export class AuditLog {
  private readonly api = inject(ApiService);
  protected readonly audit = resource({ loader: () => this.api.audit() });
}
