import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLayout } from '../../components/auth-layout';
import { FieldError } from '../../components/field-error';
import { normalizedEmail, notBlank, pastDate } from '../../models/auth.validation';
import { authError } from '../../services/auth-error';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout, FieldError],
  templateUrl: './registro.html',
})
export class RegistroPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal(false);
  readonly form = this.fb.group({
    ci: ['', [notBlank, Validators.maxLength(100)]],
    nombres: ['', [notBlank, Validators.maxLength(100)]],
    apellidoPat: ['', [notBlank, Validators.maxLength(50)]],
    apellidoMat: ['', [notBlank, Validators.maxLength(50)]],
    sexo: ['' as '' | 'M' | 'F', Validators.required],
    correo: ['', [notBlank, normalizedEmail, Validators.maxLength(100)]],
    telefono: ['', [notBlank, Validators.maxLength(20)]],
    direccion: ['', [notBlank, Validators.maxLength(150)]],
    fechaNac: ['', [Validators.required, pastDate]],
    contrasena: ['', [notBlank, Validators.minLength(12), Validators.maxLength(128)]],
  });
  readonly fields = [
    { name: 'ci', label: 'CI', type: 'text', autocomplete: 'off', max: 100 },
    { name: 'nombres', label: 'Nombres', type: 'text', autocomplete: 'given-name', max: 100 },
    { name: 'apellidoPat', label: 'Apellido paterno', type: 'text', autocomplete: 'family-name', max: 50 },
    { name: 'apellidoMat', label: 'Apellido materno', type: 'text', autocomplete: 'off', max: 50 },
    { name: 'correo', label: 'Correo electrónico', type: 'email', autocomplete: 'email', max: 100 },
    { name: 'telefono', label: 'Teléfono', type: 'tel', autocomplete: 'tel', max: 20 },
    { name: 'direccion', label: 'Dirección', type: 'text', autocomplete: 'street-address', max: 150 },
    { name: 'fechaNac', label: 'Fecha de nacimiento', type: 'date', autocomplete: 'bday', max: null },
  ] as const;

  submit(): void {
    if (this.busy() || this.success()) return;
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const input = this.form.getRawValue();
    if (input.sexo !== 'M' && input.sexo !== 'F') return;
    this.busy.set(true);
    this.auth.register({ ...input, sexo: input.sexo }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.busy.set(false); this.form.controls.contrasena.reset(); }),
    ).subscribe({
      next: () => { this.success.set(true); this.form.reset();
        // CU01: el registro ya dejó la sesión iniciada; se entra directo a la tienda.
        void this.router.navigateByUrl('/tienda'); },
      error: (error: unknown) => this.error.set(authError(error, 'registro')),
    });
  }
}
