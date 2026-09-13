import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { authError } from '../../services/auth-error';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly menuOpen = signal(false);
  readonly busy = signal(false);
  readonly logoutError = signal('');

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  logout(): void {
    if (this.busy()) return;
    this.logoutError.set('');
    this.busy.set(true);
    this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      // AuthService.logout() limpia el estado y redirige a /login.
      // La cookie HttpOnly la gestiona el backend; aquí no se manipula.
      next: () => this.closeMenu(),
      error: (error: unknown) => {
        this.busy.set(false);
        this.logoutError.set(authError(error, 'sesion'));
      },
    });
  }
}
