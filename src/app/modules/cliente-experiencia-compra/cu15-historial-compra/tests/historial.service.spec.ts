import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { HistorialService } from '../services/historial.service';
import { compra, historial } from './historial.fixtures';

describe('CU15 contrato HTTP', () => {
  let service: HistorialService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(HistorialService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('consulta la página con cookie y sin enviar una identidad de cliente', () => {
    let result: unknown;
    service.listar(20, 20).subscribe(value => result = value);
    const req = http.expectOne('/api/cliente/historial-compras?offset=20&limit=20');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.transferCache).toBe(false);
    expect(req.request.body).toBeNull();
    req.flush({ ...historial, total: 40, offset: 20, token: 'private' });
    expect(result).toEqual({ ...historial, total: 40, offset: 20 });
  });
  it('conserva decimales y acepta opcionales omitidos por FastAPI', () => {
    let result: unknown;
    service.detalle(11).subscribe(value => result = value);
    const req = http.expectOne('/api/cliente/historial-compras/11');
    expect(req.request.method).toBe('GET');
    req.flush({ ...compra, pago: undefined, estadoPago: undefined, nit: undefined });
    expect(result).toMatchObject({ total: '180.00', pago: null, items: [{ precioUnitario: '100.00' }] });
  });
  it.each([401, 403, 404, 503])('propaga HTTP %s sin simular un historial vacío', status => {
    const error = vi.fn(), next = vi.fn();
    service.listar().subscribe({ error, next });
    http.expectOne('/api/cliente/historial-compras?offset=0&limit=20').flush({}, { status, statusText: 'Error' });
    expect(error).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });
});
describe('CU15 SSR', () => {
  it('no consulta datos privados en servidor', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PLATFORM_ID, useValue: 'server' }] });
    const service = TestBed.inject(HistorialService);
    service.listar().subscribe(); service.detalle(11).subscribe();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
