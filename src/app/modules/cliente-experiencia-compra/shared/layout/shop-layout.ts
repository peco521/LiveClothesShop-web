import { afterNextRender, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { authError } from '../../../seguridad-accesos/services/auth-error';
import { CarritoService } from '../../cu12-carrito/services/carrito.service';
import { PwaSyncService } from '../../../../core/offline/pwa-sync.service';

@Component({
  selector: 'app-shop-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shop-layout.html',
  styleUrl: './shop-layout.css',
})
export class ShopLayout {
  readonly auth = inject(AuthService);
  readonly sessionViews = computed(() => {
    const value = this.auth.session();
    return value ? [JSON.stringify([value.empresa, value.usuario.idUsuario, value.expiraEn])] : [];
  });
  readonly carrito = inject(CarritoService);
  readonly sync = inject(PwaSyncService);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly logoutError = signal('');

  constructor() {
    // Contador real del carrito: se refresca al entrar a la tienda (solo navegador).
    afterNextRender(() => this.carrito.obtener().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      // CU10 must remain usable while CU12 is intentionally closed in SaaS.
      // Do not open cart routes or retain an earlier count after a failed read.
      error: () => this.carrito.estado.set(null),
    }));
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
