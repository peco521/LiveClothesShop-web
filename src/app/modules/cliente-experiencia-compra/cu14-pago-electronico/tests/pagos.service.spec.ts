import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { PagosService } from '../services/pagos.service';
import { pago } from './pago.fixtures';

describe('CU14 servicio, monto del servidor e idempotencia', () => {
  let service: PagosService; let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(PagosService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  it('paga solo con venta, método y escenario', () => {
    let result: unknown;
    service.pagar({ nroVenta: 11, metodo: 'QR', escenario: 'aprobado', monto: 1 } as never).subscribe(value => result = value);
    const req = http.expectOne('/api/cliente/pagos');
    expect(req.request.method).toBe('POST');
    // Ni monto ni referencia viajan: los fija el servidor/pasarela.
    expect(req.request.body).toEqual({ nroVenta: 11, metodo: 'QR', escenario: 'aprobado' });
    expect(req.request.withCredentials).toBe(true);
    req.flush(pago, { status: 201, statusText: 'Created' });
    expect(result).toEqual({ pago, reutilizado: false });
  });
  it('reutilizado con 200 no duplica', () => {
    let result: unknown;
    service.pagar({ nroVenta: 11, metodo: 'tarjeta' }).subscribe(value => result = value);
    const req = http.expectOne('/api/cliente/pagos');
    expect(req.request.body).toEqual({ nroVenta: 11, metodo: 'tarjeta' });
    req.flush({ ...pago, token: 'forbidden' }, { status: 200, statusText: 'OK' });
    expect(result).toEqual({ pago, reutilizado: true });
    expect(JSON.stringify(result)).not.toContain('forbidden');
  });
  it('detalle y reprocesado', () => {
    service.detalle(3).subscribe();
    http.expectOne('/api/cliente/pagos/3');
    service.procesar(3).subscribe();
    const req = http.expectOne('/api/cliente/pagos/3/procesar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(pago);
  });
  it.each([401, 403, 404, 409, 422])('propaga HTTP %s sin éxito falso', status => {
    const failed = vi.fn(); service.pagar({ nroVenta: 11, metodo: 'tarjeta' }).subscribe({ error: failed });
    http.expectOne('/api/cliente/pagos').flush({}, { status, statusText: 'Rejected' });
    expect(failed).toHaveBeenCalledOnce();
  });
});

describe('CU14 servicio SSR', () => {
  it('no hace ninguna petición privada en servidor', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(PagosService);
    service.pagar({ nroVenta: 11, metodo: 'tarjeta' }).subscribe(); service.detalle(3).subscribe();
    service.procesar(3).subscribe();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
