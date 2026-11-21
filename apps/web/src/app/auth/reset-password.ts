import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { formStyles } from './form-styles';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>Choose a new password</h2>
    @if (done()) {
      <p class="notice">Your password has been changed and you've been signed out everywhere.</p>
      <p class="switch"><a routerLink="/login">Sign in</a></p>
    } @else if (!token()) {
      <p class="notice">This link is incomplete or has expired. <a routerLink="/forgot-password">Request a new one</a>.</p>
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline">
          <mat-label>New password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-hint>At least 10 characters</mat-hint>
        </mat-form-field>
        @if (error()) {
          <p class="error-text" role="alert">{{ error() }}</p>
        }
        <div class="actions">
          <button mat-flat-button type="submit" [disabled]="busy()">Save password</button>
        </div>
      </form>
    }
  `,
  styles: formStyles,
})
export class ResetPassword {
  private readonly auth = inject(AuthService);
  /** From the `?token=` query parameter in the email link. */
  readonly token = input<string>();
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(128)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.resetPassword(this.token()!, this.form.getRawValue().password);
      this.done.set(true);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
