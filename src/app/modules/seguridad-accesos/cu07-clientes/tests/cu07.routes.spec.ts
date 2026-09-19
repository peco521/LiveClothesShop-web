import { HttpErrorResponse } from '@angular/common/http';
import { PLATFORM_ID, signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RenderMode } from '@angular/ssr';
import { of, Subject, throwError } from 'rxjs';
import { routes } from '../../../../app.routes';
import { serverRoutes } from '../../../../app.routes.server';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../models/auth.models';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { AdminLayout } from '../../shared/layout/admin-layout';
import { ClientesService } from '../services/clientes.service';
import { clienteError } from '../services/cliente-error';
import { ClienteDetalle, ClientesListado } from '../models/cliente.models';
import { ClientesListaPage } from '../pages/clientes-lista/clientes-lista';
import { ClienteDetallePage } from '../pages/cliente-detalle/cliente-detalle';
import { ClienteEditarPage } from '../pages/cliente-editar/cliente-editar';
import { customer, list, session } from './cliente.fixtures';

describe('CU07 páginas, navegación y permisos', () => {
  let activeHarness: RouterTestingHarness | undefined;
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(session) };
  const service = { listar: vi.fn(), detalle: vi.fn(), editar: vi.fn(), crear: vi.fn(), estadoCuenta: vi.fn() };
  beforeEach(() => {
    activeHarness = undefined;
    auth.restore.mockReset().mockReturnValue(of(session)); auth.session.set(session);
    service.listar.mockReset().mockReturnValue(of(list)); service.detalle.mockReset().mockReturnValue(of(customer));
    service.editar.mockReset().mockReturnValue(of(customer));
    service.crear.mockReset().mockReturnValue(of(customer));
    service.estadoCuenta.mockReset().mockReturnValue(of({ ...customer, cliente: { ...customer.cliente, estado: 'activo' } }));
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AuthService, useValue: auth }, { provide: ClientesService, useValue: service }] });
  });
  afterEach(() => vi.restoreAllMocks());
  async function open<T>(path: string, type: Type<T>) {
    // Las páginas administrativas viven dentro de AdminLayout: la ruta raíz
    // activa el layout y la hoja se resuelve en su router-outlet.
    const harness = activeHarness ??= await RouterTestingHarness.create(); await harness.navigateByUrl(path, AdminLayout);
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    const page = harness.fixture.debugElement.query(By.directive(type))!.componentInstance as T;
    return { harness, page };
  }
  it('lista, enlaces y ausencia de filtros ajenos con alta administrativa disponible', async () => {
    const { harness } = await open('/admin/clientes', ClientesListaPage);
    expect(harness.routeNativeElement?.textContent).toContain('21 clientes candidatos');
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/clientes/cliente-1"]')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/clientes/cliente-1/editar"]')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('[formControlName="estado"]')).toBeNull();
    // CU07: la baja/reactivación es una acción explícita (no un filtro por estado
    // comercial) y el alta se hace desde administración, nunca por el registro público.
    expect(harness.routeNativeElement?.textContent).toContain('Registrar cliente');
    expect(harness.routeNativeElement?.textContent).toContain('Reactivar');
    expect(harness.routeNativeElement?.querySelector('a[href="/registro"]')).toBeNull();
  });
  it('registra un cliente desde administración sin cambiar la sesión', async () => {
    const { page } = await open('/admin/clientes', ClientesListaPage);
    page.registrando.set(true);
    page.nuevo = { ci: '1234567', nombres: 'Ana', apellidoPat: 'Pérez', apellidoMat: 'López', sexo: 'F',
      correo: 'ana@example.com', telefono: '70000000', direccion: 'Calle 1', fechaNac: '2000-01-01',
      contrasena: 'Frase de prueba larga 123!' };
    page.registrar();
    expect(service.crear).toHaveBeenCalledOnce();
    expect(page.registrando()).toBe(false);
    // El administrador conserva su propia sesión: no queda autenticado como el cliente.
    expect(auth.session()).toBe(session);
  });
  it('desactiva y reactiva al cliente con una acción explícita', async () => {
    const { page } = await open('/admin/clientes', ClientesListaPage);
    page.cambiarEstado(customer);
    // El fixture está inactivo, por lo que la acción solicitada es reactivarlo.
    expect(service.estadoCuenta).toHaveBeenCalledWith(customer.idUsuario, true);
  });
  it('conserva búsqueda solo al paginar y la reinicia al volver del detalle', async () => {
    const { harness, page } = await open('/admin/clientes?offset=10&limit=10', ClientesListaPage);
    expect(service.listar).toHaveBeenLastCalledWith({ offset: 10, limit: 10, q: '' });
    page.form.controls.q.setValue('Ana'); page.aplicar(); await harness.fixture.whenStable();
    page.pagina(20); await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('offset=20');
    expect(service.listar).toHaveBeenLastCalledWith({ offset: 20, limit: 10, q: 'Ana' });
    expect(TestBed.inject(Router).url).not.toContain('q=');
    await harness.navigateByUrl('/admin/clientes/cliente-1?offset=20&limit=10', AdminLayout); harness.detectChanges();
    const link = harness.routeNativeElement?.querySelector('a[href^="/admin/clientes?"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('offset=20');
    await harness.navigateByUrl(link.getAttribute('href')!, AdminLayout);
    expect(service.listar).toHaveBeenLastCalledWith({ offset: 20, limit: 10, q: '' });
  });
  it('aplica búsqueda y filtros nuevos reiniciando offset', async () => {
    const { harness, page } = await open('/admin/clientes?offset=20', ClientesListaPage);
    page.form.patchValue({ q: ' Nueva ', limit: 10 }); page.aplicar(); await harness.fixture.whenStable();
    expect(service.listar).toHaveBeenLastCalledWith({ offset: 0, limit: 10, q: 'Nueva' });
  });
  it.each(['private-search@example.com', '987654321'])('q=%s nunca se persiste en navegación, enlaces o storage', async query => {
    const { harness, page } = await open('/admin/clientes', ClientesListaPage);
    const router = TestBed.inject(Router);
    const navigation = vi.spyOn(router, 'navigate');
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const push = vi.spyOn(history, 'pushState'); const replace = vi.spyOn(history, 'replaceState');
    page.form.patchValue({ q: query, limit: 10 }); page.aplicar(); await harness.fixture.whenStable();
    page.pagina(10); await harness.fixture.whenStable(); harness.detectChanges();
    expect(service.listar).toHaveBeenLastCalledWith({ offset: 10, limit: 10, q: query });
    expect(router.url).not.toContain('q='); expect(router.url).not.toContain(query);
    for (const [commands, extras] of navigation.mock.calls) {
      expect(JSON.stringify(commands)).not.toContain(query);
      expect(Object.keys(extras?.queryParams ?? {}).every(key => ['offset', 'limit'].includes(key))).toBe(true);
      expect(extras?.state).toBeUndefined();
      expect(JSON.stringify(extras?.queryParams)).not.toContain(query);
    }
    expect(JSON.stringify(push.mock.calls)).not.toContain(query); expect(JSON.stringify(replace.mock.calls)).not.toContain(query);
    expect(JSON.stringify(history.state)).not.toContain(query); expect(storage).not.toHaveBeenCalled();
    for (const link of harness.routeNativeElement!.querySelectorAll('a')) expect(link.getAttribute('href')).not.toContain(query);
  });
  it('ignora y retira q de un enlace antiguo sin usarlo para buscar', async () => {
    const { page } = await open('/admin/clientes?offset=10&limit=10&q=legacy-marker', ClientesListaPage);
    expect(TestBed.inject(Router).url).toBe('/admin/clientes?offset=10&limit=10');
    expect(page.form.controls.q.value).toBe('');
    expect(service.listar).toHaveBeenLastCalledWith({ offset: 10, limit: 10, q: '' });
    expect(JSON.stringify(service.listar.mock.calls)).not.toContain('legacy-marker');
  });
  it('los enlaces desde detalle/edición no propagan q heredado', async () => {
    for (const suffix of ['', '/editar']) {
      const harness = activeHarness ??= await RouterTestingHarness.create();
      await harness.navigateByUrl('/admin/clientes/cliente-1' + suffix + '?offset=10&q=legacy-marker'); harness.detectChanges();
      for (const link of harness.routeNativeElement!.querySelectorAll('a')) expect(link.getAttribute('href')).not.toContain('legacy-marker');
    }
  });
  it('rechaza filtros inválidos antes de HTTP', async () => {
    const { page } = await open('/admin/clientes', ClientesListaPage); const before = service.listar.mock.calls.length;
    for (const limit of [0, 101, 1.5]) { page.form.controls.limit.setValue(limit); page.aplicar(); }
    expect(service.listar).toHaveBeenCalledTimes(before);
  });
  it('muestra carga/vacío y reintenta error conservando filtros', async () => {
    service.listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const { harness, page } = await open('/admin/clientes', ClientesListaPage);
    page.form.controls.q.setValue('Ana'); page.aplicar();
    expect(page.error()).toBeTruthy(); const pending = new Subject<ClientesListado>(); service.listar.mockReturnValue(pending);
    page.load(); harness.detectChanges(); expect(harness.routeNativeElement?.textContent).toContain('Cargando clientes');
    pending.next({ ...list, total: 0, items: [] }); pending.complete(); harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No hay clientes');
    expect(service.listar).toHaveBeenLastCalledWith({ offset: 0, limit: 20, q: 'Ana' });
    expect(Array.from(harness.routeNativeElement!.querySelectorAll('nav[aria-label="Paginación"] button')).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
  });
  it('cambiar filtros cancela respuesta anterior, doble filtro idéntico no duplica', async () => {
    const old = new Subject<ClientesListado>(); service.listar.mockReturnValue(old);
    const { harness, page } = await open('/admin/clientes', ClientesListaPage);
    page.aplicar(); expect(service.listar).toHaveBeenCalledTimes(1);
    service.listar.mockReturnValue(of({ ...list, total: 0, items: [] })); page.form.controls.q.setValue('Otro'); page.aplicar();
    await harness.fixture.whenStable(); expect(old.observed).toBe(false);
    old.next(list); expect(page.result()?.total).toBe(0);
  });
  it('salir del listado cancela la petición pendiente', async () => {
    const pending = new Subject<ClientesListado>(); service.listar.mockReturnValue(pending);
    const { harness } = await open('/admin/clientes', ClientesListaPage);
    await harness.navigateByUrl('/admin/clientes/cliente-1', AdminLayout);
    expect(pending.observed).toBe(false);
  });
  it('detalle no muestra acciones de activación de cuenta', async () => {
    const { harness } = await open('/admin/clientes/cliente-1', ClienteDetallePage);
    const text = harness.routeNativeElement?.textContent;
    expect(text).not.toContain('Activar cuenta');
    expect(text).not.toContain('Desactivar cuenta');
    expect(text).not.toContain('Estado de la cuenta');
  });
  it('detalle muestra estado comercial y nombres null', async () => {
    service.detalle.mockReturnValue(of({ ...customer, nombres: null }));
    const { harness } = await open('/admin/clientes/cliente-1', ClienteDetallePage);
    const text = harness.routeNativeElement?.textContent;
    expect(text).toContain('Sin registrar');
    expect(text).toContain('Estado del perfil de cliente (solo lectura)'); expect(text).toContain('inactivo');
    expect(text).toContain('CL001'); expect(text).toContain('publico-custom');
  });

  it('edición preserva filtros al volver al detalle y bloquea vacíos/doble envío', async () => {
    const pending = new Subject<ClienteDetalle>(); service.editar.mockReturnValue(pending);
    const { harness, page } = await open('/admin/clientes/cliente-1/editar?q=Ana&offset=20', ClienteEditarPage);
    page.guardar({}); expect(service.editar).not.toHaveBeenCalled();
    page.guardar({ telefono: '123' }); page.guardar({ telefono: '123' }); expect(service.editar).toHaveBeenCalledExactlyOnceWith('cliente-1', { telefono: '123' });
    pending.next(customer); pending.complete(); await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/admin/clientes/cliente-1?offset=20');
  });
  it.each(['detail', 'edit'])('navegar cancela cargas anteriores en %s', async kind => {
    const pending = new Subject<ClienteDetalle>(); service.detalle.mockReturnValue(pending);
    const type = kind === 'edit' ? ClienteEditarPage : ClienteDetallePage;
    const suffix = kind === 'edit' ? '/editar' : '';
    const { harness } = await open<ClienteEditarPage | ClienteDetallePage>('/admin/clientes/cliente-1' + suffix, type);
    service.detalle.mockReturnValue(of({ ...customer, idUsuario: 'cliente-2' }));
    await harness.navigateByUrl('/admin/clientes/cliente-2' + suffix, AdminLayout); harness.detectChanges();
    const next = harness.fixture.debugElement.query(By.directive(type))!.componentInstance as ClienteEditarPage | ClienteDetallePage;
    expect(pending.observed).toBe(false); pending.next(customer);
    expect(next.cliente()?.idUsuario).toBe('cliente-2');
  });

  it('navegar cancela edición pendiente sin redirección tardía', async () => {
    const pending = new Subject<ClienteDetalle>(); service.editar.mockReturnValue(pending);
    const { harness, page } = await open('/admin/clientes/cliente-1/editar', ClienteEditarPage); page.guardar({ telefono: '123' });
    service.detalle.mockReturnValue(of({ ...customer, idUsuario: 'cliente-2' }));
    await harness.navigateByUrl('/admin/clientes/cliente-2/editar', AdminLayout); harness.detectChanges();
    const next = harness.fixture.debugElement.query(By.directive(ClienteEditarPage))!.componentInstance as ClienteEditarPage;
    pending.next(customer); pending.complete(); await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/admin/clientes/cliente-2/editar'); expect(next.busy()).toBe(false); expect(pending.observed).toBe(false);
  });
  it.each([401, 403, 404, 409, 422])('listado/detalle/edición manejan carga HTTP %s de forma segura', async status => {
    const failure = throwError(() => new HttpErrorResponse({ status, error: { error: { message: 'private-marker' } } }));
    service.listar.mockReturnValue(failure); service.detalle.mockReturnValue(failure);
    const listing = await open('/admin/clientes', ClientesListaPage); expect(listing.page.result()).toBeNull(); expect(listing.page.error()).toBeTruthy();
    const detail = await open('/admin/clientes/cliente-1', ClienteDetallePage); expect(detail.page.cliente()).toBeNull(); expect(detail.page.error()).toBeTruthy();
    const edit = await open('/admin/clientes/cliente-1/editar', ClienteEditarPage); expect(edit.page.cliente()).toBeNull();
    expect(edit.harness.routeNativeElement?.textContent).not.toContain('private-marker');
  });
  it.each([401, 403, 404, 409, 422])('mutaciones manejan HTTP %s sin éxito falso', async status => {
    const failure = throwError(() => new HttpErrorResponse({ status, error: { error: { code: status === 409 ? 'correo_duplicado' : 'datos_invalidos', message: 'private-marker' } } }));
    service.editar.mockReturnValue(failure);
    const edit = await open('/admin/clientes/cliente-1/editar', ClienteEditarPage); edit.page.guardar({ telefono: '123' });
    expect(edit.page.error()).toBeTruthy(); expect(TestBed.inject(Router).url).toContain('/editar');
    expect(!!edit.page.cliente()).toBe(![401, 403, 404].includes(status));
  });
  it('perfil incoherente retira formulario; correo duplicado conserva datos', async () => {
    service.editar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error: { code: 'perfil_incoherente' } } })));
    const { page } = await open('/admin/clientes/cliente-1/editar', ClienteEditarPage); page.guardar({ telefono: '123' });
    expect(page.cliente()).toBeNull(); expect(page.error()).toContain('incoherente');
  });
  it.each(['/admin/clientes', '/admin/clientes/cliente-1', '/admin/clientes/cliente-1/editar'])('guard sin sesión protege %s', async path => {
    auth.restore.mockReturnValue(of(null)); auth.session.set(null);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl(path);
    expect(TestBed.inject(Router).url).toBe('/login'); expect(service.listar).not.toHaveBeenCalled(); expect(service.detalle).not.toHaveBeenCalled();
  });
  it.each(['/admin/clientes', '/admin/clientes/cliente-1', '/admin/clientes/cliente-1/editar'])('guard sin CU07 protege %s sin bypass SuperAdmin', async path => {
    const denied = { ...session, permisos: ['CU05', 'CU06'], rol: { nro: 'superadmin', descripcion: 'SuperAdmin' } };
    auth.restore.mockReturnValue(of(denied)); auth.session.set(denied);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl(path);
    expect(TestBed.inject(Router).url).toBe('/acceso?motivo=sin-permiso'); expect(service.detalle).not.toHaveBeenCalled();
  });
  it.each([401, 403, 503])('guard maneja restauración HTTP %s', async status => {
    auth.restore.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl('/admin/clientes');
    expect(TestBed.inject(Router).url).toBe(status === 401 ? '/login' : '/acceso?motivo=' + (status === 403 ? 'sin-permiso' : 'verificacion'));
  });
  it.each([true, false])('enlace panel depende del permiso: %s', async allowed => {
    const current = { ...session, permisos: allowed ? ['CU07'] : [] }; auth.restore.mockReturnValue(of(current)); auth.session.set(current);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl('/admin'); await harness.fixture.whenStable(); harness.detectChanges();
    expect(!!harness.routeNativeElement?.querySelector('a[href="/admin/clientes"]')).toBe(allowed);
  });
});

describe('CU07 guard SSR y errores seguros', () => {
  it('admin Client y guard servidor sin restauración', () => {
    const auth = { restore: vi.fn() };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }, { provide: AuthService, useValue: auth }] });
    expect(TestBed.runInInjectionContext(() => permissionGuard('CU07')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot))).toBe(false);
    expect(auth.restore).not.toHaveBeenCalled(); expect(serverRoutes[0]).toEqual({ path: 'admin/**', renderMode: RenderMode.Client });
  });
  it('mensajes distinguen correo/perfil sin mostrar excepciones arbitrarias', () => {
    expect(clienteError(new HttpErrorResponse({ status: 409, error: { error: { code: 'correo_duplicado' } } }))).toContain('correo ya está registrado');
    expect(clienteError(new HttpErrorResponse({ status: 409, error: { error: { code: 'perfil_incoherente' } } }))).toContain('incoherente');
    expect(clienteError(new Error('private-marker'))).not.toContain('private-marker');
  });
});
