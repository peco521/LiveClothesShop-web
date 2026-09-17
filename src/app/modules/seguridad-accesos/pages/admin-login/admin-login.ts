import { afterNextRender, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { FieldError } from '../../components/field-error';
import { normalizedEmail, notBlank } from '../../models/auth.validation';
import { isInternalSession } from '../../models/session-type';
import { authError } from '../../services/auth-error';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  imports: [ReactiveFormsModule, RouterLink, FieldError],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css',
})
export class AdminLoginPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = this.fb.group({
    correo: ['', [notBlank, normalizedEmail, Validators.maxLength(100)]],
    contrasena: ['', [Validators.required, Validators.maxLength(128)]],
  });

  constructor() {
    afterNextRender(() => {
      this.auth.restore().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (session) => {
          if (session && isInternalSession(session) && !this.busy() && this.auth.session() === session) void this.router.navigateByUrl('/admin');
        },
        // A failed restoration must not prevent a fresh login.
        error: () => {},
      });
    });
  }

  submit(): void {
    if (this.busy()) return;
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy.set(true);
    this.auth.login(this.form.getRawValue(), 'admin').pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.busy.set(false); this.form.controls.contrasena.reset(); }),
    ).subscribe({
      next: () => { void this.router.navigateByUrl('/admin'); },
      error: (error: unknown) => this.error.set(authError(error, 'login')),
    });
  }
}
