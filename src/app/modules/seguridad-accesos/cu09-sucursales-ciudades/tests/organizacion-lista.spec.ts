import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OrganizacionListaPage } from '../pages/organizacion-lista';
import { OrganizacionService } from '../services/organizacion.service';
import { ciudad, listado, sucursal } from './organizacion.fixtures';

describe('CU09 filtro de ciudad por nombre', () => {
  const list = vi.fn();
  beforeEach(() => {
    list.mockReset().mockImplementation((kind: string) => of(kind === 'ciudades'
      ? { items: [ciudad], total: 1, offset: 0, limit: 100 } : listado));
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { data: { kind: 'sucursales' } } } },
      { provide: OrganizacionService, useValue: { listar: list } }] });
  });
  it('muestra un selector con nombres, conserva Todos y filtra usando el ID interno', () => {
    const fixture = TestBed.createComponent(OrganizacionListaPage); fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('#f-ciudad') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT'); expect(select.options[0].textContent).toBe('Todas las ciudades');
    expect(select.options[1].textContent).toBe(ciudad.nombre);
    expect(fixture.nativeElement.textContent).not.toContain('Ciudad (identificador)');
    fixture.componentInstance.form.controls.idCiud.setValue(ciudad.id); fixture.componentInstance.aplicar();
    expect(list).toHaveBeenLastCalledWith('sucursales', { offset: 0, limit: 20, q: '', idCiud: ciudad.id });
  });
  it('muestra sucursales en una tabla con sus campos y conserva detalle y edición', () => {
    const fixture = TestBed.createComponent(OrganizacionListaPage); fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(Array.from(element.querySelectorAll('thead th')).map(th => th.textContent)).toEqual(['Nombre', 'Ciudad', 'Ubicación', 'Estado', 'Acciones']);
    expect(Array.from(element.querySelectorAll('tbody tr:first-child td')).map(td => td.textContent?.trim())).toEqual([sucursal.nombre, sucursal.ciudad.nombre, sucursal.direccion, sucursal.estado, 'Editar']);
    expect(element.querySelector(`tbody a[href="/admin/sucursales/${sucursal.nro}"]`)).toBeTruthy();
    expect(element.querySelector(`tbody a[href="/admin/sucursales/${sucursal.nro}/editar"]`)).toBeTruthy();
    expect(element.querySelector('ul')).toBeNull();
  });

  it('muestra ciudades en una tabla y conserva sus enlaces', () => {
    TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { kind: 'ciudades' } } } });
    const fixture = TestBed.createComponent(OrganizacionListaPage); fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(Array.from(element.querySelectorAll('thead th')).map(th => th.textContent)).toEqual(['ID', 'Nombre', 'Acciones']);
    expect(Array.from(element.querySelectorAll('tbody td')).map(td => td.textContent?.trim())).toEqual([String(ciudad.id), ciudad.nombre, 'Editar']);
    expect(element.querySelector(`tbody a[href="/admin/ciudades/${ciudad.id}"]`)).toBeTruthy();
    expect(element.querySelector(`tbody a[href="/admin/ciudades/${ciudad.id}/editar"]`)).toBeTruthy();
  });

  it('mantiene el mensaje vacío y la paginación sin mostrar una tabla sin datos', () => {
    list.mockReturnValue(of({ items: [], total: 0, offset: 0, limit: 20 }));
    const fixture = TestBed.createComponent(OrganizacionListaPage); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay registros.');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    const buttons = fixture.nativeElement.querySelectorAll('nav[aria-label="Paginación"] button') as NodeListOf<HTMLButtonElement>;
    expect(buttons[0].disabled).toBe(true); expect(buttons[1].disabled).toBe(true);
  });

  it('carga todas las páginas y permite reintentar errores', () => {
    list.mockImplementationOnce(() => of(listado)).mockImplementationOnce(() => throwError(() => new Error('private')));
    const fixture = TestBed.createComponent(OrganizacionListaPage); fixture.detectChanges();
    const page = fixture.componentInstance; expect(page.cityError()).toBeTruthy();
    list.mockImplementationOnce(() => of({ items: [ciudad], total: 2, offset: 0, limit: 100 }))
      .mockImplementationOnce(() => of({ items: [{ id: 2, nombre: 'Segunda' }], total: 2, offset: 1, limit: 100 }));
    page.loadCities(); expect(page.cityError()).toBe(''); expect(page.cities()).toHaveLength(2);
  });
});
