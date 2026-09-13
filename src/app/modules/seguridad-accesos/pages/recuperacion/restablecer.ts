import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLayout } from '../../components/auth-layout';
import { FieldError } from '../../components/field-error';
import { notBlank } from '../../models/auth.validation';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-restablecer',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout, FieldError],
  template: `
    <app-auth-layout title="Restablecer contraseña" description="Elige una contraseña de entre 12 y 128 caracteres.">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate [attr.aria-busy]="busy()">
        <fieldset [disabled]="busy() || !hasToken()">
          <legend class="visually-hidden">Nueva contraseña</legend>
          <div class="field">
            <label for="nueva">Nueva contraseña</label>
            <input id="nueva" type="password" formControlName="nueva" autocomplete="new-password" required minlength="12" maxlength="128" aria-describedby="nueva-error" />
            <app-field-error [control]="form.controls.nueva" errorId="nueva-error" />
          </div>
          <div class="field">
            <label for="confirmacion">Confirmar contraseña</label>
            <input id="confirmacion" type="password" formControlName="confirmacion" autocomplete="new-password" required maxlength="128" />
          </div>
          @if (form.hasError('matching') && form.controls.confirmacion.touched) { <p role="alert">Las contraseñas no coinciden.</p> }
          <button class="button primary" type="submit" [disabled]="busy() || !hasToken()">Restablecer contraseña</button>
        </fieldset>
      </form>
      @if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
      <p class="form-footer"><a routerLink="/olvide-contrasena">Solicitar otro enlace</a></p>
    </app-auth-layout>
  `,
})
export class RestablecerPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private token = '';
  readonly hasToken = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = inject(NonNullableFormBuilder).group({
    nueva: ['', [notBlank, Validators.minLength(12), Validators.maxLength(128)]],
    confirmacion: ['', [Validators.required, Validators.maxLength(128)]],
  }, { validators: (group) => group.get('nueva')?.value === group.get('confirmacion')?.value ? null : { matching: true } });

  constructor() {
    afterNextRender(() => {
      const window = this.document.defaultView;
      if (!window) return;
      const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
      window.history.replaceState(window.history.state, '', window.location.pathname);
      if (/^[A-Za-z0-9_-]{43}$/.test(token)) { this.token = token; this.hasToken.set(true); }
      else this.error.set('El enlace no es válido o ha expirado. Solicita otro enlace.');
    });
    this.destroyRef.onDestroy(() => { this.token = ''; this.form.reset(); });
  }

  submit(): void {
    if (this.busy() || !this.hasToken()) return;
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy.set(true);
    this.auth.resetPassword(this.token, this.form.getRawValue().nueva).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.busy.set(false); this.form.reset(); }),
    ).subscribe({
      next: () => { this.token = ''; this.hasToken.set(false); void this.router.navigateByUrl('/login'); },
      error: (error: { status?: number }) => {
        if (error.status === 400) {
          this.token = ''; this.hasToken.set(false);
          this.error.set('El enlace no es válido o ha expirado. Solicita otro enlace.');
        } else this.error.set('No se pudo restablecer la contraseña. Inténtalo de nuevo.');
      },
    });
  }
}
