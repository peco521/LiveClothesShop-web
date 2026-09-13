import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RenderMode } from '@angular/ssr';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { routes } from '../../../../app.routes';
import { serverRoutes } from '../../../../app.routes.server';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { AuthResponse } from '../../models/auth.models';
import { AuthService } from '../../services/auth.service';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { AdminLayout } from '../../shared/layout/admin-layout';
import { EmpleadoFormularioComponent } from '../components/empleado-formulario';
import { EmpleadoCrear, EmpleadoOpciones, UsuarioDetalle } from '../models/usuario.models';
import { EmpleadoCrearPage } from '../pages/empleado-crear/empleado-crear';
import { EmpleadoEditarPage } from '../pages/empleado-editar/empleado-editar';
import { UsuarioDetallePage } from '../pages/usuario-detalle/usuario-detalle';
import { UsuariosListaPage } from '../pages/usuarios-lista/usuarios-lista';
import { usuarioError } from '../services/usuario-error';
import { UsuariosService } from '../services/usuarios.service';

const input: EmpleadoCrear = { ci: '123', nombres: 'Ana', apellidoPat: 'Pérez', apellidoMat: 'Gómez', sexo: 'F',
  correo: 'empleado@example.com', telefono: '70000000', direccion: 'Calle de prueba', fechaNac: '2000-01-01',
  nroRol: 'laboral', cod_emp: 'EMP001', cargo: 'Cajero', nroSuc: 1, contrasena: 'Solo una frase ficticia 123' };
const employee: UsuarioDetalle = { idUsuario: 'empleado-1', ci: input.ci, nombres: input.nombres,
  apellidoPat: input.apellidoPat, apellidoMat: input.apellidoMat, sexo: input.sexo, correo: input.correo,
  telefono: input.telefono, direccion: input.direccion, fechaNac: input.fechaNac, nroRol: input.nroRol,
  tipo: 'E', activo: true, rol: { nro: 'laboral', descripcion: 'Empleado' },
  empleado: { cod_emp: 'EMP001', cargo: 'Cajero', nroSuc: 1 }, admin: null };
const administrator: UsuarioDetalle = { ...employee, idUsuario: 'admin-1', tipo: 'A', empleado: null,
  admin: { cod_adm: 'ADM001' }, nroRol: 'gestor', rol: { nro: 'gestor', descripcion: 'Gestor' } };
const options: EmpleadoOpciones = { roles: [employee.rol, administrator.rol], ciudades: [{ id: 1, nombre: 'Santa Cruz' }, { id: 2, nombre: 'La Paz' }],
  sucursales: [{ nro: 1, nombre: 'Sucursal Central', direccion: 'Calle Central', estado: 'activo', idCiud: 1, ciudad: { id: 1, nombre: 'Santa Cruz' } },
    { nro: 2, nombre: 'Sucursal Norte', direccion: 'Calle Norte', estado: 'inactivo', idCiud: 2, ciudad: { id: 2, nombre: 'La Paz' } }] };
const session: AuthResponse = { usuario: { idUsuario: 'admin-1', nombres: 'Admin', correo: 'admin@example.com' },
  rol: administrator.rol, permisos: ['CU05'], expiraEn: '2030-01-01T00:00:00Z' };
const list = { items: [administrator, employee], total: 2, offset: 0, limit: 20 };

