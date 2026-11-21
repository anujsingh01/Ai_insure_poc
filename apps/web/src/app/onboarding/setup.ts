import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService, type Industry } from '../core/api.service';
import { AuthService } from '../core/auth.service';

interface Step {
  key: string;
  title: string;
  detail: string;
  milestone?: string;
}

const STEPS: Step[] = [
  { key: 'industry', title: 'Choose your industry', detail: 'Loads ready-made intents, ticket categories and WhatsApp templates.' },
  { key: 'business', title: 'Company basics', detail: 'Website, business hours, languages and escalation contact.', milestone: 'M1' },
  { key: 'knowledge', title: 'Upload your knowledge', detail: 'Policy wordings, FAQs, SOPs or your website.', milestone: 'M1' },
  { key: 'customers', title: 'Add customers', detail: 'Upload a CSV or Excel file, or connect your CRM.', milestone: 'M1' },
  { key: 'review', title: 'Review the AI setup', detail: 'Check the persona, answers and rules the AI drafted for you.', milestone: 'M2' },
  { key: 'test', title: 'Test call', detail: 'Talk to your agent in the browser.', milestone: 'M2' },
  { key: 'channels', title: 'Connect channels', detail: 'WhatsApp, phone number and CRM.', milestone: 'M3' },
];

const INDUSTRIES: { value: Industry; label: string; icon: string; hint: string }[] = [
  { value: 'insurance', label: 'Insurance', icon: 'health_and_safety', hint: 'Insurers, brokers, corporate agents' },
  { value: 'lending', label: 'Lending / NBFC', icon: 'account_balance', hint: 'Loans, EMIs, collections' },
  { value: 'broking', label: 'Stock broking', icon: 'monitoring', hint: 'Demat, trading, KYC' },
  { value: 'healthcare', label: 'Healthcare', icon: 'local_hospital', hint: 'Clinics, diagnostics, TPAs' },
  { value: 'other', label: 'Something else', icon: 'category', hint: 'Start from a blank setup' },
];

/** First-run checklist. M0 makes step 1 work end to end; later milestones fill in the rest. */
@Component({
  selector: 'app-setup',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h1>Let's set up {{ auth.activeOrg()?.name }}</h1>
      <p class="muted">Most teams finish in under 30 minutes. You can stop and come back at any time.</p>
    </header>

    <div class="layout">
      <ol class="steps card">
        @for (step of steps; track step.key; let i = $index) {
          <li [class.done]="isDone(i)" [class.current]="step.key === current()">
            <span class="dot">
              @if (isDone(i)) {
                <mat-icon>check</mat-icon>
              } @else {
                {{ i + 1 }}
              }
            </span>
            <div>
              <div class="title">{{ step.title }}</div>
              <div class="detail">{{ step.detail }}</div>
            </div>
            @if (step.milestone) {
              <span class="soon">Coming in {{ step.milestone }}</span>
            }
          </li>
        }
      </ol>

      <section class="card body">
        @if (profile.isLoading()) {
          <p class="muted">Loading…</p>
        } @else if (profile.error()) {
          <p class="error-text">Couldn't load your workspace. Refresh to try again.</p>
        } @else if (current() === 'industry') {
          <h2>Which industry are you in?</h2>
          <p class="muted">We'll preload the right call topics, ticket categories and document types.</p>
          <div class="grid" role="radiogroup" aria-label="Industry">
            @for (option of industries; track option.value) {
              <button
                type="button"
                class="option"
                role="radio"
                [attr.aria-checked]="selected() === option.value"
                [class.selected]="selected() === option.value"
                (click)="selected.set(option.value)"
              >
                <mat-icon>{{ option.icon }}</mat-icon>
                <span class="label">{{ option.label }}</span>
                <span class="hint">{{ option.hint }}</span>
              </button>
            }
          </div>
          @if (error()) {
            <p class="error-text" role="alert">{{ error() }}</p>
          }
          <div class="footer">
            @if (!auth.isAdmin()) {
              <span class="muted">Only an owner or admin can change this.</span>
            }
            <button mat-flat-button (click)="saveIndustry()" [disabled]="!selected() || saving() || !auth.isAdmin()">
              {{ saving() ? 'Saving…' : 'Continue' }}
            </button>
          </div>
        } @else {
          <mat-icon class="big">construction</mat-icon>
          <h2>Next: {{ currentStep()?.title }}</h2>
          <p class="muted">
            Your industry is saved. This step arrives in {{ currentStep()?.milestone }}. Meanwhile you can explore the console from the menu.
          </p>
        }
      </section>
    </div>
  `,
  styles: `
    :host { display: block; padding: 32px; max-width: 1120px; }
    header { margin-bottom: 24px; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
    .layout { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start; }
    .steps { list-style: none; margin: 0; padding: 8px; }
    .steps li { display: grid; grid-template-columns: 28px 1fr; gap: 12px; padding: 12px; border-radius: 8px; position: relative; }
    .steps li.current { background: var(--ai-primary-soft); }
    .dot { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid var(--ai-border); display: grid; place-items: center; font-size: 12px; font-weight: 600; color: var(--ai-muted); background: #fff; }
    .done .dot { background: var(--ai-success); border-color: var(--ai-success); color: #fff; }
    .done .dot mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .current .dot { border-color: var(--ai-primary); color: var(--ai-primary); }
    .title { font-weight: 600; font-size: 14px; color: var(--ai-ink); }
    .detail { font-size: 12.5px; color: var(--ai-muted); margin-top: 2px; line-height: 1.4; }
    .soon { grid-column: 2; justify-self: start; font-size: 11px; color: var(--ai-muted); background: var(--ai-bg); border-radius: 4px; padding: 2px 6px; margin-top: 4px; }
    .body { padding: 28px; min-height: 360px; }
    .body h2 { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin: 20px 0; }
    .option { text-align: left; border: 1.5px solid var(--ai-border); border-radius: 10px; background: #fff; padding: 16px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; font: inherit; color: inherit; }
    .option:hover { border-color: #c5ccd6; }
    .option.selected { border-color: var(--ai-primary); background: var(--ai-primary-soft); }
    .option mat-icon { color: var(--ai-primary); margin-bottom: 6px; }
    .label { font-weight: 600; color: var(--ai-ink); }
    .hint { font-size: 12.5px; color: var(--ai-muted); }
    .footer { display: flex; justify-content: flex-end; align-items: center; gap: 16px; }
    .big { font-size: 40px; width: 40px; height: 40px; color: var(--ai-muted); margin-bottom: 12px; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } :host { padding: 16px; } }
  `,
})
export class Setup {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  protected readonly steps = STEPS;
  protected readonly industries = INDUSTRIES;

  protected readonly profile = resource({ loader: () => this.api.profile() });
  protected readonly selected = signal<Industry | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected current(): string {
    return this.profile.value()?.onboardingStep ?? 'industry';
  }

  protected currentStep(): Step | undefined {
    return STEPS.find((s) => s.key === this.current());
  }

  protected isDone(index: number): boolean {
    return index < STEPS.findIndex((s) => s.key === this.current());
  }

  async saveIndustry(): Promise<void> {
    const industry = this.selected();
    if (!industry) return;
    this.saving.set(true);
    this.error.set('');
    try {
      this.profile.set(await this.api.updateProfile({ industry, onboardingStep: 'business' }));
    } catch {
      this.error.set("Couldn't save. Please try again.");
    } finally {
      this.saving.set(false);
    }
  }
}
