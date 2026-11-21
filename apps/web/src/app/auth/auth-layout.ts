import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Two-panel frame for sign-in, sign-up and first-run screens. */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame">
      <aside class="brand">
        <div class="logo"><span class="mark">AI</span> INSURE</div>
        <div class="pitch">
          <h1>Your AI front office, live in under 30 minutes.</h1>
          <ul>
            <li>Answers customer calls in English, Hindi and Hinglish</li>
            <li>Reads KYC documents sent on WhatsApp</li>
            <li>Follows up until promised documents arrive</li>
          </ul>
        </div>
        <p class="foot">Data stored in India · DPDP-ready · Aadhaar always masked</p>
      </aside>
      <main class="panel">
        <div class="inner"><router-outlet /></div>
      </main>
    </div>
  `,
  styles: `
    .frame { display: grid; grid-template-columns: minmax(320px, 440px) 1fr; min-height: 100vh; }
    .brand { background: var(--ai-ink); color: #c9cfd8; padding: 40px; display: flex; flex-direction: column; justify-content: space-between; }
    .logo { color: #fff; font-weight: 700; letter-spacing: 0.04em; display: flex; align-items: center; gap: 8px; }
    .mark { background: var(--ai-primary); border-radius: 6px; padding: 2px 6px; font-size: 13px; }
    .pitch h1 { color: #fff; font-size: 28px; line-height: 1.25; font-weight: 600; margin-bottom: 20px; }
    .pitch ul { padding-left: 18px; margin: 0; line-height: 1.9; }
    .foot { font-size: 12px; margin: 0; }
    .panel { display: flex; align-items: center; justify-content: center; padding: 32px 16px; background: var(--ai-surface); }
    .inner { width: 100%; max-width: 400px; }
    @media (max-width: 800px) {
      .frame { grid-template-columns: 1fr; }
      .brand { display: none; }
    }
  `,
})
export class AuthLayout {}
