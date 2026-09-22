import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RenderMode } from '@angular/ssr';
import { of, Subject, throwError } from 'rxjs';
import { routes } from '../../../../app.routes';
import { serverRoutes } from '../../../../app.routes.server';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { AuthResponse } from '../../models/auth.models';
import { AuthService } from '../../services/auth.service';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { AdminLayout } from '../../shared/layout/admin-layout';
import { usuarioError } from '../../cu05-usuarios-empleados/services/usuario-error';
import { RolFormularioComponent } from '../components/rol-formulario';
import { PermisosSelectorComponent } from '../components/permisos-selector';
import { FuncionDetalle, PermisosDetalle, RolCrear, RolDetalle } from '../models/rol.models';
import { RolesService } from '../services/roles.service';
import { rolError } from '../services/rol-error';
import { RolesListaPage } from '../pages/roles-lista/roles-lista';
import { RolCrearPage } from '../pages/rol-crear/rol-crear';
import { RolEditarPage } from '../pages/rol-editar/rol-editar';
import { RolDetallePage } from '../pages/rol-detalle/rol-detalle';

const role: RolDetalle = { nro: 'Gestor', descripcion: 'Gestión', esRolCliente: false, estado: 'activo' };
const publicRole: RolDetalle = { nro: 'public-custom', descripcion: 'Público', esRolCliente: true, estado: 'activo' };
const assigned: PermisosDetalle = { nroRol: role.nro, esRolCliente: false, permisos: ['CU06'] };
const catalog: FuncionDetalle[] = ['CU05', 'CU06', 'CU07', 'CU08', 'CU09'].map(id => ({ id, descripcion: id === 'CU09' ? null : `Función ${id}` }));
const list = { items: [role, publicRole], total: 2, offset: 0, limit: 20 };
const session: AuthResponse = { usuario: { idUsuario: 'operator', nombres: 'Operador', correo: 'test@example.com' },
  rol: role, permisos: ['CU06'], expiraEn: '2030-01-01T00:00:00Z' };
const rejected = (status: number, code = 'datos_invalidos') => new HttpErrorResponse({ status,
  error: { error: { code, message: 'private-marker' } } });

describe('CU06 servicio HTTP', () => {
  let service: RolesService; let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    service = TestBed.inject(RolesService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  it('lista paginada, cookie, sin transfer cache y allowlist de respuesta', () => {
    let result: unknown;
    service.listar(20, 10).subscribe(value => result = value);
    const req = http.expectOne('/api/admin/roles?offset=20&limit=10');
    expect(req.request.withCredentials).toBe(true); expect(req.request.transferCache).toBe(false);
    req.flush({ ...list, items: [{ ...role, token: 'private-marker' }] });
    expect(JSON.stringify(result)).not.toContain('private-marker');
  });
  it('alta conserva PK, normaliza descripción y excluye extras sin almacenamiento', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem'); let result: unknown;
    service.crear({ nro: 'MiRol', descripcion: ' Descripción ', permisos: ['CU06'], token: 'private-marker' } as RolCrear).subscribe(value => result = value);
    const req = http.expectOne('/api/admin/roles');
    expect(req.request.method).toBe('POST'); expect(req.request.body).toEqual({ nro: 'MiRol', descripcion: 'Descripción' });
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1');
    req.flush({ ...role, contrasena: 'private-marker' });
    expect(result).toEqual(role); expect(storage).not.toHaveBeenCalled();
  });
  it('consulta detalle, edita solo descripción y codifica identificador sin cambiarlo', () => {
    service.detalle('Mi Rol').subscribe(); http.expectOne('/api/admin/roles/Mi%20Rol').flush(role);
    service.editar('MiRol', ' Nueva ').subscribe();
    const req = http.expectOne('/api/admin/roles/MiRol');
    expect(req.request.method).toBe('PATCH'); expect(req.request.body).toEqual({ descripcion: 'Nueva' }); req.flush(role);
  });
  it('lee catálogo dinámico y permisos; reemplaza con PUT incluido conjunto vacío', () => {
    let result: unknown;
    service.funciones().subscribe(value => result = value);
    http.expectOne('/api/admin/funciones').flush([{ id: 'Custom', descripcion: null, token: 'private-marker' }]);
    expect(result).toEqual([{ id: 'Custom', descripcion: null }]);
    service.permisos('Gestor').subscribe(); http.expectOne('/api/admin/roles/Gestor/permisos').flush(assigned);
    service.reemplazarPermisos('Gestor', []).subscribe(value => result = value);
    const req = http.expectOne('/api/admin/roles/Gestor/permisos');
    expect(req.request.method).toBe('PUT'); expect(req.request.body).toEqual({ permisos: [] });
    expect(req.request.withCredentials).toBe(true); expect(req.request.transferCache).toBe(false);
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1');
    req.flush({ ...assigned, permisos: [], token: 'private-marker' });
    expect(result).toEqual({ ...assigned, permisos: [] });
  });
  it.each([401, 403, 409, 422])('propaga errores %s sin éxito falso', status => {
    const fail = vi.fn(); service.reemplazarPermisos(role.nro, []).subscribe({ error: fail });
    http.expectOne('/api/admin/roles/Gestor/permisos').flush({}, { status, statusText: 'Rejected' });
    expect(fail).toHaveBeenCalledOnce();
  });
});