describe('CU05 servicio HTTP y privacidad', () => {
  let service: UsuariosService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(UsuariosService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('lista con paginación, filtros, cookie y sin transfer cache', () => {
    let result: unknown;
    service.listar({ offset: 20, limit: 10, q: ' Ana ', tipo: 'E', activo: false }).subscribe(value => result = value);
    const req = http.expectOne(request => request.url === '/api/admin/usuarios');
    expect(req.request.params.get('offset')).toBe('20'); expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('q')).toBe('Ana'); expect(req.request.params.get('tipo')).toBe('E');
    expect(req.request.params.get('activo')).toBe('false'); expect(req.request.withCredentials).toBe(true);
    expect(req.request.transferCache).toBe(false);
    req.flush({ ...list, items: [{ ...employee, hash: 'forbidden-hash', contrasena: 'forbidden-value' }] });
    expect(JSON.stringify(result)).not.toContain('forbidden');
  });

  it('crea solo el payload permitido y normaliza correo sin persistir secretos', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    let result: unknown;
    service.crear({ ...input, correo: ' EMPLEADO@EXAMPLE.COM ', tipo: 'A', permisos: ['CU06'] } as EmpleadoCrear).subscribe(value => result = value);
    const req = http.expectOne('/api/admin/empleados');
    expect(req.request.method).toBe('POST'); expect(req.request.body).toEqual(input);
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1'); expect(req.request.transferCache).toBe(false);
    req.flush({ ...employee, contrasena: input.contrasena, token: 'forbidden-token', hash: 'forbidden-hash' });
    expect(result).toEqual(employee); expect(storage).not.toHaveBeenCalled();
  });

  it('edita sin enviar contraseña, tipo, estado ni permisos', () => {
    service.editar(employee.idUsuario, { ...input, tipo: 'A', activo: false } as EmpleadoCrear).subscribe();
    const req = http.expectOne('/api/admin/empleados/empleado-1');
    expect(req.request.method).toBe('PATCH');
    for (const key of ['contrasena', 'tipo', 'activo', 'permisos']) expect(req.request.body[key]).toBeUndefined();
    req.flush(employee);
  });

  it('consulta detalle y cambia estado con booleano explícito', () => {
    service.detalle('user/id').subscribe(); http.expectOne('/api/admin/usuarios/user%2Fid').flush(employee);
    service.estado(employee.idUsuario, false).subscribe();
    const req = http.expectOne('/api/admin/usuarios/empleado-1/estado');
    expect(req.request.method).toBe('PATCH'); expect(req.request.body).toEqual({ activo: false });
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1'); req.flush({ ...employee, activo: false });
  });

  it('consulta opciones existentes y filtra sucursales por ciudad', () => {
    let result: unknown;
    service.opciones().subscribe(value => result = value);
    http.expectOne('/api/admin/usuarios/roles').flush(options.roles);
    http.expectOne('/api/admin/empleados/ciudades').flush(options.ciudades);
    http.expectOne('/api/admin/empleados/sucursales').flush(options.sucursales);
    expect(result).toEqual(options);
    service.sucursales(2).subscribe(); http.expectOne('/api/admin/empleados/sucursales?idCiud=2').flush([]);
  });

  it.each([401, 403, 409, 422])('propaga HTTP %s sin convertirlo en éxito', status => {
    const rejected = vi.fn(); service.crear(input).subscribe({ error: rejected });
    http.expectOne('/api/admin/empleados').flush({ error: { code: 'datos_invalidos' } }, { status, statusText: 'Rejected' });
    expect(rejected).toHaveBeenCalledOnce();
  });
});

describe('CU05 SSR', () => {
  it('no ejecuta ninguna petición privada en servidor', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(UsuariosService);
    service.listar({ offset: 0, limit: 20 }).subscribe(); service.detalle('1').subscribe();
    service.crear(input).subscribe(); service.editar('1', { cargo: 'Otro' }).subscribe(); service.estado('1', false).subscribe(); service.opciones().subscribe();
    TestBed.inject(HttpTestingController).expectNone(() => true);
    expect(serverRoutes[0]).toEqual({ path: 'admin/**', renderMode: RenderMode.Client });
  });
  it('guard falla cerrado sin restaurar sesión en SSR', () => {
    const auth = { restore: vi.fn() };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }, { provide: AuthService, useValue: auth }] });
    const result = TestBed.runInInjectionContext(() => permissionGuard('CU05')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    expect(result).toBe(false); expect(auth.restore).not.toHaveBeenCalled();
  });
});

