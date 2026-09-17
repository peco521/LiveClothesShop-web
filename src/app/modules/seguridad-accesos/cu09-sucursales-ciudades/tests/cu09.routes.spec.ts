import { HttpErrorResponse } from '@angular/common/http';
import { PLATFORM_ID, signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject, throwError } from 'rxjs';
import { routes } from '../../../../app.routes';
import { AuthService } from '../../services/auth.service';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { AdminLayout } from '../../shared/layout/admin-layout';

// Las páginas administrativas viven dentro de AdminLayout: la ruta raíz
// activa el layout y la hoja se resuelve en su router-outlet.
async function openLeaf<T>(harness: RouterTestingHarness, path: string, type: Type<T>): Promise<T> {
  await harness.navigateByUrl(path, AdminLayout);
  harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
  return harness.fixture.debugElement.query(By.directive(type))!.componentInstance as T;
}
import { OrganizacionService } from '../services/organizacion.service';
import { OrganizacionListaPage } from '../pages/organizacion-lista';
import { OrganizacionRegistroPage } from '../pages/organizacion-registro';
import { Detalle, Entidad, Listado } from '../models/organizacion.models';
import { ciudad, listado, session, sucursal } from './organizacion.fixtures';

const paths = ['/admin/ciudades', '/admin/ciudades/nuevo', '/admin/ciudades/0', '/admin/ciudades/0/editar',
  '/admin/sucursales', '/admin/sucursales/nuevo', '/admin/sucursales/1', '/admin/sucursales/1/editar'];
