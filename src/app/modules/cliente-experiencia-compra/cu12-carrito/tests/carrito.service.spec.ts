import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { CarritoService } from '../services/carrito.service';
import { carrito, vacio } from './carrito.fixtures';

describe('CU12 servicio, precios del servidor y estado real', () => {
  let service: CarritoService; let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(CarritoService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  it('obtiene y publica el resumen real', () => {
    let result: unknown;
    service.obtener().subscribe(value => result = value);
    http.expectOne('/api/cliente/carrito').flush(carrito);
    expect(result).toEqual(carrito);
    expect(service.estado()).toEqual(carrito);
  });
  it('agrega solo variante y cantidad, sin precios', () => {
    let result: unknown;
    service.agregar({ idVar: ' var-001 ', cantidad: 2, precio: 1 } as never).subscribe(value => result = value);
    const req = http.expectOne('/api/cliente/carrito/items');
    expect(req.request.method).toBe('POST');
    // Ni precio ni totales viajan: el servidor calcula todo.
    expect(req.request.body).toEqual({ idVar: 'var-001', cantidad: 2 });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1');
    req.flush({ ...carrito, token: 'forbidden' });
    expect(result).toEqual(carrito); expect(JSON.stringify(result)).not.toContain('forbidden');
    expect(service.estado()?.cantidadItems).toBe(3);
  });
  it('modifica con cantidad absoluta y elimina por ID', () => {
    service.modificar(1, 3).subscribe();
    const patch = http.expectOne('/api/cliente/carrito/items/1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ cantidad: 3 });
    patch.flush(carrito);
    service.eliminar(2).subscribe();
    const del = http.expectOne('/api/cliente/carrito/items/2');
    expect(del.request.method).toBe('DELETE');
    del.flush(vacio);
    expect(service.estado()).toEqual(vacio);
  });
  it.each([401, 403, 404, 409, 422])('propaga HTTP %s sin éxito falso', status => {
    const failed = vi.fn(); service.agregar({ idVar: 'v1', cantidad: 1 }).subscribe({ error: failed });
    http.expectOne('/api/cliente/carrito/items').flush({}, { status, statusText: 'Rejected' });
    expect(failed).toHaveBeenCalledOnce();
  });
});

describe('CU12 servicio SSR', () => {
  it('no hace ninguna petición privada en servidor', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(CarritoService);
    service.obtener().subscribe(); service.agregar({ idVar: 'v1', cantidad: 1 }).subscribe();
    service.modificar(1, 2).subscribe(); service.eliminar(1).subscribe();
    TestBed.inject(HttpTestingController).expectNone(() => true);
    expect(service.estado()).toBeNull();
  });
});
