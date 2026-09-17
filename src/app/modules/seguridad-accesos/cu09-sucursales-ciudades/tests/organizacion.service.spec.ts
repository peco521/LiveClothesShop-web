import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { Alta, Cambios, Entidad } from '../models/organizacion.models';
import { OrganizacionService } from '../services/organizacion.service';
import { organizacionError } from '../services/organizacion-error';
import { detalleDTO } from '../../cu08-bitacora/services/bitacora-dto';
import { ciudad, sucursal } from './organizacion.fixtures';

describe('CU09 HTTP aislado', () => {
  let http: HttpTestingController;
  let service: OrganizacionService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController); service = TestBed.inject(OrganizacionService);
  });
  afterEach(() => http.verify());
  it.each(['ciudades', 'sucursales'] as Entidad[])('lista %s con filtros permitidos y sin transferencia SSR', kind => {
    const callback = vi.fn(); service.listar(kind, { offset: 20, limit: 20, q: ' A%_/B ', idCiud: 0, estado: 'inactivo' }).subscribe(callback);
    const req = http.expectOne(r => r.url === '/api/admin/' + kind);
    expect(req.request.method).toBe('GET'); expect(req.request.withCredentials).toBe(true); expect(req.request.transferCache).toBe(false);
    expect(req.request.params.get('q')).toBe('A%_/B'); expect(req.request.params.get('offset')).toBe('20');
    expect(req.request.params.get('idCiud')).toBe(kind === 'sucursales' ? '0' : null);
    expect(req.request.params.get('estado')).toBe(kind === 'sucursales' ? 'inactivo' : null);
    const row = kind === 'ciudades' ? ciudad : sucursal;
    req.flush({ items: [{ ...row, unexpected: 'discard' }], total: 21, offset: 20, limit: 20, unexpected: 'discard' });
    expect(callback).toHaveBeenCalledExactlyOnceWith({ items: [row], total: 21, offset: 20, limit: 20 });
  });
  it.each(['ciudades', 'sucursales'] as Entidad[])('detalle y mutaciones %s usan contratos y allowlists', kind => {
    const row = kind === 'ciudades' ? ciudad : sucursal;
    service.detalle(kind, -1).subscribe(); const detail = http.expectOne('/api/admin/' + kind + '/-1'); expect(detail.request.method).toBe('GET'); detail.flush(row);
    const input = { id: -32768, nro: 123, nombre: ' Nueva ', direccion: ' Calle ', estado: 'inactivo', idCiud: 0, empleados: ['forbidden'] };
    service.crear(kind, input as Alta).subscribe(); const create = http.expectOne('/api/admin/' + kind);
    expect(create.request.method).toBe('POST'); expect(create.request.headers.get('X-CSRF-Protection')).toBe('1'); expect(create.request.withCredentials).toBe(true);
    expect(create.request.body).toEqual(kind === 'ciudades' ? { nombre: 'Nueva' } : { nombre: 'Nueva', direccion: 'Calle', estado: 'inactivo', idCiud: 0 }); create.flush(row);
    service.editar(kind, 0, input as Cambios).subscribe(); const edit = http.expectOne('/api/admin/' + kind + '/0');
    expect(edit.request.method).toBe('PATCH'); expect(edit.request.headers.get('X-CSRF-Protection')).toBe('1');
    expect(edit.request.body).toEqual(kind === 'ciudades' ? { nombre: 'Nueva' } : { nombre: 'Nueva', direccion: 'Calle', estado: 'inactivo', idCiud: 0 }); edit.flush(row);
  });
  it('cambio exclusivo de estado no envía nombre, empleados ni DELETE', () => {

    service.editar('sucursales', 1, { estado: 'inactivo' }).subscribe(); const req = http.expectOne('/api/admin/sucursales/1');
    expect(req.request.method).toBe('PATCH'); expect(req.request.body).toEqual({ estado: 'inactivo' }); req.flush(sucursal);
  });
  it.each([401, 403, 404, 409, 422, 500])('propaga HTTP %s y ofrece mensaje seguro', status => {

    const error = vi.fn(); service.editar('ciudades', 0, { nombre: 'Otra' }).subscribe({ error });
    http.expectOne('/api/admin/ciudades/0').flush({ error: { message: 'private-marker' } }, { status, statusText: 'Failure' });
    expect(error).toHaveBeenCalledOnce(); const message = organizacionError(error.mock.calls[0][0]);
    expect(message.length).toBeGreaterThan(10); expect(message).not.toContain('private-marker');
  });
  it.each(['ciudad_creada', 'ciudad_actualizada', 'sucursal_creada', 'sucursal_actualizada', 'sucursal_estado_actualizado'])('CU08 reconoce evento real %s', accion => {
    const dto = detalleDTO({ id: '1', usuario_id: 'synthetic', fecha: '2026-09-12T10:00:00.000000Z', accion, ip: null, detalles: { resultado: 'exito' } });
    expect(dto.accion).toBe(accion); expect(dto.detalles).toEqual({ resultado: 'exito' });
  });
});

describe('CU09 horarios HTTP', () => {
  it('envía y recibe horarios usando únicamente apertura y cierre', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(OrganizacionService); const http = TestBed.inject(HttpTestingController);
    const callback = vi.fn(); const horarios = [{ horaIni: '08:00:00', horaFin: '18:00:00', idaten: 12 }];
    service.editar('sucursales', 1, { horarios }).subscribe(callback);
    const req = http.expectOne('/api/admin/sucursales/1');
    expect(req.request.body).toEqual({ horarios: [{ horaIni: '08:00:00', horaFin: '18:00:00' }] });
    req.flush({ ...sucursal, horarios });
    expect(callback).toHaveBeenCalledExactlyOnceWith({ ...sucursal, horarios: [{ horaIni: '08:00:00', horaFin: '18:00:00' }] });
    http.verify();
  });
});

describe('CU09 servidor sin HTTP', () => {
  it('ningún método consulta datos ni muta en SSR', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(OrganizacionService); const next = vi.fn();
    for (const kind of ['ciudades', 'sucursales'] as Entidad[]) {
      service.listar(kind, { offset: 0, limit: 20, q: '' }).subscribe(next); service.detalle(kind, 0).subscribe(next);
      service.crear(kind, { nombre: 'Ciudad' }).subscribe(next); service.editar(kind, 0, { nombre: 'Otra' }).subscribe(next);
    }
    expect(next).not.toHaveBeenCalled(); TestBed.inject(HttpTestingController).expectNone(() => true);
  });
  it('errores desconocidos nunca imprimen excepciones', () => {
    expect(organizacionError(new Error('private-marker'))).not.toContain('private-marker');
    expect(organizacionError(new HttpErrorResponse({ status: 0 }))).toContain('Intenta');
  });
});