describe('CU09 rutas y páginas', () => {
  const auth = { restore: vi.fn(), session: signal<typeof session | null>(session) };
  const service = { listar: vi.fn(), detalle: vi.fn(), crear: vi.fn(), editar: vi.fn(), horariosSugeridos: () => of([]) };
  beforeEach(() => {
    auth.restore.mockReset().mockReturnValue(of(session)); auth.session.set(session);
    service.listar.mockReset().mockImplementation((kind: Entidad) => of(kind === 'ciudades' ? { ...listado, items: [ciudad], total: 1 } : listado));
    service.detalle.mockReset().mockImplementation((kind: Entidad) => of(kind === 'ciudades' ? ciudad : sucursal));
    service.crear.mockReset().mockReturnValue(of(sucursal)); service.editar.mockReset().mockReturnValue(of(sucursal));
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AuthService, useValue: auth }, { provide: OrganizacionService, useValue: service }] });
  });
  it.each(paths)('protege sin sesión %s', async path => {
    auth.restore.mockReturnValue(of(null)); auth.session.set(null);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl(path);
    expect(TestBed.inject(Router).url).toBe('/login'); expect(service.listar).not.toHaveBeenCalled(); expect(service.detalle).not.toHaveBeenCalled();
  });
  it.each(paths)('sin bypass SuperAdmin en %s', async path => {
    const denied = { ...session, rol: { nro: 'superadmin', descripcion: 'SuperAdmin' }, permisos: ['CU05', 'CU06', 'CU07', 'CU08'] };
    auth.restore.mockReturnValue(of(denied)); auth.session.set(denied);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl(path);
    expect(TestBed.inject(Router).url).toBe('/acceso?motivo=sin-permiso'); expect(service.listar).not.toHaveBeenCalled(); expect(service.detalle).not.toHaveBeenCalled();
  });
  it.each([401, 403, 503])('guard falla cerrado HTTP %s', async status => {
    auth.restore.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl('/admin/sucursales');
    expect(TestBed.inject(Router).url).toBe(status === 401 ? '/login' : '/acceso?motivo=' + (status === 403 ? 'sin-permiso' : 'verificacion'));
  });
  it.each([true, false])('panel muestra enlace solo con CU09 %s', async allowed => {
    const current = { ...session, permisos: allowed ? ['CU09'] : [] }; auth.restore.mockReturnValue(of(current)); auth.session.set(current);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl('/admin'); await harness.fixture.whenStable(); harness.detectChanges();
    expect(!!harness.routeNativeElement?.querySelector('a[href="/admin/sucursales"]')).toBe(allowed);
  });
  it.each(['ciudades', 'sucursales'] as Entidad[])('lista, detalle, alta y edición %s', async kind => {
    const harness = await RouterTestingHarness.create(); const base = '/admin/' + kind;
    await openLeaf(harness, base, OrganizacionListaPage); harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector(`a[href="${base}/nuevo"]`)).toBeTruthy();
    const row = kind === 'ciudades' ? ciudad : sucursal; const id = kind === 'ciudades' ? 0 : 1;
    expect(harness.routeNativeElement?.textContent).toContain(row.nombre);
    const detail = await openLeaf(harness, base + '/' + id, OrganizacionRegistroPage); harness.detectChanges(); expect(detail.row()).toEqual(row);
    expect(harness.routeNativeElement?.querySelector(`a[href="${base}/${id}/editar"]`)).toBeTruthy();
    await openLeaf(harness, base + '/' + id + '/editar', OrganizacionRegistroPage); harness.detectChanges(); expect(harness.routeNativeElement?.querySelector('app-organizacion-formulario')).toBeTruthy();
    const create = await openLeaf(harness, base + '/nuevo', OrganizacionRegistroPage); harness.detectChanges(); expect(create.row()).toBeNull(); expect(create.ready()).toBe(true);
    expect(harness.routeNativeElement?.textContent).not.toContain('Eliminar');
  });
  it('filtra ciudad cero, estado y búsqueda; paginar conserva filtros y nueva búsqueda reinicia offset', async () => {
    const harness = await RouterTestingHarness.create(); const page = await openLeaf(harness, '/admin/sucursales', OrganizacionListaPage);
    page.form.patchValue({ q: ' Central ', idCiud: 0, estado: 'inactivo' }); page.aplicar(); page.pagina(20);
    expect(service.listar).toHaveBeenLastCalledWith('sucursales', { offset: 20, limit: 20, q: 'Central', idCiud: 0, estado: 'inactivo' });
    page.form.controls.q.setValue('Otra'); page.aplicar(); expect(page.filters.offset).toBe(0);
    expect(TestBed.inject(Router).url).not.toContain('q=');
  });
  it('rechaza filtros inválidos antes de HTTP', async () => {
    const harness = await RouterTestingHarness.create(); const page = await openLeaf(harness, '/admin/sucursales', OrganizacionListaPage);
    for (const idCiud of [-32769, 32768, 1.5]) { page.form.controls.idCiud.setValue(idCiud); page.aplicar(); }
    page.form.patchValue({ idCiud: null, q: 'x'.repeat(101) }); page.aplicar(); expect(service.listar).toHaveBeenCalledOnce();
  });
  it('carga, cancela respuesta anterior y muestra vacío', async () => {
    const pending = new Subject<Listado>(); service.listar.mockReturnValue(pending);
    const harness = await RouterTestingHarness.create(); const page = await openLeaf(harness, '/admin/sucursales', OrganizacionListaPage); harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Cargando'); page.aplicar(); expect(service.listar).toHaveBeenCalledOnce();
    service.listar.mockReturnValue(of({ ...listado, items: [], total: 0 })); page.form.controls.q.setValue('Otra'); page.aplicar();
    expect(pending.observed).toBe(false); pending.next(listado); harness.detectChanges(); expect(harness.routeNativeElement?.textContent).toContain('No hay registros');
  });
  it.each([401, 403, 404, 409, 422, 500])('carga y mutación HTTP %s sin éxito falso ni mensajes privados', async status => {
    const failure = throwError(() => new HttpErrorResponse({ status, error: { error: { message: 'private-marker' } } }));
    service.listar.mockReturnValue(failure);
    const harness = await RouterTestingHarness.create(); const listing = await openLeaf(harness, '/admin/sucursales', OrganizacionListaPage);
    expect(listing.error()).toBeTruthy(); expect(listing.result()).toBeNull();
    const edit = await openLeaf(harness, '/admin/sucursales/1/editar', OrganizacionRegistroPage); service.editar.mockReturnValue(failure); edit.guardar({ nombre: 'Otra' });
    expect(edit.error()).toBeTruthy(); expect(edit.error()).not.toContain('private-marker'); expect(edit.ready()).toBe(![401, 403, 404].includes(status));
    expect(TestBed.inject(Router).url).toContain('/editar');
    service.detalle.mockReturnValue(failure); await openLeaf(harness, '/admin/sucursales/2', OrganizacionRegistroPage);
    harness.detectChanges(); expect(harness.routeNativeElement?.querySelector('app-organizacion-formulario')).toBeNull(); expect(harness.routeNativeElement?.textContent).not.toContain('private-marker');
  });
  it.each(['/admin/ciudades/32768', '/admin/ciudades/abc/editar', '/admin/sucursales/2147483648', '/admin/sucursales/1.5'])('identificador inválido no consulta %s', async path => {
    const harness = await RouterTestingHarness.create(); const page = await openLeaf(harness, path, OrganizacionRegistroPage);
    expect(service.detalle).not.toHaveBeenCalled(); expect(page.error()).toContain('inválido');
  });
  it.each(['ciudades', 'sucursales'] as Entidad[])('crear %s navega a detalle y bloquea doble envío', async kind => {
    const pending = new Subject<Detalle>(); service.crear.mockReturnValue(pending);
    const harness = await RouterTestingHarness.create(); const page = await openLeaf(harness, '/admin/' + kind + '/nuevo', OrganizacionRegistroPage);
    const input = kind === 'ciudades' ? { id: 0, nombre: 'Ciudad' } : { nombre: 'Central', direccion: 'Calle', idCiud: 0, estado: 'activo' as const };
    page.guardar(input); page.guardar(input); expect(service.crear).toHaveBeenCalledExactlyOnceWith(kind, input);
    pending.next(kind === 'ciudades' ? ciudad : sucursal); pending.complete(); await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/admin/' + kind + '/' + (kind === 'ciudades' ? 0 : 1));
  });
  it('editar bloquea payload vacío/doble envío y cancela mutación al cambiar id', async () => {
    const pending = new Subject<Detalle>(); service.editar.mockReturnValue(pending);
    const harness = await RouterTestingHarness.create(); const page = await openLeaf(harness, '/admin/sucursales/1/editar', OrganizacionRegistroPage);
    page.guardar({}); expect(service.editar).not.toHaveBeenCalled(); page.guardar({ estado: 'inactivo' }); page.guardar({ estado: 'inactivo' });
    expect(service.editar).toHaveBeenCalledExactlyOnceWith('sucursales', 1, { estado: 'inactivo' });
    service.detalle.mockReturnValue(of({ ...sucursal, nro: 2 })); const next = await openLeaf(harness, '/admin/sucursales/2/editar', OrganizacionRegistroPage);
    expect(pending.observed).toBe(false); pending.next(sucursal); await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/admin/sucursales/2/editar'); expect(next.row()).toEqual({ ...sucursal, nro: 2 }); expect(next.busy()).toBe(false);
  });
  it('cancela detalle pendiente al cambiar id y listado al salir', async () => {
    const pending = new Subject<Detalle>(); service.detalle.mockReturnValue(pending);
    const harness = await RouterTestingHarness.create(); await openLeaf(harness, '/admin/ciudades/0', OrganizacionRegistroPage);
    service.detalle.mockReturnValue(of({ id: 1, nombre: 'Otra' })); const next = await openLeaf(harness, '/admin/ciudades/1', OrganizacionRegistroPage);
    expect(pending.observed).toBe(false); pending.next(ciudad); expect(next.row()).toEqual({ id: 1, nombre: 'Otra' });
    const listing = new Subject<Listado>(); service.listar.mockReturnValue(listing); await openLeaf(harness, '/admin/ciudades', OrganizacionListaPage);
    await openLeaf(harness, '/admin/ciudades/1', OrganizacionRegistroPage); expect(listing.observed).toBe(false);
  });
});

describe('CU09 guard servidor', () => {
  it('no restaura sesión ni permite acceso durante SSR', () => {
    const auth = { restore: vi.fn() }; TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }, { provide: AuthService, useValue: auth }] });
    expect(TestBed.runInInjectionContext(() => permissionGuard('CU09')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot))).toBe(false); expect(auth.restore).not.toHaveBeenCalled();
  });
});
