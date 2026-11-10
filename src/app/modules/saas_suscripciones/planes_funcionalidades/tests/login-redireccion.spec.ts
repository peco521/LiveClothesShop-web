import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { SaasLoginPage } from '../pages/login';

describe('Acceso a la plataforma SaaS', () => {
  it.each([
    [['SAAS-PLANES'], '/saas'],
    [['SAAS-EMPRESAS'], '/saas'],
  ])('abre el resumen de plataforma después de iniciar sesión', (permisos, destino) => {
    const login = vi.fn().mockReturnValue(of({ plataforma: true, usuario: { tipo: 'S' }, permisos }));
    TestBed.configureTestingModule({providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { login, restore: () => of(null) } },
    ]});
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const page = TestBed.createComponent(SaasLoginPage).componentInstance;
    page.correo = 'test@example.com';
    page.contrasena = 'test-password';
    page.submit();
    expect(login).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledWith(destino);
  });
});