describe('CU06 SSR', () => {
  it('servicio y guard no hacen solicitudes privadas en servidor', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }, provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(RolesService);
    service.listar().subscribe(); service.detalle('x').subscribe(); service.crear(role).subscribe();
    service.editar('x', 'Nuevo').subscribe(); service.funciones().subscribe(); service.permisos('x').subscribe(); service.reemplazarPermisos('x', []).subscribe();
    expect(TestBed.runInInjectionContext(() => permissionGuard('CU06')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot))).toBe(false);
    TestBed.inject(HttpTestingController).expectNone(() => true);
    expect(serverRoutes[0]).toEqual({ path: 'admin/**', renderMode: RenderMode.Client });
  });
});

describe('CU06 formulario reutilizable', () => {
  function form(edit = false) {
    TestBed.configureTestingModule({ imports: [RolFormularioComponent] });
    const fixture = TestBed.createComponent(RolFormularioComponent);
    if (edit) fixture.componentRef.setInput('rol', role);
    fixture.detectChanges(); return fixture;
  }
  it('valida obligatorios, longitudes e identificadores sin normalización', () => {
    const fixture = form(); const component = fixture.componentInstance; const save = vi.fn(); component.guardar.subscribe(save);
    component.submit(); expect(save).not.toHaveBeenCalled(); expect(component.form.touched).toBe(true);
    for (const nro of ['x'.repeat(16), ' x', 'x/y', '..', 'a%2Fb', 'a?b']) {
      component.form.setValue({ nro, descripcion: 'Válida' }); component.submit(); expect(save).not.toHaveBeenCalled();
    }
    component.form.setValue({ nro: 'x'.repeat(15), descripcion: 'x'.repeat(51) }); component.submit(); expect(save).not.toHaveBeenCalled();
    component.form.setValue({ nro: 'Á'.repeat(15), descripcion: 'x'.repeat(50) }); component.submit(); expect(save).toHaveBeenCalledOnce();
  });
  it('alta emite solo datos permitidos; bloquea doble envío', () => {
    const fixture = form(); const component = fixture.componentInstance; const save = vi.fn(); component.guardar.subscribe(save);
    component.form.setValue({ nro: 'MiRol', descripcion: ' Nueva ' }); component.submit();
    expect(save).toHaveBeenCalledExactlyOnceWith({ nro: 'MiRol', descripcion: 'Nueva' });
    fixture.componentRef.setInput('busy', true); fixture.detectChanges(); component.submit(); expect(save).toHaveBeenCalledOnce();
  });
  it('cuenta caracteres Unicode como el backend y no unidades UTF-16', () => {
    const fixture = form(); const component = fixture.componentInstance;
    component.form.setValue({ nro: '😀'.repeat(15), descripcion: '😀'.repeat(50) });
    expect(component.form.valid).toBe(true);
    component.form.controls.nro.setValue('😀'.repeat(16)); expect(component.form.controls.nro.hasError('maxlength')).toBe(true);
  });
  it('edición precarga, PK readonly e inmutable aun si se manipula control, no-op no emite', () => {
    const fixture = form(true); const component = fixture.componentInstance; const save = vi.fn(); component.guardar.subscribe(save);
    expect(fixture.nativeElement.querySelector('#rol-nro').readOnly).toBe(true);
    component.submit(); expect(save).not.toHaveBeenCalled();
    component.form.patchValue({ nro: 'Manipulado', descripcion: 'Actualizada' }); component.submit();
    expect(save).toHaveBeenCalledExactlyOnceWith({ nro: role.nro, descripcion: 'Actualizada' });
  });
});

