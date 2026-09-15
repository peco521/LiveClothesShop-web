import { signal, Type } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { routes } from '../../../../app.routes';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { AuthResponse } from '../../../seguridad-accesos/models/auth.models';
import { ShopLayout } from '../../shared/layout/shop-layout';
import { CatalogoService } from '../../cu10-consultar-prendas/services/catalogo.service';
import { CarritoService } from '../services/carrito.service';
import { CarritoPage } from '../pages/carrito/carrito';
import { CatalogoDetallePage } from '../../cu10-consultar-prendas/pages/catalogo-detalle/catalogo-detalle';
import { clienteSession, detail, facetas, list as catalogo } from '../../cu10-consultar-prendas/tests/catalogo.fixtures';
import { carrito, vacio } from './carrito.fixtures';

describe('CU12 carrito, integración con detalle y contador real', () => {
  let activeHarness: RouterTestingHarness | undefined;
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(clienteSession) };
  const catalogoService = { listar: vi.fn(), detalle: vi.fn(), faceta: vi.fn() };
  const service = { obtener: vi.fn(), agregar: vi.fn(), modificar: vi.fn(), eliminar: vi.fn(), estado: signal(carrito) };
  beforeEach(() => {
    activeHarness = undefined;
    auth.restore.mockReset().mockReturnValue(of(clienteSession)); auth.session.set(clienteSession);
    catalogoService.listar.mockReset().mockReturnValue(of(catalogo)); catalogoService.detalle.mockReset().mockReturnValue(of(detail));
    catalogoService.faceta.mockReset().mockReturnValue(of(facetas));
    service.obtener.mockReset().mockReturnValue(of(carrito));
    service.agregar.mockReset().mockReturnValue(of(carrito));
    service.modificar.mockReset().mockReturnValue(of(carrito));
    service.eliminar.mockReset().mockReturnValue(of(vacio));
    service.estado.set(carrito);
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AuthService, useValue: auth },
      { provide: CatalogoService, useValue: catalogoService }, { provide: CarritoService, useValue: service }] });
  });
  afterEach(() => vi.restoreAllMocks());
  async function open<T>(path: string, type: Type<T>) {
    const harness = activeHarness ??= await RouterTestingHarness.create(); await harness.navigateByUrl(path, ShopLayout);
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    const page = harness.fixture.debugElement.query(By.directive(type))!.componentInstance as T;
    return { harness, page };
  }
  const texto = (harness: { routeNativeElement?: Element | null }) => harness.routeNativeElement?.textContent ?? '';
  it('carrito con items, subtotales y sin checkout ni códigos', async () => {
    const { harness } = await open('/tienda/carrito', CarritoPage);
    expect(service.obtener).toHaveBeenCalled();
    expect(texto(harness)).toContain('Camisa Oxford');
    expect(texto(harness)).toContain('Subtotal: 350');
    expect(texto(harness)).toContain('Carrito (3)');
    for (const forbidden of ['CU12', 'CU10', 'CU11', 'CU13', 'comprar', 'pagar', 'Pagar']) {
      expect(texto(harness)).not.toContain(forbidden);
    }
  });
  it('vacío funcional', async () => {
    service.obtener.mockReturnValueOnce(of(vacio));
    const { harness } = await open('/tienda/carrito', CarritoPage);
    expect(texto(harness)).toContain('No tienes productos en tu carrito.');
    expect(texto(harness)).toContain('Explorar el catálogo');
  });
  it('error inicial con reintento', async () => {
    service.obtener.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { harness, page } = await open('/tienda/carrito', CarritoPage);
    expect(texto(harness)).toContain('Reintentar');
    service.obtener.mockReturnValueOnce(of(carrito));
    const boton = [...(harness.routeNativeElement?.querySelectorAll('button') ?? [])]
      .find(b => b.textContent?.trim() === 'Reintentar');
    expect(boton).toBeTruthy();
    boton!.click(); harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    expect(texto(harness)).toContain('Camisa Oxford');
  });
  it('actualiza cantidad y elimina con el servidor', async () => {
    const { harness, page } = await open('/tienda/carrito', CarritoPage);
    page.cambiar({ idDetalleCarro: 1 }, 3); await harness.fixture.whenStable();
    expect(service.modificar).toHaveBeenCalledWith(1, 3);
    page.cambiar({ idDetalleCarro: 1 }, 0); await harness.fixture.whenStable();
    expect(service.modificar).toHaveBeenCalledTimes(1);
    page.quitar(2); await harness.fixture.whenStable();
    expect(service.eliminar).toHaveBeenCalledWith(2);
  });
  it('agrega desde el detalle con cantidad y muestra feedback', async () => {
    const { harness, page } = await open('/tienda/prendas/prod-001', CatalogoDetallePage);
    page.elegir('var-001'); page.cantidad.set(2); harness.detectChanges(); await harness.fixture.whenStable();
    page.agregar(); await harness.fixture.whenStable(); harness.detectChanges();
    expect(service.agregar).toHaveBeenCalledWith({ idVar: 'var-001', cantidad: 2 });
    expect(texto(harness)).toContain('Prenda agregada al carrito.');
    expect(harness.routeNativeElement?.querySelector('a[href="/tienda/carrito"]')).toBeTruthy();
    service.agregar.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409,
      error: { error: { code: 'disponibilidad_insuficiente' } } })));
    page.agregar(); await harness.fixture.whenStable(); harness.detectChanges();
    expect(texto(harness)).toContain('No hay disponibilidad suficiente');
  });
});
