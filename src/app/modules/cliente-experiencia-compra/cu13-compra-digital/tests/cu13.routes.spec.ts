import { PagosService } from '../../cu14-pago-electronico/services/pagos.service';
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
import { ReservasService } from '../../cu11-gestionar-reserva/services/reservas.service';
import { ComprasService } from '../services/compras.service';
import { FinalizarCompraPage } from '../pages/finalizar-compra/finalizar-compra';
import { CompraPreparadaPage } from '../pages/compra-preparada/compra-preparada';
import { clienteSession } from '../../cu10-consultar-prendas/tests/catalogo.fixtures';
import { carritoResumen, sucursales, venta } from './compra.fixtures';

describe('CU13 finalizar compra y venta preparada', () => {
  let activeHarness: RouterTestingHarness | undefined;
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(clienteSession) };
  const carrito = { obtener: vi.fn(), estado: signal(carritoResumen) };
  const reservas = { sucursales: vi.fn() };
  const pagos={configuracion:vi.fn(),pagar:vi.fn(),detalle:()=>of({idPago:3,nroVenta:11,estado:'pendiente',metodo:'tarjeta',monto:180,referencia:null}),reconciliar:vi.fn()};
  const service = { preparar: vi.fn(), detalle: vi.fn(), pendiente: vi.fn(), cancelar: vi.fn() };
  beforeEach(() => {
    activeHarness = undefined;
    pagos.configuracion.mockReset().mockReturnValue(of({proveedor:'mock',simulacion:true,disponible:true,moneda:null}));
    pagos.pagar.mockReset().mockReturnValue(of({pago:{idPago:3,nroVenta:11,estado:'pendiente',metodo:'tarjeta',monto:180,referencia:null},reutilizado:false}));
    auth.restore.mockReset().mockReturnValue(of(clienteSession)); auth.session.set(clienteSession);
    carrito.obtener.mockReset().mockReturnValue(of(carritoResumen));
    reservas.sucursales.mockReset().mockReturnValue(of(sucursales));
    service.preparar.mockReset().mockReturnValue(of({ venta, reutilizada: false }));
    service.detalle.mockReset().mockReturnValue(of(venta));
    service.pendiente.mockReset().mockReturnValue(of(null));
    service.cancelar.mockReset().mockReturnValue(of({ ...venta, estado: 'anulada' }));
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AuthService, useValue: auth },
      { provide: CarritoService, useValue: carrito }, { provide: ReservasService, useValue: reservas },
      { provide: ComprasService, useValue: service },{provide:PagosService,useValue:pagos}] });
  });
  afterEach(() => vi.restoreAllMocks());
  async function open<T>(path: string, type: Type<T>) {
    const harness = activeHarness ??= await RouterTestingHarness.create(); await harness.navigateByUrl(path, ShopLayout);
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    const page = harness.fixture.debugElement.query(By.directive(type))!.componentInstance as T;
    return { harness, page };
  }
  const texto = (harness: { routeNativeElement?: Element | null }) => harness.routeNativeElement?.textContent ?? '';
  it('checkout con resumen, sucursal, NIT y confirmación', async () => {
    const { harness, page } = await open('/tienda/finalizar-compra', FinalizarCompraPage);
    expect(texto(harness)).toContain('Camisa Oxford');
    expect(texto(harness)).toContain('Central');
    expect(texto(harness)).not.toContain('CU13');
    page.form.controls.nroSuc.setValue(1); page.form.controls.nit.setValue('123');
    page.confirmar(); await harness.fixture.whenStable();
    expect(service.preparar).toHaveBeenCalledWith({ nroSuc: 1, nit: '123' });
    expect(TestBed.inject(Router).url).toContain('/tienda/pago/3');
  });
  it('permite recuperar una compra pendiente al volver del carrito', async () => {
    service.pendiente.mockReturnValue(of(venta));
    const { harness, page } = await open('/tienda/finalizar-compra', FinalizarCompraPage);
    expect(texto(harness)).toContain('Ver compra pendiente');
    page.form.controls.nroSuc.setValue(1); page.confirmar();
    expect(service.preparar).not.toHaveBeenCalled();
  });
  it('cancelación requiere confirmación y devuelve compra anulada', async () => {
    const { harness, page } = await open('/tienda/finalizar-compra/11', CompraPreparadaPage);
    page.cancelar(); expect(service.cancelar).not.toHaveBeenCalled();
    page.confirmarCancelacion.set(true); page.cancelar(); harness.detectChanges();
    expect(service.cancelar).toHaveBeenCalledWith(11);
    expect(texto(harness)).toContain('Compra anulada');
  });
  it('disponibilidad insuficiente funcional', async () => {
    service.preparar.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409,
      error: { error: { code: 'disponibilidad_insuficiente' } } })));
    const { harness, page } = await open('/tienda/finalizar-compra', FinalizarCompraPage);
    page.form.controls.nroSuc.setValue(1);
    page.confirmar(); await harness.fixture.whenStable(); harness.detectChanges();
    expect(texto(harness)).toContain('No hay disponibilidad suficiente en la sucursal elegida');
  });
  it('compra preparada sin pago funcional ni falsa terminación', async () => {
    const { harness } = await open('/tienda/finalizar-compra/11', CompraPreparadaPage);
    expect(service.detalle).toHaveBeenCalledWith(11);
    expect(texto(harness)).toContain('Compra número 11');
    expect(texto(harness)).toContain('registrada');
    expect(texto(harness)).toContain('Total');
    expect(texto(harness)).toContain('USD');
    expect(harness.routeNativeElement?.querySelector('.purchase-sidebar')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('.card-heading a[href="/tienda/carrito"]')?.textContent).toContain('Editar cantidades');
    expect(texto(harness)).toContain('Compra preparada para realizar el pago.');
    for (const forbidden of ['CU13', 'CU14', 'Compra completada', 'Tarjeta', 'QR']) {
      expect(texto(harness)).not.toContain(forbidden);
    }
  });
});