describe('CU06 selección de permisos', () => {
  function selector(value = assigned) {
    TestBed.configureTestingModule({ imports: [PermisosSelectorComponent] });
    const fixture = TestBed.createComponent(PermisosSelectorComponent);
    fixture.componentRef.setInput('actual', value); fixture.componentRef.setInput('funciones', catalog); fixture.detectChanges(); return fixture;
  }
  it('muestra catálogo recibido, altas/bajas, vacío y no-op sin emisión', () => {
    const fixture = selector(); const component = fixture.componentInstance; const save = vi.fn(); component.guardar.subscribe(save);
    for (const item of catalog) expect(fixture.nativeElement.textContent).toContain(item.id);
    component.submit(); expect(save).not.toHaveBeenCalled();
    component.toggle('CU05', true); component.toggle('CU05', true); component.submit();
    expect(save).toHaveBeenLastCalledWith(['CU05', 'CU06']);
    component.toggle('CU05', false); component.toggle('CU06', false); component.submit(); expect(save).toHaveBeenLastCalledWith([]);
    component.toggle('unknown', true); expect(component.seleccion()).toEqual([]);
  });
  it('cliente configurable no permite seleccionar ni asignar y admite limpieza legado', () => {
    const fixture = selector({ nroRol: 'public-custom', esRolCliente: true, permisos: ['CU06'] });
    const component = fixture.componentInstance; const save = vi.fn(); component.guardar.subscribe(save);
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('no puede recibir funciones');
    component.toggle('CU05', true); component.submit(); expect(save).not.toHaveBeenCalled();
    component.limpiarCliente(); expect(save).toHaveBeenCalledExactlyOnceWith([]);
    fixture.componentRef.setInput('actual', { nroRol: 'public-custom', esRolCliente: true, permisos: [] }); fixture.detectChanges();
    component.limpiarCliente(); expect(save).toHaveBeenCalledOnce();
  });
  it('bloquea modificaciones mientras guarda y actualiza estado tras respuesta', () => {
    const fixture = selector(); const component = fixture.componentInstance; const save = vi.fn(); component.guardar.subscribe(save);
    fixture.componentRef.setInput('busy', true); fixture.detectChanges(); component.toggle('CU05', true); component.submit(); expect(save).not.toHaveBeenCalled();
    fixture.componentRef.setInput('actual', { ...assigned, permisos: ['CU05'] }); fixture.detectChanges();
    expect(component.seleccion()).toEqual(['CU05']); expect(component.cambio()).toBe(false);
  });
});

