import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { CatalogoService } from '../services/catalogo.service';
import { detail, facetas, list } from './catalogo.fixtures';

describe('CU10 servicio y privacidad', () => {
  let service: CatalogoService; let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(CatalogoService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  it('lista con filtros, cookie y sin transfer cache', () => {
    let result: unknown;
    service.listar({ offset: 0, limit: 20, q: ' Oxford ', idCat: 1, minPrecio: 50, maxPrecio: 200, soloDisponibles: true, sort: 'precio_asc' }).subscribe(value => result = value);
    const req = http.expectOne(r => r.url === '/api/catalogo/productos');
    expect(req.request.params.keys().sort()).toEqual(['idCat', 'limit', 'maxPrecio', 'minPrecio', 'offset', 'q', 'soloDisponibles', 'sort']);
    expect(req.request.params.get('q')).toBe('Oxford');
    expect(req.request.withCredentials).toBe(true); expect(req.request.transferCache).toBe(false);
    req.flush(list); expect(result).toEqual(list);
  });
  it('omite filtros indefinidos', () => {
    let result: unknown;
    service.listar({ offset: 0, limit: 20 }).subscribe(value => result = value);
    const req = http.expectOne('/api/catalogo/productos?offset=0&limit=20');
    req.flush(list); expect(result).toEqual(list);
  });
  it('detalle codifica ID y aplica allowlist', () => {
    let result: unknown;
    service.detalle('prod/001').subscribe(value => result = value);
    http.expectOne('/api/catalogo/productos/prod%2F001').flush({ ...detail, token: 'forbidden',
      variantes: [{ ...detail.variantes[0], secreto: 'forbidden' }, detail.variantes[1]] });
    expect(result).toEqual(detail); expect(JSON.stringify(result)).not.toContain('forbidden');
  });
  it('faceta usa allowlist', () => {
    let result: unknown;
    service.faceta('categorias').subscribe(value => result = value);
    http.expectOne('/api/catalogo/categorias').flush({ ...facetas, items: [{ ...facetas.items[0], extra: 'forbidden' }, facetas.items[1]] });
    expect(result).toEqual(facetas);
  });
  it.each([401, 403, 404, 422])('propaga HTTP %s sin éxito falso', status => {
    const failed = vi.fn(); service.detalle('prod-001').subscribe({ error: failed });
    http.expectOne('/api/catalogo/productos/prod-001').flush({}, { status, statusText: 'Rejected' }); expect(failed).toHaveBeenCalledOnce();
  });
});

describe('CU10 servicio SSR', () => {
  it('no hace ninguna petición privada en servidor', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(CatalogoService);
    service.listar({ offset: 0, limit: 20 }).subscribe();
    service.detalle('prod-001').subscribe();
    service.faceta('marcas').subscribe();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
