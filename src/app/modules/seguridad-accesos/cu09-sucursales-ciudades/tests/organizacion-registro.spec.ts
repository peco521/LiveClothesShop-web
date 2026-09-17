import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { OrganizacionRegistroPage } from '../pages/organizacion-registro';
import { Entidad } from '../models/organizacion.models';
import { OrganizacionService } from '../services/organizacion.service';
import { ciudad, sucursal } from './organizacion.fixtures';

describe('CU09 detalle y confirmación de guardado', () => {
  const service = { detalle: vi.fn(), crear: vi.fn(), editar: vi.fn(),
    listar: () => of({ items: [ciudad], total: 1, offset: 0, limit: 100 }), horariosSugeridos: () => of([]) };
  const kinds: Entidad[] = ['ciudades', 'sucursales'];
  beforeEach(() => {
    service.detalle.mockReset().mockImplementation((kind: Entidad, id: number) => of(kind === 'ciudades' ? { ...ciudad, id } : { ...sucursal, nro: id }));
    service.crear.mockReset().mockImplementation((kind: Entidad) => of(kind === 'ciudades' ? ciudad : sucursal));
    service.editar.mockReset().mockImplementation((kind: Entidad) => of(kind === 'ciudades' ? ciudad : sucursal));
    TestBed.configureTestingModule({ providers: [provideRouter(kinds.flatMap(kind => [
      { path: `admin/${kind}/nuevo`, component: OrganizacionRegistroPage, data: { kind, mode: 'crear' } },
      { path: `admin/${kind}/:id/editar`, component: OrganizacionRegistroPage, data: { kind, mode: 'editar' } },
      { path: `admin/${kind}/:id`, component: OrganizacionRegistroPage, data: { kind, mode: 'detalle' } },
    ])), { provide: OrganizacionService, useValue: service }] });
  });

  it.each(kinds)('muestra datos ordenados y no anuncia un guardado al abrir directamente %s', async kind => {
    const id = kind === 'ciudades' ? ciudad.id : sucursal.nro;
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/admin/${kind}/${id}`, OrganizacionRegistroPage); harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('.record-panel')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('.record-details')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector(`a.button[href="/admin/${kind}/${id}/editar"]`)).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('.saved-notice')).toBeNull();
  });

  it.each(kinds)('confirma una creación de %s solamente después de la respuesta exitosa', async kind => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(`/admin/${kind}/nuevo`, OrganizacionRegistroPage);
    page.guardar(kind === 'ciudades' ? { nombre: ciudad.nombre } : {
      nombre: sucursal.nombre, direccion: sucursal.direccion, idCiud: ciudad.id, estado: 'activo',
    });
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(service.crear).toHaveBeenCalledOnce();
    const notice = harness.routeNativeElement?.querySelector('.saved-notice');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toContain('guardada correctamente');
  });

  it.each(kinds)('confirma una edición de %s', async kind => {
    const id = kind === 'ciudades' ? ciudad.id : sucursal.nro;
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(`/admin/${kind}/${id}/editar`, OrganizacionRegistroPage);
    page.guardar({ nombre: 'Actualizada' }); await harness.fixture.whenStable(); harness.detectChanges();
    expect(service.editar).toHaveBeenCalledExactlyOnceWith(kind, id, { nombre: 'Actualizada' });
    expect(harness.routeNativeElement?.querySelector('.saved-notice')?.textContent).toContain('guardada correctamente');
  });

  it('no muestra confirmación ni navega cuando falla el guardado', async () => {
    service.editar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(`/admin/ciudades/${ciudad.id}/editar`, OrganizacionRegistroPage);
    page.guardar({ nombre: 'Otra' }); harness.detectChanges();
    expect(page.error()).not.toBe('');
    expect(TestBed.inject(Router).url).toBe(`/admin/ciudades/${ciudad.id}/editar`);
    expect(harness.routeNativeElement?.querySelector('.saved-notice')).toBeNull();
  });

  it('no muestra un guardado destinado a otro registro', async () => {
    const harness = await RouterTestingHarness.create();
    await TestBed.inject(Router).navigate(['/admin/ciudades', ciudad.id], { state: { savedOrganization: { kind: 'ciudades', id: 999 } } });
    harness.detectChanges(); expect(harness.routeNativeElement?.querySelector('.saved-notice')).toBeNull();
  });
});
