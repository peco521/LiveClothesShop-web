import { signal, Type } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject, throwError } from 'rxjs';
import { routes } from '../../../../app.routes';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { AuthResponse } from '../../../seguridad-accesos/models/auth.models';
import { ShopLayout } from '../../shared/layout/shop-layout';
import { CarritoService } from '../../cu12-carrito/services/carrito.service';
import { clienteSession } from '../../cu10-consultar-prendas/tests/catalogo.fixtures';
import { HistorialService } from '../services/historial.service';
import { HistorialListaPage } from '../pages/historial-lista/historial-lista';
import { HistorialDetallePage } from '../pages/historial-detalle/historial-detalle';
import { CompraDetalle, HistorialCompras } from '../models/historial.models';
import { compra, historial } from './historial.fixtures';

describe('CU15 pantallas y navegación', () => {
  let activeHarness: RouterTestingHarness | undefined;
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(clienteSession) };
  const carrito = { obtener: vi.fn(), estado: signal(null) };
  const service = { listar: vi.fn(), detalle: vi.fn() };
  beforeEach(() => {
    activeHarness = undefined;
    auth.restore.mockReset().mockReturnValue(of(clienteSession)); auth.session.set(clienteSession);
    carrito.obtener.mockReset().mockReturnValue(of(null));
    service.listar.mockReset().mockReturnValue(of(historial));
    service.detalle.mockReset().mockReturnValue(of(compra));
    TestBed.configureTestingModule({ providers: [
      provideRouter(routes), { provide: AuthService, useValue: auth },
      { provide: CarritoService, useValue: carrito }, { provide: HistorialService, useValue: service },
    ] });
  });
  async function open<T>(url: string, type: Type<T>) {
    const harness = activeHarness ??= await RouterTestingHarness.create();
    await harness.navigateByUrl(url, ShopLayout);
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    const page = harness.fixture.debugElement.query(By.directive(type)).componentInstance as T;
    return { harness, page };
  }
  const text = (h: RouterTestingHarness) => h.routeNativeElement?.textContent ?? '';

  it('muestra productos, fecha, monto, estados y acceso desde el menú', async () => {
    const { harness } = await open('/tienda/historial-compras', HistorialListaPage);
    for (const value of ['Camisa Oxford', '13/09/2026', '180.00', 'Pago aprobado']) expect(text(harness)).toContain(value);
    expect(harness.routeNativeElement?.querySelector('.shop-nav a[href="/tienda/historial-compras"]')).not.toBeNull();
    expect(text(harness)).not.toContain('CU15');
  });
  it('ofrece explorar prendas cuando no hay compras', async () => {
    service.listar.mockReturnValue(of({ items: [], total: 0, offset: 0, limit: 20 }));
    const { harness } = await open('/tienda/historial-compras', HistorialListaPage);
    expect(text(harness)).toContain('No existen compras en tu historial');
    expect(text(harness)).toContain('Explorar prendas');
    expect(harness.routeNativeElement?.querySelector('.pagination')).toBeNull();
  });
  it('pagina desde la URL y conserva el retorno desde el detalle', async () => {
    service.listar.mockReturnValue(of({ ...historial, total: 41, offset: 20 }));
    const { harness, page } = await open('/tienda/historial-compras?offset=20&limit=20', HistorialListaPage);
    expect(service.listar).toHaveBeenCalledWith(20, 20);
    const link = harness.routeNativeElement?.querySelector('a[aria-label="Ver detalle de la compra 11"]');
    expect(link?.getAttribute('href')).toBe('/tienda/historial-compras/11?offset=20&limit=20');
    page.pagina(40); await harness.fixture.whenStable();
    expect(service.listar).toHaveBeenLastCalledWith(40, 20);
    await open('/tienda/historial-compras/11?offset=20&limit=20', HistorialDetallePage);
    expect(harness.routeNativeElement?.querySelector('.back-link a')?.getAttribute('href')).toContain('offset=20&limit=20');
  });
  it('distingue una página fuera de rango de un historial vacío', async () => {
    service.listar.mockReturnValue(of({ items: [], total: 1, offset: 100, limit: 20 }));
    const { harness } = await open('/tienda/historial-compras?offset=100', HistorialListaPage);
    expect(text(harness)).toContain('No hay compras en esta página');
    expect(text(harness)).not.toContain('Aún no tienes compras');
  });
  it('normaliza paginación inválida', async () => {
    await open('/tienda/historial-compras?offset=-2&limit=101', HistorialListaPage);
    expect(service.listar).toHaveBeenCalledWith(0, 20);
  });
  it('detalle con totales históricos y sin pago registrado', async () => {
    service.detalle.mockReturnValue(of({ ...compra, pago: undefined, estadoPago: undefined, nit: undefined }));
    const { harness } = await open('/tienda/historial-compras/11', HistorialDetallePage);
    for (const value of ['200.00', '20.00', '180.00', 'Sin pago registrado', 'No hay un pago registrado', 'No registrado']) expect(text(harness)).toContain(value);
  });
  it('solicita iniciar sesión si expira durante la consulta', async () => {
    service.listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const { harness } = await open('/tienda/historial-compras', HistorialListaPage);
    expect(text(harness)).toContain('Tu sesión ha expirado');
    expect(harness.routeNativeElement?.querySelector('[role="alert"] a')?.getAttribute('href')).toBe('/login');
    expect(text(harness)).not.toContain('Camisa Oxford');
  });
  it('muestra fallo de consulta y permite reintentar', async () => {
    service.listar.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503, error: { message: 'private SQL' } })));
    const { harness, page } = await open('/tienda/historial-compras', HistorialListaPage);
    expect(text(harness)).toContain('No fue posible obtener el historial');
    expect(text(harness)).not.toContain('private SQL');
    page.load(); harness.detectChanges();
    expect(text(harness)).toContain('Camisa Oxford');
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')).toBeNull();
  });
  it('no muestra datos de una compra inexistente o ajena', async () => {
    service.detalle.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const { harness } = await open('/tienda/historial-compras/11', HistorialDetallePage);
    expect(text(harness)).toContain('No se encontró la compra solicitada');
    expect(text(harness)).not.toContain('Camisa Oxford');
    expect(text(harness)).not.toContain('Reintentar');
  });
  it.each(['0', 'abc', '2147483648'])('rechaza el identificador %s antes de consultar', async id => {
    const { harness } = await open('/tienda/historial-compras/' + id, HistorialDetallePage);
    expect(text(harness)).toContain('El número de compra no es válido');
    expect(service.detalle).not.toHaveBeenCalled();
  });
  it('cancela la consulta anterior al cambiar de compra', async () => {
    const first = new Subject<CompraDetalle>();
    service.detalle.mockReturnValueOnce(first);
    const { harness } = await open('/tienda/historial-compras/11', HistorialDetallePage);
    expect(text(harness)).toContain('Cargando detalle');
    service.detalle.mockReturnValue(of({ ...compra, nroVenta: 12 }));
    await open('/tienda/historial-compras/12', HistorialDetallePage);
    first.next({ ...compra, total: '999.00' }); harness.detectChanges();
    expect(text(harness)).toContain('Compra #12');
    expect(text(harness)).not.toContain('999.00');
    expect(first.observed).toBe(false);
  });
  it('cancela una página pendiente al navegar a otra', async () => {
    const first = new Subject<HistorialCompras>();
    service.listar.mockReturnValueOnce(first);
    const { harness } = await open('/tienda/historial-compras', HistorialListaPage);
    expect(text(harness)).toContain('Cargando historial');
    await open('/tienda/historial-compras?offset=20', HistorialListaPage);
    first.next({ items: [], total: 0, offset: 0, limit: 20 }); harness.detectChanges();
    expect(text(harness)).toContain('Camisa Oxford');
    expect(first.observed).toBe(false);
  });
  it('el guard deriva al login sin consultar el historial si no hay sesión', async () => {
    auth.restore.mockReturnValue(of(null));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/tienda/historial-compras');
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(service.listar).not.toHaveBeenCalled();
  });
});
