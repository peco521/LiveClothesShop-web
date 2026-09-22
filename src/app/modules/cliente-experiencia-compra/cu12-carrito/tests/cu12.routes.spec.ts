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
  it('carrito con lista visual, resumen y acceso directo al pago', async () => {
    const { harness } = await open('/tienda/carrito', CarritoPage);
    expect(service.obtener).toHaveBeenCalled();
    expect(texto(harness)).toContain('Camisa Oxford');
    expect(texto(harness)).toContain('Total estimado');
    expect(harness.routeNativeElement?.querySelector('a.cart-icon svg')).toBeTruthy();
    expect(texto(harness)).toContain('Carrito (3)');
    expect(harness.routeNativeElement?.querySelectorAll('.cart-product').length).toBe(carrito.items.length);
    expect(harness.routeNativeElement?.querySelector('.cart-summary')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('a.checkout-button')?.textContent).toContain('Ir a pagar');
    for (const forbidden of ['CU12', 'CU10', 'CU11', 'CU13']) {
      expect(texto(harness)).not.toContain(forbidden);
    }
  });
  it('bajar de una unidad retira solo esa polera cuando existen otros productos', async () => {
    const {page}=await open('/tienda/carrito',CarritoPage);
    page.cambiar({idDetalleCarro:2},0);
    expect(service.eliminar).toHaveBeenCalledWith(2);
    expect(service.modificar).not.toHaveBeenCalled();
    expect(page.retirarUltimo()).toBeNull();
  });
  it('el último producto pide confirmación, permite volver y nunca envía cantidad cero', async () => {
    service.obtener.mockReturnValue(of({...carrito,items:[carrito.items[1]],cantidadItems:1,subtotal:150}));
    const {harness,page}=await open('/tienda/carrito',CarritoPage);
    const minus=harness.routeNativeElement!.querySelector('button[aria-label="Disminuir cantidad de Camisa Oxford"]') as HTMLButtonElement;
    const campo=harness.routeNativeElement!.querySelector('input[type="number"]') as HTMLInputElement;
    campo.value='0';campo.dispatchEvent(new Event('input'));campo.dispatchEvent(new Event('change'));harness.detectChanges();
    expect(campo.value).toBe('1');expect(page.retirarUltimo()).toBe(2);page.cerrarConfirmacion();
    expect(minus.disabled).toBe(false);minus.click();harness.detectChanges();
    expect(page.retirarUltimo()).toBe(2);expect(service.eliminar).not.toHaveBeenCalled();
    page.cerrarConfirmacion();expect(page.carrito()!.items.length).toBe(1);
    minus.click();page.confirmarRetiro();harness.detectChanges();
    expect(service.eliminar).toHaveBeenCalledWith(2);expect(service.modificar).not.toHaveBeenCalled();
    expect(page.carrito()!.items.length).toBe(0);expect(page.retirarUltimo()).toBeNull();
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
    page.cambiar({ idDetalleCarro: 1 }, -1); await harness.fixture.whenStable();
    expect(service.modificar).toHaveBeenCalledTimes(1);
    page.quitar(2); await harness.fixture.whenStable();
    expect(service.eliminar).toHaveBeenCalledWith(2);
  });
  it('los botones incrementan y disminuyen unidades, y Cancelar retira el producto', async () => {
    service.modificar.mockImplementation((id: number, cantidad: number) => of({...carrito,
      items: carrito.items.map(item => item.idDetalleCarro===id?{...item,cantidad,subtotal:+item.precio*cantidad}:item)}));
    const {harness}=await open('/tienda/carrito',CarritoPage);
    const find=(label:string)=>harness.routeNativeElement!.querySelector('button[aria-label="'+label+'"]') as HTMLButtonElement;
    find('Aumentar cantidad de Camisa Oxford').click();harness.detectChanges();await harness.fixture.whenStable();
    expect(service.modificar).toHaveBeenLastCalledWith(1,3);
    find('Disminuir cantidad de Camisa Oxford').click();harness.detectChanges();await harness.fixture.whenStable();
    expect(service.modificar).toHaveBeenLastCalledWith(1,2);
    const cancel=harness.routeNativeElement!.querySelector('.remove-item') as HTMLButtonElement;
    expect(cancel.textContent).toContain('Cancelar');cancel.click();expect(service.eliminar).toHaveBeenCalledWith(1);
  });
  it('conserva el aviso al rechazar una cantidad por stock o por compra pendiente', async () => {
    service.modificar.mockReturnValue(throwError(()=>new HttpErrorResponse({status:409,error:{error:{code:'disponibilidad_insuficiente'}}})));
    const {harness,page}=await open('/tienda/carrito',CarritoPage);
    const readsBefore=service.obtener.mock.calls.length;
    page.cambiar({idDetalleCarro:1},3);harness.detectChanges();await harness.fixture.whenStable();
    expect(texto(harness)).toContain('No hay disponibilidad suficiente');expect(page.busy()).toBe(false);
    expect(page.cantidades[1]).toBe(2);expect(service.obtener).toHaveBeenCalledTimes(readsBefore);
    service.modificar.mockReturnValue(throwError(()=>new HttpErrorResponse({status:409,error:{error:{code:'compra_pendiente'}}})));
    page.cambiar({idDetalleCarro:1},1);harness.detectChanges();await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelector('a[href="/tienda/finalizar-compra"]')?.textContent).toContain('Revisar el pago');
    expect(page.error()).toContain('Cancela la compra pendiente');
  });
  it('rechaza valores fuera del stock de la variante, no del número de variantes', async () => {
    const {harness,page}=await open('/tienda/carrito',CarritoPage);
    page.cambiar({idDetalleCarro:1},4);expect(service.modificar).toHaveBeenCalledWith(1,4);
    page.cambiar({idDetalleCarro:1},5);expect(service.modificar).toHaveBeenCalledTimes(1);
    expect(page.error()).toContain('4 unidades disponibles');
    const limited=harness.routeNativeElement!.querySelectorAll('button[aria-label="Aumentar cantidad de Camisa Oxford"]')[1] as HTMLButtonElement;
    expect(limited.disabled).toBe(true);
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
