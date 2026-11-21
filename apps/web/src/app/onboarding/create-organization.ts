import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { formStyles } from '../auth/form-styles';

@Component({
  selector: 'app-create-organization',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>What's your company called?</h2>
    <p class="lead">This creates your workspace. You can invite your team later.</p>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-form-field appearance="outline">
        <mat-label>Company name</mat-label>
        <input matInput formControlName="name" autocomplete="organization" />
      </mat-form-field>
      @if (error()) {
        <p class="error-text" role="alert">{{ error() }}</p>
      }
      <div class="actions">
        <button mat-flat-button type="submit" [disabled]="busy()">{{ busy() ? 'Creating…' : 'Create workspace' }}</button>
      </div>
    </form>
  `,
  styles: formStyles,
})
export class CreateOrganization {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.createOrganization(this.form.getRawValue().name.trim());
      await this.router.navigateByUrl('/setup');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
