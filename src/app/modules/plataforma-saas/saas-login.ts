import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../seguridad-accesos/services/auth.service';

@Component({
  selector: 'app-saas-login',
  imports: [ReactiveFormsModule],
  template: `<main class="saas-login"><h1>Administración de plataforma</h1>
    <p>Acceso separado para el administrador SaaS de FashionStore.</p>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label>Correo <input type="email" formControlName="correo" autocomplete="username" required /></label>
      <label>Contraseña <input type="password" formControlName="contrasena" autocomplete="current-password" required /></label>
      @if (error()) { <p role="alert">{{ error() }}</p> }
      <button type="submit" [disabled]="busy()">{{ busy() ? 'Verificando…' : 'Iniciar sesión SaaS' }}</button>
    </form></main>`,
  styles: [`.saas-login{max-width:32rem;margin:8vh auto;padding:2rem;border:1px solid #ddd;border-radius:1rem;font:1rem system-ui}form,label{display:grid;gap:.75rem}label{margin:1rem 0}input,button{padding:.75rem;font:inherit}`],
})
export class SaasLoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = this.fb.group({ correo: ['', [Validators.required, Validators.email]], contrasena: ['', Validators.required] });

  submit(): void {
    if (this.busy() || this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy.set(true); this.error.set('');
    this.auth.login(this.form.getRawValue(), 'saas').pipe(finalize(() => this.busy.set(false))).subscribe({
      next: identity => identity.plataforma ? void this.router.navigateByUrl('/saas') : this.error.set('La cuenta no es de plataforma.'),
      error: () => this.error.set('No se pudo validar el acceso de plataforma.'),
    });
  }
}
