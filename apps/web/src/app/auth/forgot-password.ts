import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { formStyles } from './form-styles';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>Reset your password</h2>
    @if (sent()) {
      <!-- Same message whether or not the account exists, so this page can't be used to find accounts. -->
      <p class="notice">If an account exists for that email, a reset link is on its way.</p>
    } @else {
      <p class="lead">We'll email you a link to set a new password.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline">
          <mat-label>Work email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
        </mat-form-field>
        <div class="actions">
          <button mat-flat-button type="submit" [disabled]="busy()">Send reset link</button>
        </div>
      </form>
    }
    <p class="switch"><a routerLink="/login">Back to sign in</a></p>
  `,
  styles: formStyles,
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({ email: ['', [Validators.required, Validators.email]] });

  async submit(): Promise<void> {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.busy.set(true);
    try {
      await this.auth.requestPasswordReset(this.form.getRawValue().email);
    } catch {
      // Deliberately ignored: the response must not reveal whether the email is registered.
    } finally {
      this.busy.set(false);
      this.sent.set(true);
    }
  }
}
