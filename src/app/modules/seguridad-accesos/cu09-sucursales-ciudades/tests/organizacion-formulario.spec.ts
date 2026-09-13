import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OrganizacionFormulario } from '../components/organizacion-formulario';
import { Detalle, Entidad } from '../models/organizacion.models';
import { ciudad, sucursal } from './organizacion.fixtures';

describe('CU09 formularios', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  function setup(kind: Entidad, initial: Detalle | null = null) {
    const fixture = TestBed.createComponent(OrganizacionFormulario); fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('initial', initial); fixture.detectChanges();
    const page = fixture.componentInstance; const save = vi.fn(); page.guardar.subscribe(save);
    return { fixture, page, save };
  }
  it.each([-32768, -1, 0, 32767])('ciudad permite id manual %s y recorta nombre', id => {
    const { page, save } = setup('ciudades'); page.form.patchValue({ id, nombre: ' Nueva ' }); page.enviar();
    expect(save).toHaveBeenCalledExactlyOnceWith({ id, nombre: 'Nueva' });
  });
  it.each([null, -32769, 32768, 1.5])('ciudad rechaza id %s', id => {
    const { page, save } = setup('ciudades'); page.form.patchValue({ id, nombre: 'Nueva' }); page.enviar(); expect(save).not.toHaveBeenCalled();
  });
  it.each(['', '   ', 'x'.repeat(51)])('rechaza nombre inválido', nombre => {
    const { page, save } = setup('ciudades'); page.form.patchValue({ id: 0, nombre }); page.enviar(); expect(save).not.toHaveBeenCalled(); expect(page.error()).toBeTruthy();
  });
  it('edita solo nombre de ciudad y no permite cambiar id ni estado', () => {
    const { fixture, page, save } = setup('ciudades', ciudad);
    expect(fixture.nativeElement.querySelector('#ciudad-id')).toBeNull(); expect(fixture.nativeElement.querySelector('#org-estado')).toBeNull();
    page.form.patchValue({ id: 12, nombre: ' Nueva ', estado: 'inactivo' }); page.enviar(); expect(save).toHaveBeenCalledExactlyOnceWith({ nombre: 'Nueva' });
  });
  it.each(['ciudades', 'sucursales'] as Entidad[])('no-op %s no emite', kind => {
    const { page, save } = setup(kind, kind === 'ciudades' ? ciudad : sucursal); page.enviar();
    expect(save).not.toHaveBeenCalled(); expect(page.error()).toContain('No hay cambios');
  });
  it('alta sucursal incluye estado real, ciudad cero y no nro', () => {
    const { page, save } = setup('sucursales'); page.form.patchValue({ nombre: ' Central ', direccion: ' Calle ', idCiud: 0 }); page.enviar();
    expect(save).toHaveBeenCalledExactlyOnceWith({ nombre: 'Central', direccion: 'Calle', idCiud: 0, estado: 'activo' });
  });
  it.each([null, -32769, 32768, 1.5])('sucursal rechaza ciudad %s', idCiud => {
    const { page, save } = setup('sucursales', sucursal); page.form.patchValue({ idCiud }); page.enviar(); expect(save).not.toHaveBeenCalled();
  });
  it.each(['', '  ', 'x'.repeat(101)])('sucursal rechaza dirección inválida', direccion => {
    const { page, save } = setup('sucursales', sucursal); page.form.patchValue({ direccion }); page.enviar(); expect(save).not.toHaveBeenCalled();
  });
  it('longitudes máximas válidas', () => {
    const { page, save } = setup('sucursales'); page.form.patchValue({ nombre: 'x'.repeat(50), direccion: 'x'.repeat(100), idCiud: 32767 }); page.enviar(); expect(save).toHaveBeenCalledOnce();
  });
  it('cambiar ciudad y estado no emite campos intactos ni dependientes', () => {
    const { fixture, page, save } = setup('sucursales', sucursal); page.form.patchValue({ idCiud: -32768, estado: 'inactivo' }); page.enviar();
    expect(save).toHaveBeenCalledExactlyOnceWith({ idCiud: -32768, estado: 'inactivo' });
    expect(fixture.nativeElement.textContent).toContain('No elimina');
    for (const name of ['empleados', 'inventario', 'ventas', 'horarios', 'nro']) expect(page.form.get(name)).toBeNull();
  });
  it('busy bloquea envío sin reiniciar los campos; otro registro sí los reinicia', () => {
    const { fixture, page, save } = setup('sucursales', sucursal); page.form.controls.nombre.setValue('Nueva');
    fixture.componentRef.setInput('busy', true); fixture.detectChanges(); page.enviar();
    expect(save).not.toHaveBeenCalled(); expect(page.form.controls.nombre.value).toBe('Nueva');
    fixture.componentRef.setInput('initial', { ...sucursal, nro: 2, nombre: 'Otra' }); fixture.detectChanges(); expect(page.form.controls.nombre.value).toBe('Otra');
  });
});
