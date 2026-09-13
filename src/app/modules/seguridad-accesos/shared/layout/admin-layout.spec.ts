import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminLayout } from './admin-layout';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../models/auth.models';

describe('AdminLayout', () => {
  const session: AuthResponse = { usuario: { idUsuario: '1', nombres: 'Ana', correo: 'ana@example.com' },
    rol: { nro: '1', descripcion: 'SuperAdmin' }, permisos: ['CU05', 'CU09'], expiraEn: '2030-01-01T00:00:00Z' };
  const auth = { logout: vi.fn(), session: signal<AuthResponse | null>(null) };

  beforeEach(() => {
    auth.logout.mockReset().mockReturnValue(of(undefined)); auth.session.set(session);
    TestBed.configureTestingModule({ imports: [AdminLayout], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
    ] });
  });

  it('muestra solo las opciones con permiso real, sin bypass por rol', async () => {
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const nav: string = fixture.nativeElement.querySelector('.side-nav').textContent;
    expect(nav).toContain('Usuarios y empleados');
    expect(nav).toContain('Sucursales y ciudades');
    expect(nav).not.toContain('Roles y permisos');
    expect(nav).not.toContain('Bitácora');
    expect(fixture.nativeElement.querySelector('a[href="/admin/usuarios"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/admin/roles"]')).toBeFalsy();
  });

  it('cierra sesión con AuthService.logout sin manipular la cookie', () => {
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.side-footer .button').click();
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(document.cookie).not.toContain('session');
  });

  it('permite colapsar el menú en pantallas pequeñas', () => {
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    expect(fixture.componentInstance.menuOpen()).toBe(false);
    fixture.nativeElement.querySelector('.menu-button').click();
    expect(fixture.componentInstance.menuOpen()).toBe(true);
  });
});