describe('CU05 formulario reutilizable', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [EmpleadoFormularioComponent] }));
  function form(edit = false) {
    const fixture = TestBed.createComponent(EmpleadoFormularioComponent);
    fixture.componentRef.setInput('opciones', options);
    if (edit) fixture.componentRef.setInput('usuario', employee);
    fixture.detectChanges();
    return fixture;
  }
  it('valida campos, fechas y contraseña; no emite formularios inválidos', () => {
    const fixture = form(); const component = fixture.componentInstance; const save = vi.fn(); component.guardar.subscribe(save);
    component.submit(); expect(save).not.toHaveBeenCalled(); expect(component.form.touched).toBe(true);
    component.form.patchValue({ ...input, fechaNac: '2099-01-01', contrasena: 'short' });
    component.submit(); expect(save).not.toHaveBeenCalled();
    expect(component.form.controls.fechaNac.hasError('date')).toBe(true);
    expect(component.form.controls.contrasena.hasError('minlength')).toBe(true);
  });
  it('emite creación y limpia la contraseña inmediatamente', () => {
    const fixture = form(); const component = fixture.componentInstance; const save = vi.fn(); component.guardar.subscribe(save);
    component.form.patchValue(input); component.submit(); fixture.detectChanges();
    expect(save).toHaveBeenCalledExactlyOnceWith(input);
    expect(component.form.controls.contrasena.value).toBe('');
    expect(fixture.nativeElement.textContent).not.toContain(input.contrasena);
    expect(fixture.nativeElement.innerHTML).not.toContain(input.contrasena);
  });
  it('edita precargando datos sin campo de contraseña', () => {
    const fixture = form(true); const component = fixture.componentInstance; const save = vi.fn(); component.guardar.subscribe(save);
    expect(component.form.controls.nroSuc.value).toBe(1); expect(component.form.controls.nroRol.value).toBe('laboral');
    expect(fixture.nativeElement.querySelector('input[type=password]')).toBeNull();
    component.form.controls.cargo.setValue('Encargado'); component.submit();
    expect(save).toHaveBeenCalledOnce(); expect(save.mock.calls[0][0].cargo).toBe('Encargado');
    expect(save.mock.calls[0][0].contrasena).toBeUndefined();
  });
  it('filtra ciudad, borra sucursal incompatible y permite sucursal inactiva existente', () => {
    const fixture = form(); const component = fixture.componentInstance;
    component.form.patchValue(input); component.form.controls.ciudad.setValue(2); component.cambiarCiudad();
    expect(component.form.controls.nroSuc.value).toBeNull(); expect(component.sucursalesVisibles()).toEqual([options.sucursales[1]]);
    component.form.controls.nroSuc.setValue(2); const save = vi.fn(); component.guardar.subscribe(save); component.submit();
    expect(save).toHaveBeenCalledOnce();
  });
  it('rechaza opciones inexistentes y bloquea doble envío mientras guarda', () => {
    const fixture = form(); const component = fixture.componentInstance; const save = vi.fn(); component.guardar.subscribe(save);
    component.form.patchValue({ ...input, nroRol: 'missing', nroSuc: 999 }); component.submit(); expect(save).not.toHaveBeenCalled();
    component.form.patchValue(input); fixture.componentRef.setInput('busy', true); fixture.detectChanges(); component.submit(); expect(save).not.toHaveBeenCalled();
  });
  it.each([['ci', 101], ['nombres', 101], ['apellidoPat', 51], ['apellidoMat', 51], ['correo', 101], ['telefono', 21], ['direccion', 151], ['cod_emp', 11], ['cargo', 51]] as const)('limita %s conforme al contrato', (key, length) => {
    const fixture = form(); fixture.componentInstance.form.controls[key].setValue('x'.repeat(length));
    expect(fixture.componentInstance.form.controls[key].hasError('maxlength')).toBe(true);
  });
});

