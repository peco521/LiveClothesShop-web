import { signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RenderMode } from '@angular/ssr';
import { of } from 'rxjs';
import { routes } from '../../../../app.routes';
import { serverRoutes } from '../../../../app.routes.server';
import { AuthResponse } from '../../../seguridad-accesos/models/auth.models';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { CatalogoDetallePage } from '../../cu10-consultar-prendas/pages/catalogo-detalle/catalogo-detalle';
import { CatalogoService } from '../../cu10-consultar-prendas/services/catalogo.service';
import { clienteSession, detail } from '../../cu10-consultar-prendas/tests/catalogo.fixtures';
import { CarritoService } from '../../cu12-carrito/services/carrito.service';
import { ShopLayout } from '../../shared/layout/shop-layout';
import { RecomendacionesPage } from '../pages/recomendaciones/recomendaciones';
import { RecomendacionesService } from '../services/recomendaciones.service';
import { personalizada } from './recomendaciones.fixtures';

describe('CU17 ruta, menú de tienda y navegación a CU10', () => {
  let activeHarness: RouterTestingHarness | undefined;
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(clienteSession) };
  const recomendaciones = { listar: vi.fn() };
  const catalogo = { detalle: vi.fn(), listar: vi.fn(), faceta: vi.fn(), detalleVariante: vi.fn() };
  const carrito = { obtener: vi.fn(), agregar: vi.fn(),
    estado: signal({ idCarrito: null, items: [], cantidadItems: 0, subtotal: 0 }) };
  const carritoVacio = { idCarrito: null, items: [], cantidadItems: 0, subtotal: 0 };
  beforeEach(() => {
    activeHarness = undefined;
    auth.restore.mockReset().mockReturnValue(of(clienteSession));
    auth.session.set(clienteSession);
    recomendaciones.listar.mockReset().mockReturnValue(of(personalizada));
    catalogo.detalle.mockReset().mockReturnValue(of(detail));
    carrito.obtener.mockReset().mockReturnValue(of(carritoVacio));
    carrito.agregar.mockReset().mockReturnValue(of(carritoVacio));
    TestBed.configureTestingModule({ providers: [provideRouter(routes),
      { provide: AuthService, useValue: auth },
      { provide: RecomendacionesService, useValue: recomendaciones },
      { provide: CatalogoService, useValue: catalogo },
      { provide: CarritoService, useValue: carrito }] });
  });
  afterEach(() => vi.restoreAllMocks());
  async function open<T>(path: string, type: Type<T>) {
    const harness = activeHarness ??= await RouterTestingHarness.create();
    await harness.navigateByUrl(path, ShopLayout);
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    const page = harness.fixture.debugElement.query(By.directive(type))!.componentInstance as T;
    return { harness, page };
  }
  it('abre /tienda/recomendaciones con la opción visible en el menú de la tienda', async () => {
    const { harness } = await open('/tienda/recomendaciones', RecomendacionesPage);
    const layout = harness.fixture.debugElement.query(By.directive(ShopLayout)).nativeElement as HTMLElement;
    const enlace = layout.querySelector('nav[aria-label="Navegación de la tienda"] a[href="/tienda/recomendaciones"]');
    expect(enlace?.textContent).toContain('Recomendaciones');
    expect(harness.routeNativeElement?.textContent).toContain('Recomendaciones para ti');
    expect(harness.routeNativeElement?.textContent).toContain(personalizada.mensaje);
    expect(recomendaciones.listar).toHaveBeenCalledWith(8);
  });
  it('la tarjeta recomendada abre el detalle de CU10 sin tocar el carrito', async () => {
    const { harness } = await open('/tienda/recomendaciones', RecomendacionesPage);
    const enlace = harness.routeNativeElement?.querySelector('a[href="/tienda/prendas/prod-001"]') as HTMLAnchorElement;
    enlace.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toContain('/tienda/prendas/prod-001');
    expect(carrito.agregar).not.toHaveBeenCalled();
    expect(activeHarness!.fixture.debugElement.query(By.directive(CatalogoDetallePage))).toBeTruthy();
    expect(harness.routeNativeElement?.textContent).toContain('Camisa Oxford');
  });
  it('sin sesión redirige a login', async () => {
    auth.restore.mockReturnValue(of(null));
    auth.session.set(null);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/tienda/recomendaciones', ShopLayout).catch(() => undefined);
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent ?? '').not.toContain('Recomendaciones para ti');
  });
  it('la tienda se renderiza en cliente', () => {
    expect(serverRoutes.find(route => route.path === 'tienda/**')?.renderMode).toBe(RenderMode.Client);
  });
});
