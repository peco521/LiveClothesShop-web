import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminLoginPage } from './admin-login';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../models/auth.models';

describe('Acceso administrativo separado', () => {
  const session: AuthResponse = {
    usuario: { idUsuario: 'ADM-002', tipo: 'A', nombres: 'Austin', correo: 'admin@example.com' },
    rol: { nro: 'A', descripcion: 'Administrador' }, permisos: ['CU05'], expiraEn: '2030-01-01T00:00:00Z',
  };
  const auth = { login: vi.fn(), restore: vi.fn(), session: signal<AuthResponse | null>(null) };

  beforeEach(async () => {
    auth.login.mockReset(); auth.restore.mockReset().mockReturnValue(of(null)); auth.session.set(null);
    await TestBed.configureTestingModule({ imports: [AdminLoginPage], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
    ] }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  it('usa el endpoint interno y entra al panel', () => {
    auth.login.mockReturnValue(of(session));
    const fixture = TestBed.createComponent(AdminLoginPage); fixture.detectChanges();
    const data = { correo: 'admin@example.com', contrasena: 'Anterior123*' };
    fixture.componentInstance.form.setValue(data);
    fixture.componentInstance.submit();
    expect(auth.login).toHaveBeenCalledWith(data, 'admin');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/admin');
    expect(fixture.componentInstance.form.controls.contrasena.value).toBe('');
  });

  it('no ofrece registro público de administradores', () => {
    const fixture = TestBed.createComponent(AdminLoginPage); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/registro"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('ADMINISTRADORES Y EMPLEADOS');
  });

  it('no navega ante credenciales rechazadas', () => {
    auth.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const fixture = TestBed.createComponent(AdminLoginPage); fixture.detectChanges();
    fixture.componentInstance.form.setValue({ correo: 'admin@example.com', contrasena: 'incorrecta' });
    fixture.componentInstance.submit();
    expect(fixture.componentInstance.error()).toContain('Revisa tu correo');
    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();
  });
});
