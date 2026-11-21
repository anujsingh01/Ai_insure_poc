import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { formStyles } from './form-styles';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>Sign in</h2>
    <p class="lead">Welcome back to AI Insure.</p>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-form-field appearance="outline">
        <mat-label>Work email</mat-label>
        <input matInput type="email" formControlName="email" autocomplete="email" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Password</mat-label>
        <input matInput type="password" formControlName="password" autocomplete="current-password" />
      </mat-form-field>
      <div class="row"><a routerLink="/forgot-password">Forgot password?</a></div>
      @if (error()) {
        <p class="error-text" role="alert">{{ error() }}</p>
      }
      <div class="actions">
        <button mat-flat-button type="submit" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
        <div class="divider">or</div>
        <button mat-stroked-button type="button" (click)="google()" [disabled]="busy()">Continue with Google</button>
      </div>
    </form>
    <p class="switch">New to AI Insure? <a routerLink="/signup">Create an account</a></p>
  `,
  styles: formStyles,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.signIn(this.form.getRawValue());
      await this.router.navigateByUrl('/');
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
