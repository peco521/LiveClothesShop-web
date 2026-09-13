import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccesoPage } from './acceso';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../models/auth.models';

describe('Confirmación temporal de acceso', () => {
  const session: AuthResponse = { usuario: { idUsuario: '1', nombres: 'Ana', correo: 'ana@example.com' },
    rol: { nro: 'cliente', descripcion: 'Cliente' }, permisos: [], expiraEn: '2030-01-01T00:00:00Z' };
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(null) };

  beforeEach(() => {
    auth.restore.mockReset().mockReturnValue(of(null)); auth.session.set(null);
    TestBed.configureTestingModule({ imports: [AccesoPage], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
    ] });
  });

  it('verifica la sesión y muestra solo información pública', async () => {
    auth.session.set(session); auth.restore.mockReturnValue(of(session));
    const fixture = TestBed.createComponent(AccesoPage);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(auth.restore).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Hola, Ana');
    expect(fixture.nativeElement.textContent).toContain('ana@example.com');
    expect(fixture.nativeElement.textContent).not.toContain('cliente');
  });

  it('ofrece login cuando no hay sesión', async () => {
    const fixture = TestBed.createComponent(AccesoPage);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Has iniciado sesión correctamente');
  });

  it('permite reintentar después de un error sin asumir autenticación', async () => {
    auth.restore.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const fixture = TestBed.createComponent(AccesoPage);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    auth.restore.mockReturnValue(of(null));
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBe('');
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).toBeTruthy();
  });
});
