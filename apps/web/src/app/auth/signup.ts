import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { formStyles } from './form-styles';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sentTo()) {
      <h2>Check your email</h2>
      <p class="notice">
        We've sent a confirmation link to <strong>{{ sentTo() }}</strong>. Open it to continue setting up your workspace.
      </p>
      <p class="switch">Wrong address? <a href="" (click)="sentTo.set(''); $event.preventDefault()">Start again</a></p>
    } @else {
      <h2>Start free</h2>
      <p class="lead">Set up your AI agent in minutes. No card needed.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline">
          <mat-label>Your name</mat-label>
          <input matInput formControlName="name" autocomplete="name" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Work email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-hint>At least 10 characters</mat-hint>
        </mat-form-field>
        @if (error()) {
          <p class="error-text" role="alert">{{ error() }}</p>
        }
        <div class="actions">
          <button mat-flat-button type="submit" [disabled]="busy()">{{ busy() ? 'Creating account…' : 'Create account' }}</button>
          <div class="divider">or</div>
          <button mat-stroked-button type="button" (click)="google()" [disabled]="busy()">Continue with Google</button>
        </div>
      </form>
      <p class="switch">Already have an account? <a routerLink="/login">Sign in</a></p>
    }
  `,
  styles: formStyles,
})
export class Signup {
  private readonly auth = inject(AuthService);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly sentTo = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(128)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.busy.set(true);
    this.error.set('');
    try {
      const value = this.form.getRawValue();
      await this.auth.signUp(value);
      this.sentTo.set(value.email);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  async google(): Promise<void> {
    try {
      await this.auth.signInWithGoogle();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
}
