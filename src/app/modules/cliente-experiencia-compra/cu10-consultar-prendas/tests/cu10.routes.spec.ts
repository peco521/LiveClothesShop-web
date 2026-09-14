import { signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RenderMode } from '@angular/ssr';
import { of } from 'rxjs';
import { routes } from '../../../../app.routes';
import { serverRoutes } from '../../../../app.routes.server';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { AuthResponse } from '../../../seguridad-accesos/models/auth.models';
import { ShopLayout } from '../../shared/layout/shop-layout';
import { CatalogoService } from '../services/catalogo.service';
import { CarritoService } from '../../cu12-carrito/services/carrito.service';
import { CatalogoListaPage } from '../pages/catalogo-lista/catalogo-lista';
import { CatalogoDetallePage } from '../pages/catalogo-detalle/catalogo-detalle';
import { clienteSession, detail, facetas, list } from './catalogo.fixtures';

describe('CU10 páginas y navegación de tienda', () => {
  let activeHarness: RouterTestingHarness | undefined;
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(clienteSession) };
  const service = { listar: vi.fn(), detalle: vi.fn(), faceta: vi.fn() };
  const carrito = { obtener: vi.fn(), agregar: vi.fn(), estado: signal({ idCarrito: null, items: [], cantidadItems: 0, subtotal: 0 }) };
  beforeEach(() => {
    activeHarness = undefined;
    auth.restore.mockReset().mockReturnValue(of(clienteSession)); auth.session.set(clienteSession);
    service.listar.mockReset().mockReturnValue(of(list)); service.detalle.mockReset().mockReturnValue(of(detail));
    service.faceta.mockReset().mockReturnValue(of(facetas));
    carrito.obtener.mockReset().mockReturnValue(of({ idCarrito: null, items: [], cantidadItems: 0, subtotal: 0 }));
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AuthService, useValue: auth }, { provide: CatalogoService, useValue: service }, { provide: CarritoService, useValue: carrito }] });
  });
  afterEach(() => vi.restoreAllMocks());
  async function open<T>(path: string, type: Type<T>) {
    const harness = activeHarness ??= await RouterTestingHarness.create(); await harness.navigateByUrl(path, ShopLayout);
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    const page = harness.fixture.debugElement.query(By.directive(type))!.componentInstance as T;
    return { harness, page };
  }
  it('catálogo con filtros, grid y paginación sin códigos visibles', async () => {
    const { harness, page } = await open('/tienda', CatalogoListaPage);
    expect(service.listar).toHaveBeenCalledWith(expect.objectContaining({ offset: 0, limit: 20 }));
    expect(harness.routeNativeElement?.textContent).toContain('2 prendas encontradas.');
    expect(harness.routeNativeElement?.textContent).toContain('Camisa Oxford');
    expect(harness.routeNativeElement?.querySelector('a[href="/tienda/prendas/prod-001"]')).toBeTruthy();
    page.form.controls.q.setValue('Oxford'); page.aplicar(); await harness.fixture.whenStable();
    expect(service.listar).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Oxford', offset: 0 }));
    page.pagina(20); await harness.fixture.whenStable();
    const url = TestBed.inject(Router).url;
    expect(url).toContain('offset=20');
    for (const forbidden of ['CU10', 'CU11', 'CU12', 'Reservar', 'carrito', 'comprar', 'pagar']) {
      expect(harness.routeNativeElement?.textContent).not.toContain(forbidden);
    }
  });
  it('detalle con variantes y disponibilidad por sucursal', async () => {
    const { harness, page } = await open('/tienda/prendas/prod-001', CatalogoDetallePage);
    expect(service.detalle).toHaveBeenCalledWith('prod-001');
    expect(harness.routeNativeElement?.textContent).toContain('Camisa Oxford');
    expect(harness.routeNativeElement?.textContent).toContain('Talla M');
    expect(harness.routeNativeElement?.textContent).toContain('Central');
    expect(harness.routeNativeElement?.textContent).toContain('La Paz');
    page.elegir('var-002'); harness.detectChanges(); await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).not.toContain('var-001');
    expect(harness.routeNativeElement?.textContent).not.toContain('CU10');
  });
  it('sin sesión redirige a login', async () => {
    auth.restore.mockReturnValue(of(null)); auth.session.set(null);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/tienda', ShopLayout).catch(() => undefined);
    harness.detectChanges(); await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent ?? '').not.toContain('prendas encontradas');
  });
  it('rutas de tienda se renderizan en cliente', () => {
    const tienda = serverRoutes.find(route => route.path === 'tienda/**');
    expect(tienda).toBeTruthy();
    expect(tienda?.renderMode).toBe(RenderMode.Client);
  });
});
