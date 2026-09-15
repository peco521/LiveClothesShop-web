import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { ComprasService } from '../services/compras.service';
import { venta } from './compra.fixtures';

describe('CU13 servicio, idempotencia y precios del servidor', () => {
  let service: ComprasService; let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(ComprasService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  it('prepara solo con sucursal y NIT', () => {
    let result: unknown;
    service.preparar({ nroSuc: 1, nit: ' 123 ', idCarrito: 5, total: 1 } as never).subscribe(value => result = value);
    const req = http.expectOne('/api/cliente/compras/desde-carrito');
    expect(req.request.method).toBe('POST');
    // Ni carrito, ni precios, ni totales viajan: todo lo resuelve el servidor.
    expect(req.request.body).toEqual({ nroSuc: 1, nit: '123' });
    expect(req.request.withCredentials).toBe(true);
    req.flush(venta, { headers: {}, status: 201, statusText: 'Created' });
    expect(result).toEqual({ venta, reutilizada: false });
  });
  it('reintento idempotente con 200 reutiliza la venta', () => {
    let result: unknown;
    service.preparar({ nroSuc: 1 }).subscribe(value => result = value);
    const req = http.expectOne('/api/cliente/compras/desde-carrito');
    expect(req.request.body).toEqual({ nroSuc: 1 });
    req.flush({ ...venta, token: 'forbidden' }, { status: 200, statusText: 'OK' });
    expect(result).toEqual({ venta, reutilizada: true });
    expect(JSON.stringify(result)).not.toContain('forbidden');
  });
  it('detalle por número', () => {
    service.detalle(11).subscribe();
    http.expectOne('/api/cliente/compras/11');
  });
  it.each([401, 403, 404, 409, 422])('propaga HTTP %s sin éxito falso', status => {
    const failed = vi.fn(); service.preparar({ nroSuc: 1 }).subscribe({ error: failed });
    http.expectOne('/api/cliente/compras/desde-carrito').flush({}, { status, statusText: 'Rejected' });
    expect(failed).toHaveBeenCalledOnce();
  });
});

describe('CU13 servicio SSR', () => {
  it('no hace ninguna petición privada en servidor', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(ComprasService);
    service.preparar({ nroSuc: 1 }).subscribe(); service.detalle(11).subscribe();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
