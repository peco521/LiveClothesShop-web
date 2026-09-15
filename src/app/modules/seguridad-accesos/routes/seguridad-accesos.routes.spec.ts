import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RenderMode } from '@angular/ssr';
import { of } from 'rxjs';
import { routes } from '../../../app.routes';
import { serverRoutes } from '../../../app.routes.server';
import { AuthService } from '../services/auth.service';
import { RegistroPage } from '../pages/registro/registro';
import { LoginPage } from '../pages/login/login';
import { AccesoPage } from '../pages/acceso/acceso';
import { RecuperacionPage } from '../pages/recuperacion/recuperacion';
import { RestablecerPage } from '../pages/recuperacion/restablecer';

describe('Rutas de Seguridad y Accesos', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    vi.spyOn(TestBed.inject(AuthService), 'restore').mockReturnValue(of(null));
  });

  it('resuelve registro, login y la confirmación temporal', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/registro', RegistroPage);
    expect(harness.routeNativeElement?.textContent).toContain('Crea tu cuenta');
    await harness.navigateByUrl('/login', LoginPage);
    expect(harness.routeNativeElement?.textContent).toContain('Qué bueno verte');
    await harness.navigateByUrl('/acceso', AccesoPage);
    expect(harness.routeNativeElement?.textContent).toContain('Tu espacio LiveClothesShop');
  });

  it('la raíz y rutas desconocidas llevan al login', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', LoginPage);
    expect(TestBed.inject(Router).url).toBe('/login');
    await harness.navigateByUrl('/desconocida', LoginPage);
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('no prerenderiza estado de sesión', () => {
    expect(serverRoutes).toEqual([{ path: 'admin/**', renderMode: RenderMode.Client },
      { path: 'tienda/**', renderMode: RenderMode.Client }, { path: '**', renderMode: RenderMode.Server }]);
  });

  it('CU04 resuelve ambas páginas sin sesión ni permisos', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/olvide-contrasena', RecuperacionPage);
    expect(harness.routeNativeElement?.textContent).toContain('Olvidé mi contraseña');
    await harness.navigateByUrl('/restablecer-contrasena', RestablecerPage);
    expect(harness.routeNativeElement?.textContent).toContain('Restablecer contraseña');
  });
});
