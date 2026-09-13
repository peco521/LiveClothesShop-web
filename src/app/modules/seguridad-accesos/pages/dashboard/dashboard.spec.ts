import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DashboardPage } from './dashboard';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../models/auth.models';

describe('Dashboard administrativo', () => {
  const session: AuthResponse = { usuario: { idUsuario: '1', nombres: 'Ana', correo: 'ana@example.com' },
    rol: { nro: '1', descripcion: 'SuperAdmin' }, permisos: ['CU05', 'CU08'], expiraEn: '2030-01-01T00:00:00Z' };
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(null) };

  beforeEach(() => {
    auth.restore.mockReset().mockReturnValue(of(null)); auth.session.set(null);
    TestBed.configureTestingModule({ imports: [DashboardPage], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
    ] });
  });

  it('saluda por nombre y confirma la sesión sin datos ficticios', async () => {
    auth.session.set(session); auth.restore.mockReturnValue(of(session));
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(auth.restore).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Hola, Ana');
    expect(fixture.nativeElement.textContent).toContain('Sesión iniciada correctamente');
    expect(fixture.nativeElement.textContent).not.toContain('ventas');
  });

  it('filtra las tarjetas por permisos reales sin comprobar el nombre del rol', async () => {
    auth.session.set(session); auth.restore.mockReturnValue(of(session));
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Usuarios y empleados');
    expect(text).toContain('Bitácora');
    expect(text).not.toContain('Roles y permisos');
    expect(text).not.toContain('Clientes');
    expect(text).not.toContain('Sucursales y ciudades');
    expect(fixture.nativeElement.querySelector('a[href="/admin/usuarios"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/admin/roles"]')).toBeFalsy();
  });

  it('ofrece login cuando no hay sesión', async () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Has iniciado sesión correctamente');
  });
});
