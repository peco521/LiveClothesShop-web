import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { of } from 'rxjs';
import { apiInterceptor } from '../../../core/interceptors/api.interceptor';
import { OperacionesService } from '../shared/operaciones.service';
import { CU21_ROUTES } from '../cu21-gestionar-promociones/routes/cu21.routes';
import { CU22_ROUTES } from '../cu22-gestionar-reservas-sucursal/routes/cu22.routes';
import { CU23_ROUTES, CU23_POLITICAS_ROUTES } from '../cu23-gestionar-devoluciones/routes/cu23.routes';
import { CU24_ROUTES } from '../cu24-registrar-venta/routes/cu24.routes';
import { CU25_ROUTES } from '../cu25-reportes/routes/cu25.routes';
import { PromocionesPage } from '../cu21-gestionar-promociones/pages/promociones';
import { ReservasSucursalPage } from '../cu22-gestionar-reservas-sucursal/pages/reservas-sucursal';
import { DevolucionesPage } from '../cu23-gestionar-devoluciones/pages/devoluciones';
import { PuntoDeVentaPage } from '../cu24-registrar-venta/pages/caja';
import { ReportesPage } from '../cu25-reportes/pages/reportes';

const empty = { items: [], total: 0, offset: 0, limit: 20 };

describe('CU21-CU25 rutas', () => {
  it('cada caso de uso expone su ruta protegida por permiso', () => {
    const routes = [CU21_ROUTES, CU22_ROUTES, CU23_ROUTES, CU23_POLITICAS_ROUTES, CU24_ROUTES, CU25_ROUTES];
    for (const route of routes) {
      expect(route.map(item => item.path)).toEqual(['']);
      expect(route[0].canActivate?.length).toBe(1);
      expect(route[0].loadComponent).toBeTypeOf('function');
    }
  });
});

describe('CU21-CU25 transporte HTTP', () => {
  let service: OperacionesService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(OperacionesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista promociones con filtros, cookie y defensa CSRF al escribir', () => {
    service.get('promociones', { q: 'verano', offset: 0, limit: 20 }).subscribe();
    http.expectOne('/api/admin/promociones?q=verano&offset=0&limit=20').flush(empty);
    service.send('promociones', { nombre: 'Rebaja' }).subscribe();
    const request = http.expectOne('/api/admin/promociones');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-CSRF-Protection')).toBe('1');
    request.flush({ idPromo: 1 });
  });

  it('registra la venta de caja y consulta su pago', () => {
    service.send('caja', { nroSuc: 1, idCliente: 'cliente-1', items: [{ idVar: 'Var-1', cantidad: 1 }] }).subscribe();
    const sale = http.expectOne('/api/admin/caja');
    expect(sale.request.method).toBe('POST');
    sale.flush({ nroVenta: 5 });
    service.send('caja/5/consultar-pago').subscribe();
    const reconcile = http.expectOne('/api/admin/caja/5/consultar-pago');
    expect(reconcile.request.method).toBe('POST');
    reconcile.flush({ nroVenta: 5 });
  });

  it('actualiza la política de devolución con PUT en la ruta de CU23', () => {
    service.send('devoluciones/politicas', { idProd: 'Prod-1', dias: 30, porcentaje: 80 }, 'PUT').subscribe();
    const request = http.expectOne('/api/admin/devoluciones/politicas');
    expect(request.request.method).toBe('PUT');
    request.flush({ id: 1 });
  });

  it('exporta el reporte como blob con el tipo y formato solicitados', () => {
    service.export({ fechaIni: '2026-01-01', fechaFin: '2026-01-31', tipo: 'ventas', formato: 'xlsx' }).subscribe();
    const request = http.expectOne('/api/admin/reportes/exportar?fechaIni=2026-01-01&fechaFin=2026-01-31&tipo=ventas&formato=xlsx');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob());
  });
});

