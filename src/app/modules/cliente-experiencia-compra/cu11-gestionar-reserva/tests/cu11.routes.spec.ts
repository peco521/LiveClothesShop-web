import { signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from '../../../../app.routes';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { AuthResponse } from '../../../seguridad-accesos/models/auth.models';
import { ShopLayout } from '../../shared/layout/shop-layout';
import { CatalogoService } from '../../cu10-consultar-prendas/services/catalogo.service';
import { CarritoService } from '../../cu12-carrito/services/carrito.service';
import { ReservasService } from '../services/reservas.service';
import { CatalogoDetallePage } from '../../cu10-consultar-prendas/pages/catalogo-detalle/catalogo-detalle';
import { MisReservasPage } from '../pages/mis-reservas/mis-reservas';
import { NuevaReservaPage } from '../pages/nueva-reserva/nueva-reserva';
import { DetalleReservaPage } from '../pages/detalle-reserva/detalle-reserva';
import { clienteSession, detail, facetas, list as catalogo } from '../../cu10-consultar-prendas/tests/catalogo.fixtures';
import { horarios, list, reserva, sucursales } from './reserva.fixtures';

describe('CU11 páginas, navegación e integración con catálogo', () => {
  let activeHarness: RouterTestingHarness | undefined;
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(clienteSession) };
  const catalogoService = { listar: vi.fn(), detalle: vi.fn(), faceta: vi.fn() };
  const service = { crear: vi.fn(), listar: vi.fn(), detalle: vi.fn(), cancelar: vi.fn(), sucursales: vi.fn(), horarios: vi.fn() };
  const carrito = { obtener: vi.fn(), estado: signal({ idCarrito: null, items: [], cantidadItems: 0, subtotal: 0 }) };
  beforeEach(() => {
    activeHarness = undefined;
    auth.restore.mockReset().mockReturnValue(of(clienteSession)); auth.session.set(clienteSession);
    catalogoService.listar.mockReset().mockReturnValue(of(catalogo)); catalogoService.detalle.mockReset().mockReturnValue(of(detail));
    catalogoService.faceta.mockReset().mockReturnValue(of(facetas));
    carrito.obtener.mockReset().mockReturnValue(of({ idCarrito: null, items: [], cantidadItems: 0, subtotal: 0 }));
    service.crear.mockReset().mockReturnValue(of(reserva)); service.listar.mockReset().mockReturnValue(of(list));
    service.detalle.mockReset().mockReturnValue(of(reserva)); service.cancelar.mockReset().mockReturnValue(of({ ...reserva, estado: 'cancelada' }));
    service.sucursales.mockReset().mockReturnValue(of(sucursales)); service.horarios.mockReset().mockReturnValue(of(horarios));
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AuthService, useValue: auth },
      { provide: CatalogoService, useValue: catalogoService }, { provide: ReservasService, useValue: service }, { provide: CarritoService, useValue: carrito }] });
  });
  afterEach(() => vi.restoreAllMocks());
  async function open<T>(path: string, type: Type<T>) {
    const harness = activeHarness ??= await RouterTestingHarness.create(); await harness.navigateByUrl(path, ShopLayout);
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    const page = harness.fixture.debugElement.query(By.directive(type))!.componentInstance as T;
    return { harness, page };
  }
  it('mis reservas con estado, paginación y sin códigos visibles', async () => {
    const { harness, page } = await open('/tienda/reservas', MisReservasPage);
    expect(service.listar).toHaveBeenCalledWith({ offset: 0, limit: 20 });
    expect(harness.routeNativeElement?.textContent).toContain('3 reservas encontradas.');
    expect(harness.routeNativeElement?.querySelector('a[href="/tienda/reservas/7"]')).toBeTruthy();
    page.form.controls.estado.setValue('pendiente'); page.aplicar(); await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('estado=pendiente');
    for (const forbidden of ['CU11', 'CU10', 'CU12', 'Reservar(', 'carrito', 'comprar', 'pagar']) {
      expect(harness.routeNativeElement?.textContent).not.toContain(forbidden);
    }
  });
  it('nueva reserva con sucursales, horarios y confirmación', async () => {
    const { harness, page } = await open('/tienda/reservas/nueva', NuevaReservaPage);
    expect(service.sucursales).toHaveBeenCalled();
    expect(harness.routeNativeElement?.textContent).toContain('Central');
    page.form.controls.nroSuc.setValue(1); harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    expect(service.horarios).toHaveBeenCalledWith(1);
    expect(harness.routeNativeElement?.textContent).toContain('Atiende:');
    page.agregar('var-001', 2);
    page.form.controls.fechaReserva.setValue('2026-09-20'); page.form.controls.horaAtencion.setValue('10:00');
    page.guardar(); await harness.fixture.whenStable();
    expect(service.crear).toHaveBeenCalledWith({ nroSuc: 1, fechaReserva: '2026-09-20', horaAtencion: '10:00',
      items: [{ idVar: 'var-001', cantidad: 2 }] });
    expect(TestBed.inject(Router).url).toContain('/tienda/reservas/7');
  });
  it('detalle con cancelación en dos pasos solo si pendiente', async () => {
    const { harness, page } = await open('/tienda/reservas/7', DetalleReservaPage);
    expect(service.detalle).toHaveBeenCalledWith(7);
    expect(harness.routeNativeElement?.textContent).toContain('Reserva número 7');
    expect(harness.routeNativeElement?.textContent).toContain('Camisa Oxford');
    expect(harness.routeNativeElement?.textContent).not.toContain('CU11');
    const botones = [...(harness.routeNativeElement?.querySelectorAll('button') ?? [])].map(b => b.textContent?.trim());
    expect(botones).toContain('Cancelar reserva');
    page.confirmar.set(true); harness.detectChanges(); await harness.fixture.whenStable();
    page.cancelar(); await harness.fixture.whenStable();
    expect(service.cancelar).toHaveBeenCalledWith(7);
  });
  it('desde el detalle de prenda se reserva la variante elegida', async () => {
    const { harness, page } = await open('/tienda/prendas/prod-001', CatalogoDetallePage);
    expect(harness.routeNativeElement?.textContent).not.toContain('Reservar esta variante');
    page.elegir('var-001'); harness.detectChanges(); await harness.fixture.whenStable();
    const link = harness.routeNativeElement?.querySelector('a[href^="/tienda/reservas/nueva"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    await harness.navigateByUrl('/tienda/reservas/nueva?idVar=var-001&cantidad=1', ShopLayout);
    harness.detectChanges(); await harness.fixture.whenStable();
    const nueva = harness.fixture.debugElement.query(By.directive(NuevaReservaPage))!.componentInstance as NuevaReservaPage;
    expect(nueva.items.length).toBe(1);
    expect(nueva.items.at(0).getRawValue()).toEqual({ idVar: 'var-001', cantidad: 1 });
  });
});
