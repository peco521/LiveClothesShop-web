import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { apiInterceptor } from '../../../core/interceptors/api.interceptor';
import { AuthService } from './auth.service';
import { PwaSyncService } from '../../../core/offline/pwa-sync.service';
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
      { provide: PwaSyncService, useValue: { pause: vi.fn(), activate: vi.fn() } },
    ] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify(); vi.restoreAllMocks();
    localStorage.removeItem('fashionstore-offline-cashier-session-v1');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

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
    const req = http.expectOne('/api/auth/login/cliente');
    expect(req.request.body).toEqual({ correo: 'ana@example.com', contrasena: 'Secreta de prueba' });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1');
    req.flush({ ...session, token: 'no-retener', contrasena: 'no-retener', digest: 'no-retener' });
    expect(service.session()).toEqual(session);
    expect(local).not.toHaveBeenCalled();
  });

  it('login interno conserva tipo y usa endpoint separado', () => {
    const internal = { ...session, usuario: { ...session.usuario, tipo: 'A' as const },
      rol: { nro: 'A', descripcion: 'Administrador' } };
    service.login({ correo: 'admin@example.com', contrasena: 'Anterior123*' }, 'admin').subscribe();
    const req = http.expectOne('/api/auth/login/admin');
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1');
    req.flush(internal);
    expect(service.session()).toEqual(internal);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    service.logout().subscribe();
    http.expectOne('/api/auth/logout').flush(null);
    expect(navigate).toHaveBeenCalledWith('/admin/login');
  });

  it('restaura la identidad CU24 cacheada cuando se recarga sin red', () => {
    const cashier: AuthResponse = { ...session, empresa: 'manaco',
      usuario: { ...session.usuario, tipo: 'E' }, permisos: ['CU24'],
      expiraEn: '2099-01-01T00:00:00Z' };
    service.login({ empresa: 'manaco', correo: 'cashier@example.com', contrasena: 'Prueba' }, 'admin').subscribe();
    http.expectOne('/api/auth/login/admin').flush(cashier);
    const stored = JSON.parse(localStorage.getItem('fashionstore-offline-cashier-session-v1')!);
    expect(stored.usuario.idUsuario).toBe(cashier.usuario.idUsuario);
    expect(stored).not.toHaveProperty('token');
    expect(stored).not.toHaveProperty('contrasena');

    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    let restored: AuthResponse | null | undefined;
    service.restore().subscribe(value => restored = value);
    http.expectOne('/api/auth/me').error(new ProgressEvent('error'));
    expect(restored?.offlineOnly).toBe(true);
    expect(restored?.empresa).toBe('manaco');
    expect(service.session()?.offlineOnly).toBe(true);
  });

  it('cliente puede reabrir su descarga sin red sin obtener privilegios de caja', () => {
    const client: AuthResponse = { ...session, empresa:'manaco',usuario:{...session.usuario,tipo:'C'},expiraEn:'2099-01-01T00:00:00Z' };
    service.login({empresa:'manaco',correo:'test@example.com',contrasena:'Prueba'}).subscribe();
    http.expectOne('/api/auth/login/cliente').flush({...client,token:'no-retener'});
    Object.defineProperty(navigator,'onLine',{value:false,configurable:true});
    let restored:AuthResponse|null|undefined;
    service.restore().subscribe(value=>restored=value);
    http.expectOne('/api/auth/me').error(new ProgressEvent('error'));
    expect(restored?.offlineOnly).toBe(true);expect(restored?.usuario.tipo).toBe('C');
    expect(restored?.permisos).not.toContain('CU24');
    expect(localStorage.getItem('fashionstore-offline-cashier-session-v1')).not.toContain('no-retener');
  });

  it('401 online y snapshot expirado no se confunden con operación offline autorizada', () => {
    const key='fashionstore-offline-cashier-session-v1';
    localStorage.setItem(key,JSON.stringify({...session,empresa:'manaco',usuario:{...session.usuario,tipo:'C'},expiraEn:'2099-01-01T00:00:00Z'}));
    service.restore().subscribe();http.expectOne('/api/auth/me').flush({}, {status:401,statusText:'Expired'});
    expect(service.session()).toBeNull();expect(localStorage.getItem(key)).toBeNull();
    localStorage.setItem(key,JSON.stringify({...session,empresa:'manaco',usuario:{...session.usuario,tipo:'C'},expiraEn:'2020-01-01T00:00:00Z'}));
    Object.defineProperty(navigator,'onLine',{value:false,configurable:true});
    service.restore().subscribe({error:()=>undefined});http.expectOne('/api/auth/me').error(new ProgressEvent('error'));
    expect(service.session()).toBeNull();expect(localStorage.getItem(key)).toBeNull();
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
    http.expectOne('/api/auth/login/cliente').flush(session);
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
    http.expectOne('/api/auth/login/cliente').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(rejected).toHaveBeenCalledOnce();
    expect(service.session()).toBeNull();
  });

  it('una restauración anterior no sobrescribe un login posterior', () => {
    service.restore().subscribe();
    const restore = http.expectOne('/api/auth/me');
    service.login({ correo: 'ana@example.com', contrasena: 'Prueba' }).subscribe();
    http.expectOne('/api/auth/login/cliente').flush(session);
    restore.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(service.session()).toEqual(session);
  });

  it.each(['saas', 'admin'] as const)('libera el login %s cuando el servidor no responde', portal => {
    vi.useFakeTimers();
    try {
      const rejected = vi.fn();
      service.login({ correo: 'test@example.com', contrasena: 'Test' }, portal).subscribe({ error: rejected });
      const request = http.expectOne(`/api/auth/login/${portal}`);
      vi.advanceTimersByTime(20001);
      expect(request.cancelled).toBe(true);
      expect(rejected).toHaveBeenCalledOnce();
      expect(service.session()).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it('limita la espera de restauracion de sesion que usan los guards', () => {
    vi.useFakeTimers();
    try {
      const rejected = vi.fn();
      service.restore().subscribe({ error: rejected });
      const request = http.expectOne('/api/auth/me');
      vi.advanceTimersByTime(20001);
      expect(request.cancelled).toBe(true);
      expect(rejected).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
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
    expect(remove).toHaveBeenCalledExactlyOnceWith('fashionstore-offline-cashier-session-v1');
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
    http.expectOne('/api/auth/login/cliente').flush(session);
    logout.flush(null, { status: 204, statusText: 'No Content' });
    expect(service.session()).toEqual(session);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('consulta la lista de empresas disponibles para el acceso administrativo', () => {
    let companies: Array<{ codigo: string; nombre: string }> = [];
    service.listCompanies().subscribe(items => companies = items);
    const req = http.expectOne('/api/auth/empresas');
    expect(req.request.method).toBe('GET');
    req.flush([{ codigo: 'piloto', nombre: 'Empresa Piloto (datos del Parcial 1)' }]);
    expect(companies).toEqual([{ codigo: 'piloto', nombre: 'Empresa Piloto (datos del Parcial 1)' }]);
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
