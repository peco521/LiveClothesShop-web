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
import { CarritoService } from '../../cu12-carrito/services/carrito.service';
import { PagosService } from '../services/pagos.service';
import { PagoPage } from '../pages/pago/pago';
import { EstadoPagoPage } from '../pages/estado-pago/estado-pago';
import { clienteSession } from '../../cu10-consultar-prendas/tests/catalogo.fixtures';
import { pago, pendiente, rechazado } from './pago.fixtures';

describe('CU14 pago, estados y entorno de prueba', () => {
  let activeHarness: RouterTestingHarness | undefined;
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(clienteSession) };
  const service = { pagar: vi.fn(), detalle: vi.fn(), procesar: vi.fn() };
  const carrito = { obtener: vi.fn(), estado: signal({ idCarrito: null, items: [], cantidadItems: 0, subtotal: 0 }) };
  beforeEach(() => {
    activeHarness = undefined;
    auth.restore.mockReset().mockReturnValue(of(clienteSession)); auth.session.set(clienteSession);
    carrito.obtener.mockReset().mockReturnValue(of({ idCarrito: null, items: [], cantidadItems: 0, subtotal: 0 }));
    service.pagar.mockReset().mockReturnValue(of({ pago, reutilizado: false }));
    service.detalle.mockReset().mockReturnValue(of(pago));
    service.procesar.mockReset().mockReturnValue(of(pago));
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AuthService, useValue: auth },
      { provide: PagosService, useValue: service }, { provide: CarritoService, useValue: carrito }] });
  });
  afterEach(() => vi.restoreAllMocks());
  async function open<T>(path: string, type: Type<T>) {
    const harness = activeHarness ??= await RouterTestingHarness.create(); await harness.navigateByUrl(path, ShopLayout);
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    const page = harness.fixture.debugElement.query(By.directive(type))!.componentInstance as T;
    return { harness, page };
  }
  const texto = (harness: { routeNativeElement?: Element | null }) => harness.routeNativeElement?.textContent ?? '';
  it('pago con métodos permitidos, sin efectivo y con aviso de simulación', async () => {
    const { harness, page } = await open('/tienda/pago/nueva?nroVenta=11', PagoPage);
    expect(page.nroVenta()).toBe(11);
    expect(texto(harness)).toContain('Entorno de prueba/simulación');
    expect(texto(harness)).not.toContain('Efectivo');
    expect(texto(harness)).not.toContain('efectivo');
    page.form.controls.metodo.setValue('QR'); page.form.controls.escenario.setValue('aprobado');
    page.pagar(); await harness.fixture.whenStable();
    expect(service.pagar).toHaveBeenCalledWith({ nroVenta: 11, metodo: 'QR', escenario: 'aprobado' });
    expect(TestBed.inject(Router).url).toContain('/tienda/pago/3');
    for (const forbidden of ['CU14', 'CU13', 'CVV', 'PAN']) {
      expect(texto(harness)).not.toContain(forbidden);
    }
  });
  it('aprobado confirma la compra completada', async () => {
    const { harness } = await open('/tienda/pago/3', EstadoPagoPage);
    expect(service.detalle).toHaveBeenCalledWith(3);
    expect(texto(harness)).toContain('Compra completada');
    expect(texto(harness)).toContain('MOCK-000003-11');
    expect(texto(harness)).not.toContain('CU14');
  });
  it('rechazado orienta al carrito', async () => {
    service.detalle.mockReset().mockReturnValue(of(rechazado));
    const { harness } = await open('/tienda/pago/3', EstadoPagoPage);
    expect(texto(harness)).toContain('Pago rechazado');
    expect(texto(harness)).toContain('Volver al carrito');
    expect(texto(harness)).not.toContain('CU14');
  });
  it('pendiente permite consultar estado', async () => {
    service.detalle.mockReset().mockReturnValue(of(pendiente));
    const { harness, page } = await open('/tienda/pago/3', EstadoPagoPage);
    expect(texto(harness)).toContain('Pago pendiente');
    await page.consultar(); await harness.fixture.whenStable();
    expect(service.procesar).toHaveBeenCalledWith(3);
  });
  it('error funcional ante fallo', async () => {
    service.detalle.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { harness } = await open('/tienda/pago/3', EstadoPagoPage);
    expect(texto(harness)).toContain('Reintentar');
  });
});
