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
import { BitacoraService } from '../services/bitacora.service';
import { BitacoraDetalle, BitacoraListado } from '../models/bitacora.models';
import { BitacoraListaPage } from '../pages/bitacora-lista/bitacora-lista';
import { BitacoraDetallePage } from '../pages/bitacora-detalle/bitacora-detalle';
import { listado, registro, session } from './bitacora.fixtures';

describe('CU08 rutas, UI, cancelación y privacidad', () => {
  let active: RouterTestingHarness | undefined;
  const auth = { restore: vi.fn(), session: signal<AuthResponse | null>(session) };
  const service = { listar: vi.fn(), detalle: vi.fn() };
  beforeEach(() => {
    active = undefined; auth.restore.mockReset().mockReturnValue(of(session)); auth.session.set(session);
    service.listar.mockReset().mockReturnValue(of(listado)); service.detalle.mockReset().mockReturnValue(of(registro));
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AuthService, useValue: auth }, { provide: BitacoraService, useValue: service }] });
  });
  afterEach(() => vi.restoreAllMocks());
  async function open<T>(path: string, type: Type<T>) {
    // Las páginas administrativas viven dentro de AdminLayout: la ruta raíz
    // activa el layout y la hoja se resuelve en su router-outlet.
    const harness = active ??= await RouterTestingHarness.create(); await harness.navigateByUrl(path, AdminLayout);
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    const page = harness.fixture.debugElement.query(By.directive(type))!.componentInstance as T;
    return { harness, page };
  }
  it('lista en orden del servidor y conserva bigint en texto y enlace', async () => {
    service.listar.mockReturnValue(of({ ...listado, items: [listado.items[0], { ...listado.items[0], id: '2' }] }));
    const { harness } = await open('/admin/bitacora', BitacoraListaPage);
    const rows = harness.routeNativeElement!.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain(registro.id); expect(rows[1].textContent).toContain('2');
    expect(harness.routeNativeElement?.querySelector(`a[href="/admin/bitacora/${registro.id}"]`)).toBeTruthy();
    expect(harness.routeNativeElement?.textContent).toContain('Fecha UTC (ISO original)');
    expect(harness.routeNativeElement?.textContent).toContain(registro.fecha);
    expect(harness.routeNativeElement?.textContent).toContain('Sin identificación registrada');
    expect(harness.routeNativeElement?.textContent).not.toContain('Editar');
  });
  it('filtros/paginación/retry solo memoria sin URL/history/storage y reinicio al salir', async () => {
    const { harness, page } = await open('/admin/bitacora', BitacoraListaPage);
    const router = TestBed.inject(Router), navigate = vi.spyOn(router, 'navigate');
    const storage = vi.spyOn(Storage.prototype, 'setItem'), push = vi.spyOn(history, 'pushState'), replace = vi.spyOn(history, 'replaceState');
    const filters = { offset: 0, limit: 10, usuario_id: 'sensitive-filter-marker', desde: registro.fecha };
    page.aplicar(filters); page.pagina(10); page.load(); harness.detectChanges();
    expect(service.listar).toHaveBeenLastCalledWith({ ...filters, offset: 10 });
    expect(router.url).toBe('/admin/bitacora'); expect(navigate).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled(); expect(push).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
    expect(JSON.stringify(history.state)).not.toContain(filters.usuario_id);
    for (const link of harness.routeNativeElement!.querySelectorAll('a')) expect(link.href).not.toContain(filters.usuario_id);
    await harness.navigateByUrl('/admin/bitacora/' + registro.id, AdminLayout);
    await harness.navigateByUrl('/admin/bitacora', AdminLayout);
    expect(service.listar).toHaveBeenLastCalledWith({ offset: 0, limit: 20 });
  });
  it('no restaura filtros de query params ni los propaga a enlaces', async () => {
    const { harness } = await open('/admin/bitacora?usuario_id=sensitive-query-marker&offset=20', BitacoraListaPage);
    expect(service.listar).toHaveBeenLastCalledWith({ offset: 0, limit: 20 });
    for (const link of harness.routeNativeElement!.querySelectorAll('a')) expect(link.href).not.toContain('sensitive-query-marker');
  });
  it('paginación visible, vacíos y filtros reinician offset', async () => {
    const { harness, page } = await open('/admin/bitacora', BitacoraListaPage);
    const buttons = harness.routeNativeElement!.querySelectorAll('nav[aria-label="Paginación"] button');
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true); (buttons[1] as HTMLButtonElement).click();
    expect(service.listar).toHaveBeenLastCalledWith({ offset: 20, limit: 20 });
    service.listar.mockReturnValue(of({ ...listado, total: 0, items: [] })); page.aplicar({ offset: 99, limit: 20 }); harness.detectChanges();
    expect(service.listar).toHaveBeenLastCalledWith({ offset: 0, limit: 20 }); expect(harness.routeNativeElement?.textContent).toContain('No hay registros');
  });
  it('detalle sin actor ni acción identificada y sin JSON bruto', async () => {
    service.detalle.mockReturnValue(of({ ...registro, accion: null, detalles: null }));
    const { harness } = await open('/admin/bitacora/' + registro.id, BitacoraDetallePage);
    expect(service.detalle).toHaveBeenLastCalledWith(registro.id);
    const text = harness.routeNativeElement?.textContent;
    expect(text).toContain('Sin identificación registrada'); expect(text).toContain('Acción no reconocida');
    expect(text).toContain('Sin resultado disponible'); expect(text).toContain(registro.fecha);
    expect(harness.routeNativeElement?.querySelector('pre')).toBeNull();
  });
  it.each([401, 403, 404, 422])('limpia datos antiguos y muestra error fijo HTTP %s en ambas páginas', async status => {
    const { page, harness } = await open('/admin/bitacora', BitacoraListaPage);
    const failure = throwError(() => new HttpErrorResponse({ status, error: { error: { message: 'secret-marker' } } }));
    service.listar.mockReturnValue(failure); page.load(); harness.detectChanges();
    expect(page.result()).toBeNull(); expect(page.error()).toBeTruthy(); expect(harness.routeNativeElement?.textContent).not.toContain('secret-marker');
    const detail = await open('/admin/bitacora/' + registro.id, BitacoraDetallePage);
    service.detalle.mockReturnValue(failure); detail.page.load(); detail.harness.detectChanges();
    expect(detail.page.registro()).toBeNull(); expect(detail.page.error()).toBeTruthy(); expect(detail.harness.routeNativeElement?.textContent).not.toContain('secret-marker');
  });
  it('cancelación al filtrar y salir; respuesta tardía no sobrescribe', async () => {
    const pending = new Subject<BitacoraListado>(); service.listar.mockReturnValue(pending);
    const { page, harness } = await open('/admin/bitacora', BitacoraListaPage);
    expect(page.busy()).toBe(true);
    service.listar.mockReturnValue(of({ ...listado, total: 0, items: [] })); page.aplicar({ offset: 0, limit: 10 });
    expect(pending.observed).toBe(false); pending.next(listado); expect(page.result()?.total).toBe(0);
    service.listar.mockReturnValue(pending); page.load(); expect(page.result()).toBeNull();
    await harness.navigateByUrl('/admin/bitacora/' + registro.id, AdminLayout); expect(pending.observed).toBe(false);
  });
  it('cancela detalle al cambiar ID y salir', async () => {
    const pending = new Subject<BitacoraDetalle>(); service.detalle.mockReturnValue(pending);
    const { harness } = await open('/admin/bitacora/' + registro.id, BitacoraDetallePage);
    service.detalle.mockReturnValue(of({ ...registro, id: '2' }));
    await harness.navigateByUrl('/admin/bitacora/2', AdminLayout); harness.detectChanges();
    const page = harness.fixture.debugElement.query(By.directive(BitacoraDetallePage))!.componentInstance as BitacoraDetallePage;
    expect(pending.observed).toBe(false); pending.next(registro); expect(page.registro()?.id).toBe('2');
    service.detalle.mockReturnValue(pending); page.load();
    await harness.navigateByUrl('/admin/bitacora', AdminLayout); expect(pending.observed).toBe(false);
  });
  it.each(['/admin/bitacora', '/admin/bitacora/9007199254740993'])('sin sesión bloquea %s', async path => {
    auth.restore.mockReturnValue(of(null)); auth.session.set(null);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl(path);
    expect(TestBed.inject(Router).url).toBe('/login'); expect(service.listar).not.toHaveBeenCalled(); expect(service.detalle).not.toHaveBeenCalled();
  });
  it.each(['/admin/bitacora', '/admin/bitacora/9007199254740993'])('sin CU08 bloquea %s sin bypass de rol', async path => {
    const denied = { ...session, permisos: ['CU05', 'CU06', 'CU07'], rol: { nro: 'superadmin', descripcion: 'SuperAdmin' } };
    auth.restore.mockReturnValue(of(denied)); auth.session.set(denied);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl(path);
    expect(TestBed.inject(Router).url).toBe('/acceso?motivo=sin-permiso'); expect(service.listar).not.toHaveBeenCalled(); expect(service.detalle).not.toHaveBeenCalled();
  });
  it.each([true, false])('enlace panel depende solo de CU08: %s', async allowed => {
    const current = { ...session, permisos: allowed ? ['CU08'] : ['CU07'] }; auth.restore.mockReturnValue(of(current)); auth.session.set(current);
    const harness = await RouterTestingHarness.create(); await harness.navigateByUrl('/admin'); await harness.fixture.whenStable(); harness.detectChanges();
    expect(!!harness.routeNativeElement?.querySelector('a[href="/admin/bitacora"]')).toBe(allowed);
  });
});

describe('CU08 guard SSR', () => {
  it('admin Client y guard servidor falla cerrado sin restaurar sesión', () => {
    const auth = { restore: vi.fn() };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: PLATFORM_ID, useValue: 'server' }, { provide: AuthService, useValue: auth }] });
    expect(TestBed.runInInjectionContext(() => permissionGuard('CU08')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot))).toBe(false);
    expect(auth.restore).not.toHaveBeenCalled(); expect(serverRoutes[0]).toEqual({ path: 'admin/**', renderMode: RenderMode.Client });
  });
});
