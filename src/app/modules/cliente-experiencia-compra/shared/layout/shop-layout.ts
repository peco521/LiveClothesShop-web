import { afterNextRender, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { authError } from '../../../seguridad-accesos/services/auth-error';
import { CarritoService } from '../../cu12-carrito/services/carrito.service';

@Component({
  selector: 'app-shop-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shop-layout.html',
  styleUrl: './shop-layout.css',
})
export class ShopLayout {
  readonly auth = inject(AuthService);
  readonly carrito = inject(CarritoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly logoutError = signal('');

  constructor() {
    // Contador real del carrito: se refresca al entrar a la tienda (solo navegador).
    afterNextRender(() => this.carrito.obtener().pipe(takeUntilDestroyed(this.destroyRef)).subscribe());
  }

  logout(): void {
    if (this.busy()) return;
    this.logoutError.set('');
    this.busy.set(true);
    this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      // AuthService.logout() limpia el estado y redirige a /login.
      // La cookie HttpOnly la gestiona el backend; aquí no se manipula.
      error: (error: unknown) => {
        this.busy.set(false);
        this.logoutError.set(authError(error, 'sesion'));
      },
    });
  }
}
