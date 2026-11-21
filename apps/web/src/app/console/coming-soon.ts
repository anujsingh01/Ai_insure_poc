import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Placeholder for console screens scheduled in later milestones. Inputs come from the route's data. */
@Component({
  selector: 'app-coming-soon',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header><h1>{{ title() }}</h1></header>
    <div class="card empty">
      <mat-icon>{{ icon() }}</mat-icon>
      <h2>Arriving in {{ milestone() }}</h2>
      <p class="muted">This screen is designed and scheduled. It will appear here as soon as that milestone ships.</p>
    </div>
  `,
  styles: `
    :host { display: block; padding: 32px; max-width: 1120px; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 20px; }
    .empty { padding: 64px 24px; text-align: center; }
    .empty mat-icon { font-size: 40px; width: 40px; height: 40px; color: var(--ai-primary); }
    .empty h2 { font-size: 18px; font-weight: 600; margin: 12px 0 6px; }
  `,
})
export class ComingSoon {
  readonly title = input('');
  readonly milestone = input('');
  readonly icon = input('construction');
}
