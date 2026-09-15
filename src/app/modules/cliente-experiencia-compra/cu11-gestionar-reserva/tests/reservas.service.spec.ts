import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { ReservasService } from '../services/reservas.service';
import { horarios, list, reserva, sucursales } from './reserva.fixtures';

describe('CU11 servicio y privacidad', () => {
  let service: ReservasService; let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(ReservasService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  it('crea sin identidad y con cookie', () => {
    let result: unknown;
    service.crear({ nroSuc: 1, fechaReserva: '2026-09-20', horaAtencion: '10:00',
      items: [{ idVar: ' var-001 ', cantidad: 2 }], idUsuarioCl: 'otro' } as never).subscribe(value => result = value);
    const req = http.expectOne('/api/cliente/reservas');
    expect(req.request.method).toBe('POST');
    // El propietario jamás viaja al backend: se resuelve desde la sesión.
    expect(req.request.body).toEqual({ nroSuc: 1, fechaReserva: '2026-09-20', horaAtencion: '10:00',
      items: [{ idVar: 'var-001', cantidad: 2 }] });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1');
    req.flush({ ...reserva, token: 'forbidden' });
    expect(result).toEqual(reserva); expect(JSON.stringify(result)).not.toContain('forbidden');
  });
  it('lista con estado y pagina', () => {
    let result: unknown;
    service.listar({ offset: 20, limit: 10, estado: 'pendiente' }).subscribe(value => result = value);
    const req = http.expectOne(r => r.url === '/api/cliente/reservas');
    expect(req.request.params.keys().sort()).toEqual(['estado', 'limit', 'offset']);
    req.flush(list); expect(result).toEqual(list);
  });
  it('detalle y cancelación usan el número en la ruta', () => {
    service.detalle(7).subscribe();
    http.expectOne('/api/cliente/reservas/7');
    service.cancelar(7).subscribe();
    const req = http.expectOne('/api/cliente/reservas/7/cancelar');
    expect(req.request.method).toBe('PATCH');
  });
  it('sucursales y horarios de referencia', () => {
    service.sucursales().subscribe();
    http.expectOne('/api/cliente/sucursales').flush({ items: sucursales, total: 2 });
    service.horarios(1).subscribe();
    http.expectOne('/api/cliente/sucursales/1/horarios').flush(horarios);
  });
  it.each([401, 403, 404, 409, 422])('propaga HTTP %s sin éxito falso', status => {
    const failed = vi.fn(); service.cancelar(7).subscribe({ error: failed });
    http.expectOne('/api/cliente/reservas/7/cancelar').flush({}, { status, statusText: 'Rejected' });
    expect(failed).toHaveBeenCalledOnce();
  });
});

describe('CU11 servicio SSR', () => {
  it('no hace ninguna petición privada en servidor', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(ReservasService);
    service.listar({ offset: 0, limit: 20 }).subscribe(); service.detalle(7).subscribe();
    service.crear({ nroSuc: 1, fechaReserva: '2026-09-20', horaAtencion: '10:00', items: [] }).subscribe();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
