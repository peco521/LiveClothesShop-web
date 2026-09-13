import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { apiInterceptor } from '../../../core/interceptors/api.interceptor';
import { AuthService } from './auth.service';
import { AuthResponse, RegistroRequest } from '../models/auth.models';

describe('AuthService + interceptor HTTP', () => {
  let service: AuthService;
  let http: HttpTestingController;
  const registration: RegistroRequest = {
    ci: '123', nombres: 'Ana', apellidoPat: 'Pérez', apellidoMat: 'Gómez', sexo: 'F',
    correo: ' ANA@EXAMPLE.COM ', telefono: '70000000', direccion: 'Calle 1',
    fechaNac: '2000-01-01', contrasena: 'Una frase de prueba 123',
  };
  const session: AuthResponse = {
    usuario: { idUsuario: 'user-1', nombres: 'Ana', correo: 'ana@example.com' },
    rol: { nro: 'cliente', descripcion: 'Cliente' }, permisos: [], expiraEn: '2030-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting(),
      provideRouter([]),
    ] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('CU04 envía correo normalizado sin sesión nueva', () => {
    service.requestRecovery(' ANA@EXAMPLE.COM ').subscribe();
    const req = http.expectOne('/api/auth/recuperar-contrasena');
    expect(req.request.body).toEqual({ correo: 'ana@example.com' });
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1');
    expect(req.request.transferCache).toBe(false);
    req.flush({ mensaje: 'genérico' });
    expect(service.session()).toBeNull();
  });

  it('CU04 envía token solo en body sin storage ni autologin', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    service.resetPassword('a'.repeat(43), 'Una frase nueva de prueba').subscribe();
    const req = http.expectOne('/api/auth/restablecer-contrasena');
    expect(req.request.body).toEqual({ token: 'a'.repeat(43), nueva_contrasena: 'Una frase nueva de prueba' });
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1');
    expect(req.request.transferCache).toBe(false);
    req.flush({ mensaje: 'OK' });
    expect(service.session()).toBeNull();
    expect(storage).not.toHaveBeenCalled();
  });

  it('registra con allowlist, endpoint, credenciales y CSRF sin crear sesión', () => {
    service.register({ ...registration, rol: 'admin', tipo: 'A', permisos: ['all'] } as RegistroRequest).subscribe();
    const req = http.expectOne('/api/auth/registro');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ...registration, correo: 'ana@example.com' });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1');
    expect(req.request.headers.has('Origin')).toBe(false);
    expect(req.request.transferCache).toBe(false);
    req.flush({ idUsuario: 'user-1', correo: 'ana@example.com', mensaje: 'OK' });
    expect(service.session()).toBeNull();
  });

  it('login envía solo correo y contraseña; conserva únicamente respuesta pública', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    service.login({ correo: ' ANA@EXAMPLE.COM ', contrasena: 'Secreta de prueba' }).subscribe();
    const req = http.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ correo: 'ana@example.com', contrasena: 'Secreta de prueba' });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1');
    req.flush({ ...session, token: 'no-retener', contrasena: 'no-retener', digest: 'no-retener' });
    expect(service.session()).toEqual(session);
    expect(local).not.toHaveBeenCalled();
  });

  it('restaura sesión desde me sin CSRF en GET y sin transfer cache', () => {
    service.restore().subscribe();
    const req = http.expectOne('/api/auth/me');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('X-CSRF-Protection')).toBe(false);
    expect(req.request.transferCache).toBe(false);
    req.flush(session);
    expect(service.session()).toEqual(session);
  });

  it('una sesión vencida/rechazada limpia el estado público', () => {
    service.login({ correo: 'ana@example.com', contrasena: 'Prueba' }).subscribe();
    http.expectOne('/api/auth/login').flush(session);
    let restored: AuthResponse | null | undefined;
    service.restore().subscribe(value => restored = value);
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(restored).toBeNull();
    expect(service.session()).toBeNull();
  });

  it('no confunde una caída del backend con una sesión válida', () => {
    const rejected = vi.fn();
    service.restore().subscribe({ error: rejected });
    http.expectOne('/api/auth/me').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(rejected).toHaveBeenCalledOnce();
    expect(service.session()).toBeNull();
  });

  it('propaga login rechazado sin retener credenciales', () => {
    const rejected = vi.fn();
    service.login({ correo: 'ana@example.com', contrasena: 'Prueba' }).subscribe({ error: rejected });
    http.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(rejected).toHaveBeenCalledOnce();
    expect(service.session()).toBeNull();
  });

  it('una restauración anterior no sobrescribe un login posterior', () => {
    service.restore().subscribe();
    const restore = http.expectOne('/api/auth/me');
    service.login({ correo: 'ana@example.com', contrasena: 'Prueba' }).subscribe();
    http.expectOne('/api/auth/login').flush(session);
    restore.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(service.session()).toEqual(session);
  });

  it('logout usa POST protegido, limpia solo auth y redirige tras éxito', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    service.restore().subscribe();
    http.expectOne('/api/auth/me').flush(session);
    const clear = vi.spyOn(Storage.prototype, 'clear');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const cookie = vi.spyOn(document, 'cookie', 'set');
    service.logout().subscribe();
    const req = http.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.transferCache).toBe(false);
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(service.session()).toEqual(session);
    expect(navigate).not.toHaveBeenCalled();
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(service.session()).toBeNull();
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/login');
    expect(clear).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(cookie).not.toHaveBeenCalled();
  });

  it.each([401, 403, 500, 0])('logout fallido (%s) propaga error sin fingir éxito', (status) => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    service.restore().subscribe();
    http.expectOne('/api/auth/me').flush(session);
    const rejected = vi.fn();
    service.logout().subscribe({ error: rejected });
    const req = http.expectOne('/api/auth/logout');
    if (status === 0) req.error(new ProgressEvent('error'));
    else req.flush({}, { status, statusText: 'Rejected' });
    expect(rejected).toHaveBeenCalledOnce();
    expect(service.session()).toEqual(session);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('una restauración pendiente no recupera estado después de logout', () => {
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    service.restore().subscribe();
    const restore = http.expectOne('/api/auth/me');
    service.logout().subscribe();
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    restore.flush(session);
    expect(service.session()).toBeNull();
  });

  it.each([true, false])('logout invalida me iniciado durante el cierre (respuesta previa: %s)', (respondBefore) => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    service.logout().subscribe();
    const logout = http.expectOne('/api/auth/logout');
    service.restore().subscribe();
    const restore = http.expectOne('/api/auth/me');
    if (respondBefore) restore.flush(session);
    logout.flush(null, { status: 204, statusText: 'No Content' });
    if (!respondBefore) restore.flush(session);
    expect(service.session()).toBeNull();
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/login');
  });

  it('un logout anterior no borra el estado de un login posterior', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    service.logout().subscribe();
    const logout = http.expectOne('/api/auth/logout');
    service.login({ correo: 'ana@example.com', contrasena: 'Prueba' }).subscribe();
    http.expectOne('/api/auth/login').flush(session);
    logout.flush(null, { status: 204, statusText: 'No Content' });
    expect(service.session()).toEqual(session);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('no envía credenciales ni CSRF a servicios ajenos a la API', () => {
    TestBed.inject(HttpClient).post('https://other.example/api/auth/login', {}).subscribe();
    const req = http.expectOne('https://other.example/api/auth/login');
    expect(req.request.withCredentials).toBe(false);
    expect(req.request.headers.has('X-CSRF-Protection')).toBe(false);
    req.flush({});
  });
});

describe('AuthService en SSR', () => {
  it('no llama a me ni conserva una sesión de navegador en el servidor', () => {
    TestBed.configureTestingModule({ providers: [
      { provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting(),
      provideRouter([]),
    ] });
    let restored: AuthResponse | null | undefined;
    TestBed.inject(AuthService).restore().subscribe(value => restored = value);
    expect(restored).toBeNull();
    TestBed.inject(HttpTestingController).expectNone('/api/auth/me');
    TestBed.inject(HttpTestingController).verify();
  });
});
