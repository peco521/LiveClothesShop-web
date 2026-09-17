import { afterNextRender, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLayout } from '../../components/auth-layout';
import { authError } from '../../services/auth-error';
import { isClienteSession } from '../../models/session-type';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-acceso',
  imports: [AuthLayout, RouterLink],
  template: `
    <app-auth-layout title="Tu espacio LiveClothesShop" description="Una confirmación de tu acceso, sin pasos adicionales.">
      @if (motivo === 'sin-permiso') { <p class="notice error" role="alert">No tienes el permiso requerido para acceder a esta sección.</p> }
      @if (motivo === 'verificacion') { <p class="notice error" role="alert">No se pudo verificar el acceso. Vuelve a comprobar tu sesión.</p> }
      @if (checking()) {
        <p class="notice" role="status">Verificando tu sesión…</p>
      } @else if (error()) {
        <p class="notice error" role="alert">{{ error() }}</p>
        <button class="button primary" (click)="verify()">Volver a verificar</button>
        <p class="form-footer"><a routerLink="/login">Ir a iniciar sesión</a></p>
      } @else if (auth.session(); as session) {
        <div class="notice success" role="status">
          <h2>Hola, {{ session.usuario.nombres || 'bienvenido/a' }}</h2>
          <p>Has iniciado sesión correctamente.</p>
          <p class="user-email">{{ session.usuario.correo }}</p>
        </div>
        <p class="privacy-note">Tu cuenta está lista. Esta es la confirmación de acceso de la versión actual de la tienda.</p>
        @if (isCliente(session)) {
          <a class="button primary" routerLink="/tienda">Ir a la tienda</a>
        } @else {
          <a class="button primary" routerLink="/admin">Ir al panel administrativo</a>
        }
      } @else {
        <p class="notice" role="status">Inicia sesión para acceder a tu cuenta.</p>
        <a class="button primary" routerLink="/login">Iniciar sesión</a>
      }
    </app-auth-layout>
  `,
})
export class AccesoPage {
  readonly isCliente = isClienteSession;
  readonly motivo = inject(ActivatedRoute).snapshot.queryParamMap.get('motivo');
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly checking = signal(true);
  readonly error = signal('');

  constructor() { afterNextRender(() => this.verify()); }

  verify(): void {
    this.checking.set(true);
    this.error.set('');
    this.auth.restore().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.checking.set(false)))
      .subscribe({ error: (error: unknown) => this.error.set(authError(error, 'sesion')) });
  }
}