describe('CU06 páginas, rutas y actualización de acceso', () => {
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(session), logout: vi.fn() };
  const service = { listar: vi.fn(), detalle: vi.fn(), crear: vi.fn(), editar: vi.fn(), funciones: vi.fn(), permisos: vi.fn(), reemplazarPermisos: vi.fn() };
  beforeEach(() => {
    auth.restore.mockReset().mockReturnValue(of(session)); auth.session.set(session); auth.logout.mockReset();
    service.listar.mockReset().mockReturnValue(of(list)); service.detalle.mockReset().mockReturnValue(of(role));
    service.crear.mockReset().mockReturnValue(of(role)); service.editar.mockReset().mockReturnValue(of(role));
    service.funciones.mockReset().mockReturnValue(of(catalog)); service.permisos.mockReset().mockReturnValue(of(assigned));
    service.reemplazarPermisos.mockReset().mockReturnValue(of({ ...assigned, permisos: ['CU05', 'CU06'] }));
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AuthService, useValue: auth }, { provide: RolesService, useValue: service }] });
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
  it('lista roles, metadata, enlaces y paginación', async () => {
    const { page, harness } = await open('/admin/roles', RolesListaPage);
    expect(harness.routeNativeElement?.textContent).toContain('2 roles'); expect(harness.routeNativeElement?.textContent).toContain('Rol cliente protegido');
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/roles/Gestor/editar"]')).toBeTruthy();
    page.load(20); expect(service.listar).toHaveBeenLastCalledWith(20, 20);
  });
  it('muestra listado vacío y controles deshabilitados', async () => {
    service.listar.mockReturnValue(of({ ...list, items: [], total: 0 }));
    const { harness } = await open('/admin/roles', RolesListaPage);
    expect(harness.routeNativeElement?.textContent).toContain('No hay roles');
    expect(Array.from(harness.routeNativeElement?.querySelectorAll('nav[aria-label="Paginación de roles"] button') ?? []).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
  });
  it('crea desde formulario y navega al detalle sin guardar secretos', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem'); const { harness } = await open('/admin/roles/nuevo', RolCrearPage);
    const form = harness.routeDebugElement?.query(By.directive(RolFormularioComponent)).componentInstance as RolFormularioComponent;
    form.form.setValue({ nro: role.nro, descripcion: role.descripcion }); form.submit(); await harness.fixture.whenStable();
    expect(service.crear).toHaveBeenCalledExactlyOnceWith({ nro: role.nro, descripcion: role.descripcion });
    expect(TestBed.inject(Router).url).toBe('/admin/roles/Gestor'); expect(storage).not.toHaveBeenCalled();
  });
  it('edita descripción con PK original y no-op no envía', async () => {
    const { page, harness } = await open('/admin/roles/Gestor/editar', RolEditarPage);
    page.guardar(role); expect(service.editar).not.toHaveBeenCalled();
    page.guardar({ nro: 'NoCambiar', descripcion: 'Actualizada' }); await harness.fixture.whenStable();
    expect(service.editar).toHaveBeenCalledExactlyOnceWith('Gestor', 'Actualizada');
    expect(TestBed.inject(Router).url).toBe('/admin/roles/Gestor');
  });
  it('detalle carga catálogo y permisos, guarda, refresca sesión y no repite PUT', async () => {
    const { page, harness } = await open('/admin/roles/Gestor', RolDetallePage);
    expect(service.detalle).toHaveBeenCalledWith('Gestor'); expect(service.permisos).toHaveBeenCalledWith('Gestor'); expect(service.funciones).toHaveBeenCalledOnce();
    const restoreBefore = auth.restore.mock.calls.length;
    page.guardar(['CU06']); expect(service.reemplazarPermisos).not.toHaveBeenCalled();
    page.guardar(['CU05', 'CU06']); harness.detectChanges();
    expect(service.reemplazarPermisos).toHaveBeenCalledExactlyOnceWith('Gestor', ['CU05', 'CU06']);
    expect(auth.restore.mock.calls.length).toBe(restoreBefore + 1); expect(page.success()).toContain('guardados');
    page.guardar(['CU06', 'CU05']); expect(service.reemplazarPermisos).toHaveBeenCalledOnce(); expect(auth.logout).not.toHaveBeenCalled();
  });
  it('cliente backend bloquea asignaciones y permite PUT vacío de limpieza', async () => {
    service.detalle.mockReturnValue(of(publicRole)); service.permisos.mockReturnValue(of({ nroRol: publicRole.nro, esRolCliente: true, permisos: ['CU06'] }));
    service.reemplazarPermisos.mockReturnValue(of({ nroRol: publicRole.nro, esRolCliente: true, permisos: [] }));
    const { page } = await open('/admin/roles/public-custom', RolDetallePage);
    page.guardar(['CU05']); expect(service.reemplazarPermisos).not.toHaveBeenCalled();
    page.guardar([]); expect(service.reemplazarPermisos).toHaveBeenCalledExactlyOnceWith('public-custom', []);
    page.guardar([]); expect(service.reemplazarPermisos).toHaveBeenCalledOnce();
  });
  it('autorevocación navega a acceso sin logout', async () => {
    const { page, harness } = await open('/admin/roles/Gestor', RolDetallePage);
    auth.restore.mockReturnValue(of({ ...session, permisos: [] })); service.reemplazarPermisos.mockReturnValue(of({ ...assigned, permisos: [] }));
    page.guardar([]); await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/acceso?motivo=sin-permiso'); expect(auth.logout).not.toHaveBeenCalled();
  });
  it.each([401, 403, 503])('fallo de refresh %s no convierte guardado confirmado en fallo ni reenvía', async status => {
    const { page, harness } = await open('/admin/roles/Gestor', RolDetallePage);
    auth.restore.mockReturnValue(throwError(() => rejected(status))); page.guardar(['CU05', 'CU06']); harness.detectChanges();
    expect(page.success()).toContain('guardados correctamente'); expect(page.error()).toBe('');
    expect(page.warning()).toContain('guardado fue confirmado'); expect(page.refreshFailed()).toBe(true);
    expect(page.permisos()?.permisos).toEqual(['CU05', 'CU06']); page.guardar([]); expect(service.reemplazarPermisos).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).url).toBe('/admin/roles/Gestor'); expect(auth.logout).not.toHaveBeenCalled();
  });
  it('evita doble PUT mientras espera y cancela respuesta al cambiar de rol', async () => {
    const pending = new Subject<PermisosDetalle>(); service.reemplazarPermisos.mockReturnValue(pending);
    const { page, harness } = await open('/admin/roles/Gestor', RolDetallePage);
    page.guardar([]); page.guardar([]); expect(service.reemplazarPermisos).toHaveBeenCalledOnce();
    service.detalle.mockReturnValue(of(publicRole)); service.permisos.mockReturnValue(of({ nroRol: publicRole.nro, esRolCliente: true, permisos: [] }));
    await harness.navigateByUrl('/admin/roles/public-custom', AdminLayout); harness.detectChanges();
    const next = harness.fixture.debugElement.query(By.directive(RolDetallePage))!.componentInstance as RolDetallePage;
    pending.next({ ...assigned, permisos: [] }); pending.complete();
    expect(next.rol()?.nro).toBe(publicRole.nro); expect(next.permisos()?.nroRol).toBe(publicRole.nro); expect(next.busy()).toBe(false);
  });
  it.each([401, 403, 409, 422])('listado y detalle manejan %s sin filtrar mensajes arbitrarios', async status => {
    service.listar.mockReturnValue(throwError(() => rejected(status)));
    const { page, harness } = await open('/admin/roles', RolesListaPage);
    expect(page.result()).toBeNull(); expect(page.error()).toBeTruthy(); expect(harness.routeNativeElement?.textContent).not.toContain('private-marker');
    service.detalle.mockReturnValue(throwError(() => rejected(status)));
    await harness.navigateByUrl('/admin/roles/Gestor', AdminLayout); harness.detectChanges();
    const detail = harness.fixture.debugElement.query(By.directive(RolDetallePage))!.componentInstance as RolDetallePage;
    expect(detail.rol()).toBeNull(); expect(detail.error()).toBeTruthy();
  });
  it.each([401, 403, 409, 422])('alta/edición manejan %s sin navegar como éxito', async status => {
    service.crear.mockReturnValue(throwError(() => rejected(status)));
    const { page, harness } = await open('/admin/roles/nuevo', RolCrearPage); page.guardar(role);
    expect(page.error()).toBeTruthy(); expect(page.busy()).toBe(false); expect(page.denied()).toBe([401, 403].includes(status));
    expect(TestBed.inject(Router).url).toBe('/admin/roles/nuevo');
    service.editar.mockReturnValue(throwError(() => rejected(status)));
    await harness.navigateByUrl('/admin/roles/Gestor/editar', AdminLayout); harness.detectChanges();
    const edit = harness.fixture.debugElement.query(By.directive(RolEditarPage))!.componentInstance as RolEditarPage; edit.guardar({ ...role, descripcion: 'Actualizada' });
    expect(edit.error()).toBeTruthy(); expect(edit.busy()).toBe(false);
    if ([401, 403].includes(status)) expect(edit.rol()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/admin/roles/Gestor/editar');
  });
  it.each([401, 403, 409, 422])('PUT maneja %s sin refresco ni éxito falso', async status => {
    const { page } = await open('/admin/roles/Gestor', RolDetallePage); const before = auth.restore.mock.calls.length;
    service.reemplazarPermisos.mockReturnValue(throwError(() => rejected(status, 'ultimo_usuario_cu06'))); page.guardar([]);
    expect(page.error()).toBeTruthy(); expect(page.success()).toBe(''); expect(auth.restore.mock.calls.length).toBe(before);
    if ([401, 403].includes(status)) expect(page.permisos()).toBeNull(); else expect(page.permisos()).toEqual(assigned);
    if (status === 409) expect(page.error()).toContain('usuario interno con permiso CU06');
  });
  it.each(['/admin/roles', '/admin/roles/nuevo', '/admin/roles/Gestor/editar', '/admin/roles/Gestor'])('guard protege URL directa %s', async path => {
    auth.restore.mockReturnValue(of(null)); auth.session.set(null);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl(path);
    expect(TestBed.inject(Router).url).toBe('/login'); expect(service.listar).not.toHaveBeenCalled(); expect(service.detalle).not.toHaveBeenCalled();
  });
  it.each(['/admin/roles', '/admin/roles/nuevo', '/admin/roles/Gestor/editar', '/admin/roles/Gestor'])('nombre superadmin sin CU06 no da acceso a %s', async path => {
    const denied = { ...session, rol: { nro: 'superadmin', descripcion: 'SuperAdmin' }, permisos: ['CU05'] };
    auth.restore.mockReturnValue(of(denied)); auth.session.set(denied);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl(path);
    expect(TestBed.inject(Router).url).toBe('/acceso?motivo=sin-permiso'); expect(service.listar).not.toHaveBeenCalled();
  });
  it.each([401, 403, 503])('guard maneja fallo de restore %s', async status => {
    auth.restore.mockReturnValue(throwError(() => rejected(status)));
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl('/admin/roles');
    expect(TestBed.inject(Router).url).toBe(status === 401 ? '/login' : `/acceso?motivo=${status === 403 ? 'sin-permiso' : 'verificacion'}`);
    expect(service.listar).not.toHaveBeenCalled();
  });
  it.each([true, false])('enlace panel depende de CU06: %s', async allowed => {
    const current = { ...session, permisos: allowed ? ['CU06'] : [] }; auth.restore.mockReturnValue(of(current)); auth.session.set(current);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl('/admin'); await harness.fixture.whenStable(); harness.detectChanges();
    expect(!!harness.routeNativeElement?.querySelector('a[href="/admin/roles"]')).toBe(allowed);
  });
  it('PK nuevo sigue consultable sin colisionar con creación ni cambiar identidad', async () => {
    const reserved = { ...role, nro: 'nuevo' }; service.crear.mockReturnValue(of(reserved)); service.detalle.mockReturnValue(of(reserved));
    service.permisos.mockReturnValue(of({ ...assigned, nroRol: 'nuevo' }));
    const { page, harness } = await open('/admin/roles/nuevo', RolCrearPage); page.guardar(reserved); await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/admin/roles/nuevo;detalle=1');
    expect(service.detalle).toHaveBeenCalledWith('nuevo');
    service.listar.mockReturnValue(of({ ...list, items: [reserved] }));
    await harness.navigateByUrl('/admin/roles', AdminLayout); harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/roles/nuevo;detalle=1"]')).toBeTruthy();
  });
  it('refresh pendiente se cancela al salir de detalle y no redirige otra pantalla', async () => {
    const { page, harness } = await open('/admin/roles/Gestor', RolDetallePage);
    const refresh = new Subject<AuthResponse | null>(); auth.restore.mockReturnValueOnce(refresh);
    page.guardar(['CU05', 'CU06']); expect(page.success()).toBeTruthy();
    await harness.navigateByUrl('/admin/roles', AdminLayout);
    refresh.next({ ...session, permisos: [] }); refresh.complete();
    expect(TestBed.inject(Router).url).toBe('/admin/roles'); expect(auth.logout).not.toHaveBeenCalled();
  });
  it('PUT vacío no-op y catálogos desconocidos no generan solicitudes', async () => {
    service.permisos.mockReturnValue(of({ ...assigned, permisos: [] }));
    const { page } = await open('/admin/roles/Gestor', RolDetallePage);
    page.guardar([]); page.guardar(['CU06', 'CU06']); page.guardar(['unknown']);
    expect(service.reemplazarPermisos).not.toHaveBeenCalled();
  });
});

describe('Errores seguros CU06 y continuidad CU05', () => {
  it('distingue conflictos sin renderizar mensaje arbitrario', () => {
    expect(rolError(rejected(409, 'rol_duplicado'))).toContain('identificador del rol ya existe');
    expect(rolError(rejected(409, 'ultimo_usuario_cu06'))).toContain('usuario interno con permiso CU06');
    expect(usuarioError(rejected(409, 'ultimo_usuario_cu06'))).toContain('usuario interno');
    for (const error of [rejected(422), rejected(500), new Error('private-marker')]) expect(rolError(error)).not.toContain('private-marker');
  });
});
