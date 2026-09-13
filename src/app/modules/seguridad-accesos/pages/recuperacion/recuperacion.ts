import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLayout } from '../../components/auth-layout';
import { FieldError } from '../../components/field-error';
import { normalizedEmail, notBlank } from '../../models/auth.validation';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-recuperacion',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout, FieldError],
  template: `
    <app-auth-layout title="Olvidé mi contraseña" description="Solicita instrucciones para recuperar tu acceso.">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate [attr.aria-busy]="busy()">
        <fieldset [disabled]="busy()">
          <legend class="visually-hidden">Recuperación de contraseña</legend>
          <div class="field">
            <label for="correo">Correo electrónico</label>
            <input id="correo" type="email" formControlName="correo" autocomplete="email" required maxlength="100" aria-describedby="correo-error" />
            <app-field-error [control]="form.controls.correo" errorId="correo-error" />
          </div>
          <button class="button primary" type="submit" [disabled]="busy()">Solicitar recuperación</button>
        </fieldset>
      </form>
      @if (message()) { <p class="notice" role="status">{{ message() }}</p> }
      @if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
      <p class="form-footer"><a routerLink="/login">Volver a iniciar sesión</a></p>
    </app-auth-layout>
  `,
})
export class RecuperacionPage {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly form = inject(NonNullableFormBuilder).group({
    correo: ['', [notBlank, normalizedEmail, Validators.maxLength(100)]],
  });

  submit(): void {
    if (this.busy()) return;
    this.message.set(''); this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy.set(true);
    this.auth.requestRecovery(this.form.getRawValue().correo).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)),
    ).subscribe({
      next: () => this.message.set('Si la cuenta puede recuperarse, recibirás instrucciones para restablecer tu contraseña.'),
      error: () => this.error.set('La recuperación no está disponible en este momento. Inténtalo más tarde.'),
    });
  }
}
