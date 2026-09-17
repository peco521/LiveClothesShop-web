import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { ClientesService } from '../services/clientes.service';
import { ClienteEditar } from '../models/cliente.models';
import { customer, list } from './cliente.fixtures';

describe('CU07 servicio y privacidad', () => {
  let service: ClientesService; let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(ClientesService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  it('lista solo filtros permitidos con cookie y sin transfer cache', () => {
    let result: unknown;
    service.listar({ offset: 20, limit: 10, q: ' Ana ' }).subscribe(value => result = value);
    const req = http.expectOne(r => r.url === '/api/admin/clientes');
    expect(req.request.params.keys().sort()).toEqual(['limit', 'offset', 'q']);
    expect(req.request.params.get('q')).toBe('Ana'); expect(req.request.params.has('activo')).toBe(false);
    expect(req.request.params.get('offset')).toBe('20'); expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.withCredentials).toBe(true); expect(req.request.transferCache).toBe(false);
    req.flush({ ...list, token: 'forbidden', items: [{ ...customer, hash: 'forbidden', contrasena: 'forbidden', cliente: { ...customer.cliente, proporciones: 'forbidden' } }] });
    expect(result).toEqual(list); expect(JSON.stringify(result)).not.toContain('forbidden');
  });
  it('omite filtros vacíos y conserva nombres nulos', () => {
    let result: unknown;
    service.listar({ offset: 0, limit: 20, q: ' ' }).subscribe(value => result = value);
    const req = http.expectOne('/api/admin/clientes?offset=0&limit=20');
    req.flush({ ...list, items: [{ ...customer, nombres: null }] });
    expect(result).toEqual({ ...list, items: [{ ...customer, nombres: null }] });
  });
  it('detalle codifica ID y aplica allowlist', () => {
    let result: unknown;
    service.detalle('user/id').subscribe(value => result = value);
    http.expectOne('/api/admin/clientes/user%2Fid').flush({ ...customer, token: 'forbidden' });
    expect(result).toEqual(customer);
  });
  it('edita exclusivamente datos personales sin persistir información', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const input = { correo: ' NUEVO@EXAMPLE.COM ', telefono: ' 123 ', estado: 'casual', proporciones: {},
      activo: false, nroRol: 'admin', tipo: 'A', cod_cl: 'otro', contrasena: 'forbidden', permisos: ['CU07'] } as ClienteEditar;
    service.editar('cliente-1', input).subscribe();
    const req = http.expectOne('/api/admin/clientes/cliente-1');
    expect(req.request.method).toBe('PATCH'); expect(req.request.body).toEqual({ correo: 'nuevo@example.com', telefono: '123' });
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1'); expect(req.request.transferCache).toBe(false);
    req.flush(customer); expect(storage).not.toHaveBeenCalled();
  });
  it('no expone cambio de activación y descarta activo del detalle', () => {
    let result: unknown;
    service.detalle(customer.idUsuario).subscribe(value => result = value);
    http.expectOne('/api/admin/clientes/cliente-1').flush({ ...customer, activo: true });
    expect(result).toEqual(customer);
    expect(service).not.toHaveProperty('estado');
  });
  it.each([401, 403, 404, 409, 422])('propaga HTTP %s sin éxito falso', status => {
    const failed = vi.fn(); service.editar('cliente-1', { telefono: '123' }).subscribe({ error: failed });
    http.expectOne('/api/admin/clientes/cliente-1').flush({}, { status, statusText: 'Rejected' }); expect(failed).toHaveBeenCalledOnce();
  });
  it('desuscripción cancela la petición HTTP', () => {
    const subscription = service.detalle('cliente-1').subscribe();
    const req = http.expectOne('/api/admin/clientes/cliente-1'); subscription.unsubscribe(); expect(req.cancelled).toBe(true);
  });
});

describe('CU07 servicio SSR', () => {
  it('no hace ninguna petición privada en servidor', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(ClientesService);
    service.listar({ offset: 0, limit: 20 }).subscribe(); service.detalle('cliente-1').subscribe();
    service.editar('cliente-1', { telefono: '123' }).subscribe();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
