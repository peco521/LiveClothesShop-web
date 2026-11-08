import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { AuthResponse } from '../../../seguridad-accesos/models/auth.models';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { CatalogoListaPage } from '../pages/catalogo-lista/catalogo-lista';
import { CatalogoService } from '../services/catalogo.service';
import { ProductosListado } from '../models/catalogo.models';
import { clienteSession, facetas, list } from './catalogo.fixtures';

describe('Menú de categorías del catálogo', () => {
  const service = { listar: vi.fn(), faceta: vi.fn() };
  const auth = { session: signal<AuthResponse | null>(clienteSession) };
  beforeEach(() => {
    auth.session.set(clienteSession);
    service.listar.mockReset().mockReturnValue(of(list));
    service.faceta.mockReset().mockReturnValue(of(facetas));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }, { provide: CatalogoService, useValue: service }] });
  });
  function open() { const fixture = TestBed.createComponent(CatalogoListaPage); fixture.detectChanges(); return { fixture, page: fixture.componentInstance }; }
  it('limpia caché, filtros y respuestas pendientes al cambiar de empresa/cuenta', () => {
    const { fixture, page } = open();
    page.explore({ id: 1, nombre: 'Camisas' });
    expect(page.preview()).toBeTruthy();
    const pending = new Subject<ProductosListado>();
    service.listar.mockReturnValueOnce(pending);
    page.load();
    service.listar.mockReturnValue(of({ items: [], total: 0, offset: 0, limit: 20 }));
    auth.session.set({ ...clienteSession, empresa: 'otra', usuario: { ...clienteSession.usuario, idUsuario: 'otro' } });
    fixture.detectChanges();
    pending.next(list); pending.complete();
    expect(page.result()?.total).toBe(0);
    expect(page.preview()).toBeNull();
    expect(page.activeCategory()).toBeNull();
    page.explore({ id: 1, nombre: 'Otra categoría' });
    expect(page.preview()?.products.total).toBe(0);
    auth.session.set(null); fixture.detectChanges();
    expect(page.result()).toBeNull(); expect(page.facetas()).toEqual({}); expect(page.preview()).toBeNull();
  });
  it('empieza compacto y despliega categorías al pasar el mouse', () => {
    const { fixture, page } = open();
    expect(page.categoriesOpen()).toBe(false); expect(page.advancedOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('#category-panel').hasAttribute('inert')).toBe(true);
    fixture.nativeElement.querySelector('.category-browser').dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(page.categoriesOpen()).toBe(true);
    expect(service.faceta).toHaveBeenCalledWith('marcas', 1);
    expect(service.listar).toHaveBeenCalledWith({ offset: 0, limit: 6, idCat: 1, sort: 'nombre_asc' });
  });
  it('permite un segundo clic y Escape para cerrar', () => {
    const { fixture, page } = open();
    const trigger = fixture.nativeElement.querySelector('.category-trigger');
    trigger.click(); fixture.detectChanges(); expect(page.categoriesOpen()).toBe(true);
    trigger.click(); fixture.detectChanges(); expect(page.categoriesOpen()).toBe(false);
    trigger.click(); fixture.detectChanges();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(page.categoriesOpen()).toBe(false);
  });
  it('aplica categoría y marca juntas sin afectar los demás filtros', () => {
    const { page } = open(); page.form.patchValue({ minPrecio: 15 });
    page.openCategories(); page.chooseCategory({ id: 2, nombre: 'Pantalones' }, { id: 8, nombre: 'Marca' });
    expect(service.listar).toHaveBeenLastCalledWith(expect.objectContaining({ idCat: 2, idMarca: 8, minPrecio: 15, offset: 0 }));
    expect(page.categoriesOpen()).toBe(false);
  });
  it('no inventa categorías cuando no hay datos', () => {
    service.faceta.mockReturnValue(of({ items: [], total: 0 }));
    const { fixture, page } = open(); page.openCategories(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aún no hay categorías registradas.');
    expect(page.preview()).toBeNull();
  });
  it('cancela una categoría anterior y reutiliza su caché', () => {
    const { page } = open(); const pending = new Subject<ProductosListado>();
    service.listar.mockReturnValueOnce(pending);
    page.explore({ id: 1, nombre: 'Camisas' });
    page.explore({ id: 2, nombre: 'Pantalones' });
    pending.next({ ...list, total: 99 }); pending.complete();
    expect(page.activeCategory()?.id).toBe(2); expect(page.preview()?.products.total).toBe(2);
    const calls = service.listar.mock.calls.length;
    page.explore({ id: 2, nombre: 'Pantalones' }); expect(service.listar.mock.calls.length).toBe(calls);
  });
  it('muestra un error de categoría y permite reintentar', () => {
    const { page } = open(); service.listar.mockReturnValueOnce(throwError(() => new Error('falló')));
    page.explore({ id: 1, nombre: 'Camisas' }); expect(page.previewError()).toBeTruthy();
    page.explore({ id: 1, nombre: 'Camisas' }, true);
    expect(page.previewError()).toBe(''); expect(page.preview()).toBeTruthy();
  });
});