describe('CU21-CU25 validaciones de pantalla', () => {
  const service = { get: vi.fn(), send: vi.fn(), export: vi.fn() };
  // Parámetros de URL con los que CU22 envía la reserva a cobrar en CU24.
  const queryParams = new Map<string, string>();
  const route = () => ({ snapshot: { queryParamMap: { get: (key: string) => queryParams.get(key) ?? null } } });
  const form = () => ({ invalid: false, form: { markAllAsTouched: vi.fn() }, controls: {} }) as never;
  function setup() {
    for (const mock of Object.values(service)) mock.mockReset();
    queryParams.clear();
    service.get.mockReturnValue(of(empty));
    service.send.mockReturnValue(of({}));
    service.export.mockReturnValue(of(new Blob()));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ActivatedRoute, useValue: route() }, { provide: OperacionesService, useValue: service }] });
  }

  it('CU21 exige fechas coherentes y al menos una prenda', () => {
    setup();
    const page = TestBed.createComponent(PromocionesPage).componentInstance;
    page.savePromotion(form());
    expect(service.send).not.toHaveBeenCalled();
    expect(page.error()).toContain('fecha de fin');
    page.promotion = { nombre: 'Rebaja', descripcion: '10%', tipoDescuento: 'porcentaje', valorDescuento: 10, fechaIni: '2026-01-01', fechaFin: '2026-01-31' };
    page.savePromotion(form());
    expect(service.send).not.toHaveBeenCalled();
    expect(page.error()).toContain('al menos una prenda');
    page.selectedProducts = ['Prod-1'];
    page.savePromotion(form());
    expect(service.send).toHaveBeenCalledWith('promociones', expect.objectContaining({ productos: ['Prod-1'], valorDescuento: 10 }));
  });

  it('CU23 no registra la devolución sin cantidades ni motivo', () => {
    setup();
    const page = TestBed.createComponent(DevolucionesPage).componentInstance;
    page.sale.set({ nroVenta: 1, fechaHora: '2026-01-05T10:00:00', estado: 'registrada', idCliente: 'cliente-1',
      total: 100, descAplicado: 0, sucursal: { nombre: 'Central', ciudad: 'La Paz' },
      items: [{ idDetalleVenta: 1, idVar: 'Var-1', producto: 'Camisa', cantidad: 2, precioUnitario: 50 }] });
    page.registerReturn();
    expect(service.send).not.toHaveBeenCalled();
    expect(page.error()).toContain('cantidad a devolver');
    page.returnQuantities = { 1: 1 };
    page.registerReturn();
    expect(service.send).not.toHaveBeenCalled();
    expect(page.error()).toContain('motivo');
    page.motivo = 'Talla incorrecta';
    page.registerReturn();
    expect(service.send).toHaveBeenCalledWith('devoluciones', expect.objectContaining({ nroVenta: 1, idCliente: 'cliente-1',
      items: [{ idDetalleVenta: 1, cantidad: 1 }] }));
  });

  it('CU24 exige cliente, sucursal y prendas antes de preparar la venta', () => {
    setup();
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    page.prepareSale();
    expect(service.send).not.toHaveBeenCalled();
    expect(page.error()).toContain('cliente');
    page.nroSuc = 1;
    page.selectedCustomer.set({ idUsuario: 'cliente-1', nombre: 'Ana', correo: 'ana@example.com', ci: '1234567' });
    page.prepareSale();
    expect(service.send).not.toHaveBeenCalled();
    page.draft = [{ idVar: 'Var-1', producto: 'Camisa', talla: 'M', colores: 'Rojo', imagen: null, cantidad: 1 }];
    page.prepareSale();
    expect(service.send).toHaveBeenCalledWith('caja', expect.objectContaining({ nroSuc: 1, idCliente: 'cliente-1',
      items: [{ idVar: 'Var-1', cantidad: 1 }] }));
  });

  it('CU25 exige el rango de fechas antes de consultar o exportar', () => {
    setup();
    const page = TestBed.createComponent(ReportesPage).componentInstance;
    service.get.mockClear();
    page.fechaIni = ''; page.fechaFin = '';
    page.load();
    expect(service.get).not.toHaveBeenCalled();
    expect(page.error()).toContain('rango de fechas');
    page.download('ventas', 'pdf');
    expect(service.export).not.toHaveBeenCalled();
    expect(page.error()).toContain('rango de fechas');
  });
  it('CU22 envía el cobro de la reserva al punto de venta de CU24', () => {
    setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const page = TestBed.createComponent(ReservasSucursalPage).componentInstance;
    page.chargeInCashier({ nroReserva: 5, fechaReserva: '2026-09-21', horaAtencion: '11:00:00', estado: 'confirmada',
      sucursal: { nro: 1, nombre: 'Villa 1ro de Mayo', ciudad: 'La Paz' }, items: [], totalUnidades: 2,
      vencida: false, idCliente: 'cliente-1' });
    expect(navigate).toHaveBeenCalledWith(['/admin/caja'],
      { queryParams: { reserva: 5, sucursal: 1, cliente: 'cliente-1' } });
  });

  it('CU24 precarga la reserva confirmada que llega desde CU22', () => {
    setup();
    service.get.mockImplementation((path: string) => of(path === 'caja/referencias'
      ? { sucursalAsignada: null, sucursales: [], categorias: [], temporadas: [] } : empty));
    queryParams.set('reserva', '5'); queryParams.set('sucursal', '1'); queryParams.set('cliente', 'cliente-1');
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    expect(page.nroReserva).toBe(5);
    expect(page.nroSuc).toBe(1);
    expect(page.reservaCliente()).toBe('cliente-1');
    expect(page.error()).toBe('');
    expect(service.get).toHaveBeenCalledWith('caja/clientes', { idUsuario: 'cliente-1' });
  });


});

describe('CU21-CU25 SSR', () => {
  it('no consulta datos privados en el servidor', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(OperacionesService);
    service.get('promociones', {}).subscribe();
    service.send('caja', { nroSuc: 1 }).subscribe();
    service.export({ fechaIni: '2026-01-01', fechaFin: '2026-01-31' }).subscribe();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
