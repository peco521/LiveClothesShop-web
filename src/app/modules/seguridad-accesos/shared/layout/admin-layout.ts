import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { of } from 'rxjs';
import { MiSuscripcion } from '../../models/auth.models';
import { AuthService } from '../../services/auth.service';
import { authError } from '../../services/auth-error';
import { ADMIN_MODULES } from './admin-modules';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly menuOpen = signal(false);
  readonly busy = signal(false);
  readonly logoutError = signal('');
  readonly openModule = signal<string | null>(null);
  private readonly pinnedModule = signal<string | null>(null);
  readonly subscription = signal<MiSuscripcion | null>(null);

  constructor() {
    effect(() => {
      const empresa = this.auth.session()?.empresa;
      if (!this.isBrowser || !empresa || !this.auth.mySubscription) {
        this.subscription.set(null);
        return;
      }
      (this.auth.mySubscription() ?? of(null))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: sub => this.subscription.set(sub),
          error: () => this.subscription.set(null),
        });
    });
  }

  hoverModule(id: string): void {
    if (this.pinnedModule() === null) this.openModule.set(id);
  }

  leaveModule(id: string): void {
    if (this.pinnedModule() === null && this.openModule() === id) this.openModule.set(null);
  }

  toggleModule(id: string): void {
    if (this.pinnedModule() === id) {
      this.closeModule();
    } else {
      this.pinnedModule.set(id);
      this.openModule.set(id);
    }
  }

  closeModule(): void {
    this.pinnedModule.set(null);
    this.openModule.set(null);
  }
  modules() {
    const permissions = this.auth.session()?.permisos ?? [];
    const administrator = this.auth.session()?.usuario.tipo === 'A';
    const sub = this.subscription();
    return ADMIN_MODULES.map(module => ({
      ...module,
      items: module.items.filter(item =>
        permissions.includes(item.permission)
        && (!['CU18','CU19','CU21','CU25'].includes(item.permission) || administrator)
        && (item.permission !== 'CU25' || sub === null || sub.funcionalidades.includes('REPORTES'))
      ),
    })).filter(module => module.items.length);
  }

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
      // AuthService.logout() limpia el estado y redirige a /admin/login.
      // La cookie HttpOnly la gestiona el backend; aquí no se manipula.
      next: () => this.closeMenu(),
      error: (error: unknown) => {
        this.busy.set(false);
        this.logoutError.set(authError(error, 'sesion'));
      },
    });
  }
}
