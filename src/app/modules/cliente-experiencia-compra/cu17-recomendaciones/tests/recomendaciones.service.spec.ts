import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { RecomendacionesService } from '../services/recomendaciones.service';
import { general, personalizada } from './recomendaciones.fixtures';

describe('CU17 servicio de recomendaciones', () => {
  let service: RecomendacionesService; let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(RecomendacionesService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  it('consulta las recomendaciones propias con cookie y sin id de cliente', () => {
    let result: unknown;
    service.listar().subscribe(value => result = value);
    const req = http.expectOne('/api/cliente/recomendaciones?limit=8');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual(['limit']);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.transferCache).toBe(false);
    req.flush(personalizada); expect(result).toEqual(personalizada);
  });
  it('respeta el límite solicitado', () => {
    service.listar(20).subscribe();
    http.expectOne('/api/cliente/recomendaciones?limit=20').flush(general);
  });
  it('aplica allowlist de la tarjeta y de las razones', () => {
    let result: unknown;
    service.listar().subscribe(value => result = value);
    http.expectOne('/api/cliente/recomendaciones?limit=8').flush({
      tipo: 'personalizada', mensaje: personalizada.mensaje, total: 1,
      items: [{ ...personalizada.items[0], token: 'forbidden', idCliente: 'otro-cliente' }],
      perfil: { modelos: { Deportiva: 12 } },
    });
    expect(result).toEqual({ ...personalizada, total: 1, items: [personalizada.items[0]] });
    expect(JSON.stringify(result)).not.toContain('forbidden');
    expect(JSON.stringify(result)).not.toContain('otro-cliente');
  });
  it('acepta una respuesta sin recomendaciones', () => {
    let result: unknown;
    service.listar().subscribe(value => result = value);
    http.expectOne('/api/cliente/recomendaciones?limit=8').flush({ tipo: 'general', mensaje: 'x', total: 0, items: [] });
    expect(result).toEqual({ tipo: 'general', mensaje: 'x', total: 0, items: [] });
  });
  it.each([401, 403, 422, 500])('propaga HTTP %s sin éxito falso', status => {
    const failed = vi.fn(); service.listar().subscribe({ error: failed });
    http.expectOne('/api/cliente/recomendaciones?limit=8').flush({}, { status, statusText: 'Rejected' });
    expect(failed).toHaveBeenCalledOnce();
  });
});

describe('CU17 servicio en servidor', () => {
  it('no hace ninguna petición privada durante SSR', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting()] });
    TestBed.inject(RecomendacionesService).listar().subscribe();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
