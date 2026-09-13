import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { BitacoraService } from '../services/bitacora.service';
import { BitacoraFiltros } from '../models/bitacora.models';
import { listado, registro } from './bitacora.fixtures';

describe('CU08 HTTP', () => {
  let service: BitacoraService, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(BitacoraService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  it('solo GET, cookies, sin CSRF ni transfer cache, filtros exactos sin extras', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem'); let result: unknown;
    service.listar({ offset: 20, limit: 10, accion: 'rol_creado', usuario_id: ' actor ', desde: registro.fecha,
      hasta: '2026-09-12T08:30:45.123456-04:00', ip: 'secret-marker' } as BitacoraFiltros).subscribe(v => result = v);
    const req = http.expectOne(r => r.url === '/api/admin/bitacora');
    expect(req.request.method).toBe('GET'); expect(req.request.withCredentials).toBe(true); expect(req.request.transferCache).toBe(false);
    expect(req.request.headers.has('X-CSRF-Protection')).toBe(false);
    expect(req.request.params.keys().sort()).toEqual(['accion', 'desde', 'hasta', 'limit', 'offset', 'usuario_id']);
    expect(req.request.params.get('usuario_id')).toBe(' actor '); expect(req.request.params.get('desde')).toBe(registro.fecha);
    req.flush({ ...listado, token: 'secret-marker' }); expect(result).toEqual(listado); expect(storage).not.toHaveBeenCalled();
  });
  it('detalle bigint exacto, DTO limpio y sin fetch de usuario', () => {
    let value: unknown; service.detalle(registro.id).subscribe(v => value = v);
    const req = http.expectOne('/api/admin/bitacora/' + registro.id); expect(req.request.method).toBe('GET');
    req.flush({ ...registro, token: 'secret-marker', detalles: { resultado: 'exito', rol: 'secret-marker' } });
    expect(value).toEqual(registro); http.expectNone(r => r.url.includes('/usuarios'));
  });
  it('ID inválido no envía HTTP ni refleja valor', () => {
    const failed = vi.fn(); service.detalle('secret-marker').subscribe({ error: failed });
    expect(failed.mock.calls[0][0].status).toBe(422); expect(JSON.stringify(failed.mock.calls)).not.toContain('secret-marker'); http.expectNone(() => true);
  });
  it.each([401, 403, 404, 422])('propaga HTTP %s', status => {
    const failed = vi.fn(); service.detalle(registro.id).subscribe({ error: failed });
    http.expectOne('/api/admin/bitacora/' + registro.id).flush({}, { status, statusText: 'Rejected' }); expect(failed).toHaveBeenCalledOnce();
  });
  it('cancela GET y no conserva caché de resultados', () => {
    const subscription = service.listar({ offset: 0, limit: 20 }).subscribe();
    const req = http.expectOne('/api/admin/bitacora?offset=0&limit=20'); subscription.unsubscribe(); expect(req.cancelled).toBe(true);
    service.listar({ offset: 0, limit: 20 }).subscribe(); http.expectOne('/api/admin/bitacora?offset=0&limit=20').flush(listado);
  });
  it('DTO malformado produce error seguro sin conservar valores', () => {
    const failed = vi.fn(); service.detalle(registro.id).subscribe({ error: failed });
    http.expectOne('/api/admin/bitacora/' + registro.id).flush({ ...registro, fecha: 'secret-marker' });
    expect(failed.mock.calls[0][0].message).toBe('Respuesta de bitácora inválida');
  });
});
describe('CU08 HTTP SSR', () => {
  it('no solicita listado, detalle ni validación de ID en servidor', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(BitacoraService);
    service.listar({ offset: 0, limit: 20 }).subscribe(); service.detalle(registro.id).subscribe(); service.detalle('invalid').subscribe();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
