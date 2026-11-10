import { afterNextRender, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { authError } from '../../../seguridad-accesos/services/auth-error';

@Component({
  selector: 'app-saas-login',
  imports: [FormsModule, RouterLink],
  template: `
    <main class="login-shell">
      <section class="login-card" aria-labelledby="login-title">
        <p class="eyebrow">FASHIONSTORE · PLATAFORMA</p>
        <h1 id="login-title">Administración SaaS</h1>
        <p>Accede para gestionar los planes de la plataforma.</p>
        <form (ngSubmit)="submit()">
          <label for="saas-email">Correo electrónico</label>
          <input id="saas-email" name="correo" type="email" [(ngModel)]="correo" required maxlength="100" autocomplete="username">
          <label for="saas-password">Contraseña</label>
          <input id="saas-password" name="contrasena" type="password" [(ngModel)]="contrasena" required maxlength="128" autocomplete="current-password">
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          <button type="submit" [disabled]="busy()">{{ busy() ? 'Ingresando…' : 'Ingresar' }}</button>
        </form>
        <a routerLink="/admin/login">Acceso de empresas</a>
      </section>
    </main>
  `,
  styles: [`
    .login-shell{min-height:80vh;display:grid;place-items:center;padding:28px;background:#f4f5ef;color:#20291f}
    .login-card{width:min(100%,440px);box-sizing:border-box;background:#fff;border:1px solid #d9e1d5;border-radius:20px;padding:36px;box-shadow:0 18px 50px #233d2014}
    .eyebrow{color:#55754e;font-size:.72rem;font-weight:700;letter-spacing:.14em}h1{font-size:2rem;margin:14px 0}p{line-height:1.55;color:#5a6858}form{display:grid;gap:10px;margin:28px 0}label{font-weight:600;font-size:.9rem}input{border:1px solid #bfcdbb;border-radius:8px;padding:12px;font:inherit;margin-bottom:10px}button{border:0;border-radius:8px;background:#263f2c;color:white;padding:13px;font:inherit;cursor:pointer}button:disabled{opacity:.6}.error{color:#9c2e25}a{color:#315d38}
  `],
})
export class SaasLoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly error = signal('');
  correo = '';
  contrasena = '';

  constructor() {
    afterNextRender(() => this.auth.restore().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: session => { if (!this.busy() && this.auth.session() === session && session?.usuario.tipo === 'S' && session.plataforma) void this.router.navigateByUrl('/saas'); },
      error: () => {},
    }));
  }

  submit(): void {
    if (this.busy() || !this.correo.trim() || !this.contrasena) return;
    this.busy.set(true);
    this.error.set('');
    this.auth.login({ correo: this.correo, contrasena: this.contrasena }, 'saas')
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { this.busy.set(false); this.contrasena = ''; }))
      .subscribe({ next: () => void this.router.navigateByUrl('/saas'),
        error: (error: unknown) => this.error.set(authError(error, 'login')) });
  }
}
