import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { apiInterceptor } from '../../../core/interceptors/api.interceptor';
import { OperacionesService } from '../shared/operaciones.service';
import { Reservation, Sale } from '../shared/operaciones.models';
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

  /** Reserva #5 con 3 prendas (2 + 1 + 3), como la envía CU22 al punto de venta. */
  const reserva = () => ({ nroReserva: 5, fechaReserva: '2026-09-21', horaAtencion: '11:00:00', estado: 'confirmada',
    sucursal: { nro: 1, nombre: 'Sucursal 1', ciudad: 'La Paz' }, totalUnidades: 6, vencida: false, idCliente: 'cliente-1',
    items: [
      { idDetalleRes: 1, idVar: 'Var-A', sku: 'SKU-A', producto: 'Camisa', cantidad: 2, talla: 'M', colores: ['Rojo'] },
      { idDetalleRes: 2, idVar: 'Var-B', sku: 'SKU-B', producto: 'Pantalón', cantidad: 1, talla: 'L', colores: [] },
      { idDetalleRes: 3, idVar: 'Var-C', sku: 'SKU-C', producto: 'Chaqueta', cantidad: 3, talla: null, colores: [] }] });

  /** Respuestas del punto de venta: referencias, reserva #5 y su cliente titular. */
  function cashSetup() {
    service.get.mockImplementation((path: string) => {
      if (path === 'caja/referencias') return of({ sucursalAsignada: null, sucursales: [], categorias: [], temporadas: [] });
      if (path === 'caja/reservas/5') return of(reserva());
      if (path === 'caja/clientes') return of([{ idUsuario: 'cliente-1', nombre: 'Ana Pérez', correo: 'ana@example.com', ci: '1234567' }]);
      return of(empty);
    });
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

  it('CU24 exige sucursal y prendas, y admite la venta anónima', () => {
    setup();
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    page.prepareSale();
    expect(service.send).not.toHaveBeenCalled();
    expect(page.error()).toContain('sucursal');
    page.nroSuc = 1;
    page.prepareSale();
    expect(service.send).not.toHaveBeenCalled();
    expect(page.error()).toContain('prendas');
    // CU24: sin cliente la venta queda como anónima (idCliente null) en vez de fallar.
    page.draft = [{ idVar: 'Var-1', producto: 'Camisa', talla: 'M', colores: 'Rojo', imagen: null, cantidad: 1 }];
    page.prepareSale();
    expect(service.send).toHaveBeenCalledWith('caja', expect.objectContaining({ nroSuc: 1, idCliente: null,
      items: [{ idVar: 'Var-1', cantidad: 1 }] }));
  });

  it('CU24 exige el cliente titular cuando la venta proviene de una reserva', () => {
    setup();
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    page.nroSuc = 1; page.nroReserva = 5;
    page.draft = [{ idVar: 'Var-1', producto: 'Camisa', talla: 'M', colores: 'Rojo', imagen: null, cantidad: 1 }];
    page.prepareSale();
    expect(service.send).not.toHaveBeenCalled();
    expect(page.error()).toContain('reserva');
    page.selectedCustomer.set({ idUsuario: 'cliente-1', nombre: 'Ana', correo: 'ana@example.com', ci: '1234567' });
    page.prepareSale();
    expect(service.send).toHaveBeenCalledWith('caja', expect.objectContaining({ idCliente: 'cliente-1', nroReserva: 5 }));
  });

  it('CU24 registra al cliente en el mostrador y lo selecciona sin cambiar la sesión', () => {
    setup();
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    page.nuevo = { ci: '1234567', nombres: 'Ana', apellidoPat: 'Pérez', apellidoMat: 'López', sexo: 'F',
      correo: 'ana@example.com', telefono: '70000000', direccion: 'Calle 1', fechaNac: '2000-01-01',
      contrasena: 'Frase de prueba larga 123!' };
    service.send.mockReturnValue(of({ idUsuario: 'nuevo-1', nombre: 'Ana Pérez López', correo: 'ana@example.com', ci: '1234567' }));
    page.registrarCliente();
    expect(service.send).toHaveBeenCalledWith('caja/clientes', expect.objectContaining({
      correo: 'ana@example.com', ci: '1234567', nombres: 'Ana' }));
    expect(page.selectedCustomer()?.idUsuario).toBe('nuevo-1');
    expect(page.registrando()).toBe(false);
    // La venta anónima se puede elegir explícitamente y no inventa cliente genérico.
    page.draft = [{ idVar: 'Var-1', producto: 'Camisa', talla: 'M', colores: 'Rojo', imagen: null, cantidad: 1 }];
    page.usarSinRegistro();
    expect(page.selectedCustomer()).toBeNull();
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

  it('CU24 reconstruye la venta consultando la reserva real (3 prendas, cliente y sucursal)', () => {
    setup();
    cashSetup();
    queryParams.set('reserva', '5'); queryParams.set('sucursal', '1'); queryParams.set('cliente', 'cliente-1');
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    expect(service.get).toHaveBeenCalledWith('caja/reservas/5');
    expect(page.nroReserva).toBe(5);
    // La sucursal y el titular vienen de la reserva, no de los datos temporales.
    expect(page.nroSuc).toBe(1);
    expect(page.selectedCustomer()?.idUsuario).toBe('cliente-1');
    expect(page.draft.map(line => [line.idVar, line.cantidad, line.reservada])).toEqual([
      ['Var-A', 2, true], ['Var-B', 1, true], ['Var-C', 3, true]]);
    expect(page.error()).toBe('');
    expect(service.get).toHaveBeenCalledWith('caja/clientes', { idUsuario: 'cliente-1' });
  });

  it('CU24 vuelve a cargar la reserva si la pantalla se refresca con nroReserva en la URL', () => {
    setup();
    cashSetup();
    queryParams.set('reserva', '5');
    const first = TestBed.createComponent(PuntoDeVentaPage);
    const esperado = [['Var-A', 2], ['Var-B', 1], ['Var-C', 3]];
    expect(first.componentInstance.draft.map(line => [line.idVar, line.cantidad])).toEqual(esperado);
    first.destroy();
    const again = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    expect(again.draft.map(line => [line.idVar, line.cantidad])).toEqual(esperado);
    expect(service.get.mock.calls.filter(call => call[0] === 'caja/reservas/5').length).toBe(2);
  });

  it('CU24 no descarta la reserva si el backend la rechaza', () => {
    setup();
    queryParams.set('reserva', '99');
    service.get.mockImplementation((path: string) => path === 'caja/referencias'
      ? of({ sucursalAsignada: null, sucursales: [], categorias: [], temporadas: [] })
      : path === 'caja/reservas/99'
        ? throwError(() => new HttpErrorResponse({ status: 409, error: { error: { code: 'reserva_no_preparada',
          message: 'Confirma las prendas preparadas de la reserva antes de cobrarla en caja' } } }))
        : of(empty));
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    expect(page.reservation()).toBeNull();
    expect(page.nroReserva).toBeNull();
    expect(page.draft).toEqual([]);
    expect(page.error()).not.toBe('');
  });

  it('CU24 protege las prendas de la reserva: no se quitan ni bajan de lo reservado', () => {
    setup();
    cashSetup();
    queryParams.set('reserva', '5');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    page.removeDraft(0);
    expect(page.draft.length).toBe(3);
    expect(page.error()).toContain('Quitar reserva');
    page.draft[1].cantidad = 0;
    page.normalizarCantidad(1);
    expect(page.draft[1].cantidad).toBe(1);
    page.draft[1].cantidad = 4;
    page.normalizarCantidad(1);
    expect(page.draft[1].cantidad).toBe(4);
    // Quitar la reserva libera sus prendas y la venta vuelve a ser manual.
    page.clearReservation();
    expect(page.reservation()).toBeNull();
    expect(page.nroReserva).toBeNull();
    expect(page.draft).toEqual([]);
    expect(navigate).toHaveBeenCalledWith(['/admin/caja']);
  });

  it('CU24 no admite cliente anónimo ni otro cliente mientras la reserva siga vinculada', () => {
    setup();
    cashSetup();
    queryParams.set('reserva', '5');
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    page.usarSinRegistro();
    expect(page.selectedCustomer()?.idUsuario).toBe('cliente-1');
    expect(page.error()).toContain('Quitar reserva');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    page.clearReservation();
    page.usarSinRegistro();
    expect(page.selectedCustomer()).toBeNull();
  });

  it('CU24 envía las prendas reservadas junto a las extra al registrar la venta', () => {
    setup();
    cashSetup();
    queryParams.set('reserva', '5');
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    page.draft.push({ idVar: 'Var-X', producto: 'Bufanda', talla: 'Única', colores: 'Azul', imagen: null, cantidad: 1 });
    page.prepareSale();
    expect(service.send).toHaveBeenCalledWith('caja', expect.objectContaining({ nroSuc: 1, idCliente: 'cliente-1', nroReserva: 5,
      items: [{ idVar: 'Var-A', cantidad: 2 }, { idVar: 'Var-B', cantidad: 1 }, { idVar: 'Var-C', cantidad: 3 },
        { idVar: 'Var-X', cantidad: 1 }] }));
  });

  it('CU22 confirma la reserva y envía su número a la caja', () => {
    setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const reserva = { nroReserva: 5, fechaReserva: '2026-09-21', horaAtencion: '11:00:00', estado: 'confirmada' as const,
      sucursal: { nro: 1, nombre: 'Sucursal 1', ciudad: 'La Paz' }, items: [], totalUnidades: 6, vencida: false,
      idCliente: 'cliente-1' };
    service.send.mockReturnValue(of(reserva));
    const page = TestBed.createComponent(ReservasSucursalPage).componentInstance;
    page.reservation.set({ ...reserva, estado: 'pendiente' });
    page.reservationAction('confirmar');
    expect(service.send).toHaveBeenCalledWith('reservas-sucursal/5/accion', { accion: 'confirmar' });
    expect(navigate).toHaveBeenCalledWith(['/admin/caja'],
      { queryParams: { reserva: 5, sucursal: 1, cliente: 'cliente-1' } });
  });

});

describe('CU24 pago electrónico con Stripe', () => {
  const service = { get: vi.fn(), send: vi.fn(), export: vi.fn() };
  const queryParams = new Map<string, string>();
  const route = () => ({ snapshot: { queryParamMap: { get: (key: string) => queryParams.get(key) ?? null } } });
  const assign = vi.fn();
  const venta: Sale = { nroVenta: 7, fechaHora: '2026-09-19T10:00:00', estado: 'registrada', idCliente: 'cliente-1',
    total: 100, descAplicado: 0, sucursal: { nombre: 'Sucursal 1', ciudad: 'La Paz' },
    items: [{ idDetalleVenta: 1, idVar: 'Var-A', producto: 'Camisa', cantidad: 1, precioUnitario: 100 }], pagos: [] };
  const aprobada: Sale = { ...venta, pagos: [{ estado: 'aprobado', metodo: 'tarjeta' }] };
  const pago = (extra: Record<string, unknown> = {}) => ({ idPago: 3, metodo: 'tarjeta', monto: 100, estado: 'pendiente',
    nroVenta: 7, estadoVenta: 'registrada', ...extra });

  beforeEach(() => {
    for (const mock of Object.values(service)) mock.mockReset();
    queryParams.clear(); assign.mockReset();
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: { assign } as unknown as Location });
    service.get.mockReturnValue(of(venta));
    service.send.mockReturnValue(of(pago()));
    service.export.mockReturnValue(of(new Blob()));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ActivatedRoute, useValue: route() }, { provide: OperacionesService, useValue: service }] });
  });

  /** Comprobante de venta ya preparado: el cajero ve el resumen de cobro. */
  const comprobante = (): PuntoDeVentaPage => {
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    page.sale.set(venta);
    return page;
  };

  it('imprime sólo el recibo: el botón llama a window.print y queda fuera del papel', () => {
    const print = vi.fn();
    Object.defineProperty(window, 'print', { configurable: true, writable: true, value: print });
    const fixture = TestBed.createComponent(PuntoDeVentaPage);
    fixture.componentInstance.sale.set({ ...venta, cliente: 'Ana Pérez', empleado: 'Juan Pérez', brutoTotal: 100,
      descuentos: [{ nombre: 'Promo', tipoDescuento: 'montoFijo', valorDescuento: '15.00', monto: '15.00' }] });
    fixture.detectChanges();
    const boton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(item => item.textContent?.trim() === 'Imprimir recibo');
    expect(boton).toBeTruthy();
    // El ticket es la única raíz `.receipt` y el botón lleva `no-print`: en
    // `@media print` sólo queda visible el comprobante.
    expect(fixture.nativeElement.querySelector('.receipt')).not.toBeNull();
    expect(boton!.closest('.no-print')).not.toBeNull();
    boton!.click();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('llama al endpoint de CU24 y navega con la URL que devuelve el backend', () => {
    service.send.mockReturnValue(of(pago({ checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1' })));
    const page = comprobante();
    page.metodo = 'tarjeta';
    page.electronic();
    expect(service.send).toHaveBeenCalledWith('caja/7/electronico', { metodo: 'tarjeta' });
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1');
    expect(page.error()).toBe('');
  });

  it('sin checkoutUrl no navega y explica el problema', () => {
    const page = comprobante();
    page.electronic();
    expect(assign).not.toHaveBeenCalled();
    expect(page.error()).toContain('No se recibió una URL de Stripe');
  });

  it('un pago ya aprobado actualiza el comprobante sin abrir Stripe', () => {
    service.send.mockReturnValueOnce(of(pago({ estado: 'aprobado' }))).mockReturnValue(of(aprobada));
    const page = comprobante();
    page.electronic();
    expect(assign).not.toHaveBeenCalled();
    expect(service.get).toHaveBeenCalledWith('caja/7');
    expect(service.send).toHaveBeenCalledWith('caja/7/consultar-pago');
    expect(page.success()).toContain('Pago confirmado');
  });

  it('no lanza dos solicitudes si se pulsa dos veces', () => {
    service.send.mockReturnValue(new Subject<Sale>());
    const page = comprobante();
    page.electronic(); page.electronic();
    expect(service.send).toHaveBeenCalledTimes(1);
    expect(page.saving()).toBe(true);
  });

  it('muestra el error del backend y reactiva el botón', () => {
    service.send.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503,
      error: { error: { code: 'pasarela_no_disponible', message: 'No se pudo comunicar con la pasarela' } } })));
    const page = comprobante();
    page.electronic();
    expect(assign).not.toHaveBeenCalled();
    expect(page.error()).not.toBe('');
    expect(page.saving()).toBe(false);
  });

  it('al volver de Stripe consulta el estado real y no asume aprobado', () => {
    queryParams.set('venta', '7'); queryParams.set('pago', '3');
    service.send.mockReturnValue(of(venta));
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    expect(service.get).toHaveBeenCalledWith('caja/7');
    expect(service.send).toHaveBeenCalledWith('caja/7/consultar-pago');
    expect(page.sale()?.nroVenta).toBe(7);
    expect(page.success()).toContain('Pago pendiente');
  });

  it('al cancelar en Stripe no marca el pago como aprobado', () => {
    queryParams.set('venta', '7'); queryParams.set('cancelar', '1');
    service.send.mockReturnValue(of(venta));
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    expect(page.success()).toContain('Cancelaste el pago');
    expect(page.error()).toBe('');
  });

  // CU22 → CU24: la reserva indica si la caja ya preparó una venta para retomarla sin cobrarla.
  const reserva: Reservation = { nroReserva: 5, fechaReserva: '2026-09-21', horaAtencion: '11:00:00',
    estado: 'confirmada', sucursal: { nro: 1, nombre: 'Sucursal 1', ciudad: 'La Paz' }, totalUnidades: 2,
    vencida: false, idCliente: 'cliente-1', items: [{ idDetalleRes: 1, idVar: 'Var-A', sku: 'SKU-A',
      producto: 'Camisa', cantidad: 2, talla: 'M', colores: ['Rojo'] }] };
  const titular = [{ idUsuario: 'cliente-1', nombre: 'Ana', correo: 'ana@example.com', ci: '1234567' }];
  const conReserva = (value: Reservation, ventaPreparada: Sale) => (url: string) =>
    url === 'caja/reservas/5' ? of(value) : url === 'caja/clientes' ? of(titular)
      : url === `caja/${ventaPreparada.nroVenta}` ? of(ventaPreparada) : of(venta);

  it('retoma la venta ya preparada de la reserva en lugar de bloquear el cobro', () => {
    queryParams.set('reserva', '5');
    const preparada: Sale = { ...venta, nroVenta: 9 };
    service.get.mockImplementation(conReserva({ ...reserva, nroVentaEnCurso: 9 }, preparada));
    service.send.mockReturnValue(of(preparada));
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    expect(page.nroReserva).toBe(5);
    expect(service.get).toHaveBeenCalledWith('caja/reservas/5');
    // Se abre la venta preparada y se consulta su pago real: la reserva no queda bloqueada.
    expect(service.get).toHaveBeenCalledWith('caja/9');
    expect(service.send).toHaveBeenCalledWith('caja/9/consultar-pago');
    expect(page.sale()?.nroVenta).toBe(9);
    expect(page.success()).toContain('Pago pendiente');
  });

  it('una reserva sin venta preparada se reconstruye sin abrir ningún comprobante', () => {
    queryParams.set('reserva', '5');
    service.get.mockImplementation(conReserva(reserva, venta));
    const page = TestBed.createComponent(PuntoDeVentaPage).componentInstance;
    expect(page.reservation()?.nroReserva).toBe(5);
    expect(page.sale()).toBeNull();
    expect(service.send).not.toHaveBeenCalled();
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
