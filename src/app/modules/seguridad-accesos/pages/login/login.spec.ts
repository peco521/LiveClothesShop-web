import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { LoginPage } from './login';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../models/auth.models';

describe('CU02 LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let page: LoginPage;
  const session: AuthResponse = { usuario: { idUsuario: '1', nombres: 'Ana', correo: 'ana@example.com' },
    rol: { nro: 'cliente', descripcion: 'Cliente' }, permisos: [], expiraEn: '2030-01-01T00:00:00Z' };
  const auth = { login: vi.fn(), restore: vi.fn(), session: signal<AuthResponse | null>(null) };
  const data = { correo: 'ana@example.com', contrasena: 'Frase de prueba 12345' };

  beforeEach(async () => {
    auth.login.mockReset(); auth.restore.mockReset().mockReturnValue(of(null)); auth.session.set(null);
    await TestBed.configureTestingModule({ imports: [LoginPage], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
    ] }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('formulario inicialmente inválido', () => {
    expect(page.form.invalid).toBe(true);
    page.submit();
    expect(auth.login).not.toHaveBeenCalled();
    expect(page.form.controls.correo.touched).toBe(true);
    expect(page.form.controls.contrasena.touched).toBe(true);
  });

  it('incluye enlace de recuperación CU04', () => {
    expect(fixture.nativeElement.querySelector('a[href="/olvide-contrasena"]').textContent).toContain('¿Olvidaste tu contraseña?');
  });

  it('envía payload correcto y navega tras login exitoso', () => {
    auth.login.mockReturnValue(of(session));
    page.form.setValue(data);
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(auth.login).toHaveBeenCalledWith(data);
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/admin');
    expect(page.form.controls.contrasena.value).toBe('');
  });

  it.each([401, 503, 0])('maneja error %s sin navegar', status => {
    auth.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status, error: 'no mostrar' })));
    page.form.setValue(data);
    page.submit();
    expect(page.error()).toContain(status === 401 ? 'Revisa tu correo' : status === 0 ? 'conectar' : 'no está disponible');
    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();
    expect(page.form.controls.contrasena.value).toBe('');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).not.toContain('no mostrar');
  });

  it('no aplica política de registro a una contraseña de login corta', () => {
    page.form.setValue({ correo: data.correo, contrasena: 'abc' });
    expect(page.form.valid).toBe(true);
  });

  it('impide el doble envío', () => {
    const pending = new Subject<AuthResponse>();
    auth.login.mockReturnValue(pending);
    page.form.setValue(data); page.submit(); page.submit();
    expect(auth.login).toHaveBeenCalledOnce();
    fixture.destroy();
    expect(pending.observed).toBe(false);
  });
});