describe('CU05 páginas y navegación protegida', () => {
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(session) };
  const service = { listar: vi.fn(), detalle: vi.fn(), opciones: vi.fn(), sucursales: vi.fn(), crear: vi.fn(), editar: vi.fn(), estado: vi.fn() };
  beforeEach(() => {
    auth.restore.mockReset().mockReturnValue(of(session)); auth.session.set(session);
    service.listar.mockReset().mockReturnValue(of(list)); service.detalle.mockReset().mockReturnValue(of(employee));
    service.opciones.mockReset().mockReturnValue(of(options)); service.sucursales.mockReset().mockReturnValue(of(options.sucursales));
    service.crear.mockReset().mockReturnValue(of(employee)); service.editar.mockReset().mockReturnValue(of(employee));
    service.estado.mockReset().mockReturnValue(of({ ...employee, activo: false }));
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AuthService, useValue: auth }, { provide: UsuariosService, useValue: service }] });
  });
  afterEach(() => vi.restoreAllMocks());
  async function open<T>(path: string, type: Type<T>) {
    // Las páginas administrativas viven dentro de AdminLayout: la ruta raíz
    // activa el layout y la hoja se resuelve en su router-outlet.
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl(path, AdminLayout);
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    const page = harness.fixture.debugElement.query(By.directive(type))!.componentInstance as T;
    return { harness, page };
  }
  it('lista A/E, muestra detalle para ambos y edición solo E', async () => {
    const { harness } = await open('/admin/usuarios', UsuariosListaPage);
    expect(harness.routeNativeElement?.textContent).toContain('2 usuarios internos');
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/empleados/empleado-1/editar"]')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/empleados/admin-1/editar"]')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/usuarios/admin-1"]')).toBeTruthy();
  });
  it('envía filtros y pagina sin perder filtros aplicados', async () => {
    const { page } = await open('/admin/usuarios', UsuariosListaPage);
    page.form.patchValue({ q: 'Ana', tipo: 'E', activo: 'false', limit: 10 }); page.aplicar();
    expect(service.listar).toHaveBeenLastCalledWith({ offset: 0, limit: 10, q: 'Ana', tipo: 'E', activo: false });
    page.load(10); expect(service.listar).toHaveBeenLastCalledWith({ offset: 10, limit: 10, q: 'Ana', tipo: 'E', activo: false });
  });
  it('muestra listado vacío y bloquea paginación sin resultados', async () => {
    service.listar.mockReturnValue(of({ ...list, total: 0, items: [] }));
    const { harness } = await open('/admin/usuarios', UsuariosListaPage);
    expect(harness.routeNativeElement?.textContent).toContain('No hay usuarios');
    const buttons = harness.routeNativeElement?.querySelectorAll('nav[aria-label="Paginación"] button');
    expect(Array.from(buttons ?? []).every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  });
  it('creación desde formulario navega al detalle y no almacena secretos', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const { harness } = await open('/admin/empleados/nuevo', EmpleadoCrearPage);
    const form = harness.routeDebugElement?.query(By.directive(EmpleadoFormularioComponent)).componentInstance as EmpleadoFormularioComponent;
    form.form.patchValue(input); form.submit(); await harness.fixture.whenStable();
    expect(service.crear).toHaveBeenCalledExactlyOnceWith(input);
    expect(TestBed.inject(Router).url).toBe('/admin/usuarios/empleado-1'); expect(storage).not.toHaveBeenCalled();
  });
  it('edita E desde formulario sin contraseña y navega al detalle', async () => {
    const { harness } = await open('/admin/empleados/empleado-1/editar', EmpleadoEditarPage);
    const form = harness.routeDebugElement?.query(By.directive(EmpleadoFormularioComponent)).componentInstance as EmpleadoFormularioComponent;
    form.form.controls.cargo.setValue('Encargado'); form.submit(); await harness.fixture.whenStable();
    expect(service.editar.mock.calls[0][0]).toBe('empleado-1'); expect(service.editar.mock.calls[0][1].cargo).toBe('Encargado');
    expect(service.editar.mock.calls[0][1].contrasena).toBeUndefined(); expect(TestBed.inject(Router).url).toBe('/admin/usuarios/empleado-1');
  });
  it('no permite editar administrador por URL directa', async () => {
    service.detalle.mockReturnValue(of(administrator));
    const { harness } = await open('/admin/empleados/admin-1/editar', EmpleadoEditarPage);
    expect(harness.routeNativeElement?.textContent).toContain('Solo se pueden editar empleados');
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
  });
  it('detalle E resuelve nombre, dirección y ciudad de sucursal', async () => {
    const { harness } = await open('/admin/usuarios/empleado-1', UsuarioDetallePage);
    expect(harness.routeNativeElement?.textContent).toContain('Sucursal Central');
    expect(harness.routeNativeElement?.textContent).toContain('Santa Cruz');
    expect(harness.routeNativeElement?.textContent).toContain('Calle Central');
    expect(harness.routeNativeElement?.innerHTML).not.toContain(input.contrasena);
  });
  it('detalle A muestra su perfil y permite confirmar cambio de estado', async () => {
    service.detalle.mockReturnValue(of(administrator)); service.estado.mockReturnValue(of({ ...administrator, activo: false }));
    const { harness, page } = await open('/admin/usuarios/admin-1', UsuarioDetallePage);
    expect(harness.routeNativeElement?.textContent).toContain('ADM001');
    expect(harness.routeNativeElement?.querySelector('a[href$="/editar"]')).toBeNull();
    page.cambiarEstado(); expect(service.estado).not.toHaveBeenCalled();
    page.confirmar.set(true); page.cambiarEstado(); harness.detectChanges();
    expect(service.estado).toHaveBeenCalledExactlyOnceWith('admin-1', false); expect(page.usuario()?.activo).toBe(false);
  });
  it('activa empleado inactivo y evita solicitudes duplicadas', async () => {
    service.detalle.mockReturnValue(of({ ...employee, activo: false })); const pending = new Subject<UsuarioDetalle>(); service.estado.mockReturnValue(pending);
    const { page } = await open('/admin/usuarios/empleado-1', UsuarioDetallePage);
    page.confirmar.set(true); page.cambiarEstado(); page.cambiarEstado();
    expect(service.estado).toHaveBeenCalledExactlyOnceWith('empleado-1', true);
    pending.next(employee); pending.complete(); expect(page.usuario()?.activo).toBe(true); expect(page.confirmar()).toBe(false);
  });
  it('cambiar de usuario cancela respuesta de estado pendiente para no sobrescribir otro detalle', async () => {
    const pending = new Subject<UsuarioDetalle>(); service.estado.mockReturnValue(pending);
    const { harness, page } = await open('/admin/usuarios/empleado-1', UsuarioDetallePage);
    page.confirmar.set(true); page.cambiarEstado();
    service.detalle.mockReturnValue(of(administrator));
    await harness.navigateByUrl('/admin/usuarios/admin-1', AdminLayout); harness.detectChanges();
    const next = harness.fixture.debugElement.query(By.directive(UsuarioDetallePage))!.componentInstance as UsuarioDetallePage;
    pending.next({ ...employee, activo: false }); pending.complete();
    expect(next.usuario()?.idUsuario).toBe('admin-1'); expect(next.busy()).toBe(false);
  });
  it.each([401, 403, 409, 422])('listado muestra error HTTP %s sin datos ni mensajes sensibles', async status => {
    service.listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status, error: { error: { message: 'secret-marker' } } })));
    const { harness, page } = await open('/admin/usuarios', UsuariosListaPage);
    expect(harness.routeNativeElement?.querySelector('[role=alert]')).toBeTruthy(); expect(page.result()).toBeNull();
    expect(harness.routeNativeElement?.textContent).not.toContain('secret-marker');
  });
  it.each([401, 403, 409, 422])('creación maneja HTTP %s sin navegar como éxito', async status => {
    service.crear.mockReturnValue(throwError(() => new HttpErrorResponse({ status, error: { error: { code: 'correo_duplicado' } } })));
    const { page, harness } = await open('/admin/empleados/nuevo', EmpleadoCrearPage); page.guardar(input); harness.detectChanges();
    expect(page.error()).toBeTruthy(); expect(TestBed.inject(Router).url).toBe('/admin/empleados/nuevo'); expect(page.busy()).toBe(false);
    if ([401, 403].includes(status)) expect(page.opciones()).toBeNull();
  });
  it.each([401, 403, 409, 422])('edición maneja HTTP %s sin fingir actualización', async status => {
    service.editar.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    const { page } = await open('/admin/empleados/empleado-1/editar', EmpleadoEditarPage); page.guardar(input);
    expect(page.error()).toBeTruthy(); expect(TestBed.inject(Router).url).toBe('/admin/empleados/empleado-1/editar');
    if ([401, 403].includes(status)) expect(page.usuario()).toBeNull();
  });
  it.each([401, 403, 409, 422])('cambio de estado maneja HTTP %s sin éxito falso', async status => {
    service.estado.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    const { page } = await open('/admin/usuarios/empleado-1', UsuarioDetallePage); page.confirmar.set(true); page.cambiarEstado();
    expect(page.error()).toBeTruthy(); expect(page.success()).toBe('');
    if ([401, 403].includes(status)) expect(page.usuario()).toBeNull(); else expect(page.usuario()?.activo).toBe(true);
  });
  it.each(['/admin/usuarios', '/admin/empleados/nuevo', '/admin/empleados/empleado-1/editar', '/admin/usuarios/empleado-1'])('protege acceso directo sin sesión: %s', async path => {
    auth.restore.mockReturnValue(of(null)); auth.session.set(null);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl(path);
    expect(TestBed.inject(Router).url).toBe('/login'); expect(service.listar).not.toHaveBeenCalled(); expect(service.detalle).not.toHaveBeenCalled(); expect(service.opciones).not.toHaveBeenCalled();
  });
  it('SuperAdmin sin CU05 no obtiene bypass ni carga datos', async () => {
    const denied = { ...session, rol: { nro: 'superadmin', descripcion: 'SuperAdmin' }, permisos: ['CU06'] };
    auth.restore.mockReturnValue(of(denied)); auth.session.set(denied);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl('/admin/usuarios');
    expect(TestBed.inject(Router).url).toBe('/acceso?motivo=sin-permiso'); expect(service.listar).not.toHaveBeenCalled();
  });
  it.each([401, 403, 503])('guard maneja error de restauración HTTP %s', async status => {
    auth.restore.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl('/admin/usuarios');
    expect(TestBed.inject(Router).url).toBe(status === 401 ? '/login' : `/acceso?motivo=${status === 403 ? 'sin-permiso' : 'verificacion'}`);
    expect(service.listar).not.toHaveBeenCalled();
  });
  it.each([true, false])('enlace panel depende de CU05: %s', async allowed => {
    const current = { ...session, permisos: allowed ? ['CU05'] : [] }; auth.restore.mockReturnValue(of(current)); auth.session.set(current);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl('/admin'); await harness.fixture.whenStable(); harness.detectChanges();
    expect(!!harness.routeNativeElement?.querySelector('a[href="/admin/usuarios"]')).toBe(allowed);
  });
});

describe('CU05 errores seguros', () => {
  it('distingue correo duplicado sin mostrar mensajes arbitrarios', () => {
    expect(usuarioError(new HttpErrorResponse({ status: 409, error: { error: { code: 'correo_duplicado', message: 'secret-marker' } } }))).toContain('correo ya está registrado');
    expect(usuarioError(new Error('secret-marker'))).not.toContain('secret-marker');
  });
});
