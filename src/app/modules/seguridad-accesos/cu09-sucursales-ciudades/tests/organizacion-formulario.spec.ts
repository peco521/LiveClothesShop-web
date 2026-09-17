import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OrganizacionFormulario } from '../components/organizacion-formulario';
import { Detalle, Entidad } from '../models/organizacion.models';
import { ciudad, sucursal } from './organizacion.fixtures';
import { of, throwError } from 'rxjs';
import { OrganizacionService } from '../services/organizacion.service';

describe('CU09 formularios', () => {
  const registeredCities = [ciudad, { id: -32768, nombre: 'Otra ciudad' }, { id: 32767, nombre: 'Ciudad extrema' }];
  const listCities = vi.fn();
  beforeEach(() => {
    listCities.mockReset().mockReturnValue(of({ items: registeredCities, total: registeredCities.length, offset: 0, limit: 100 }));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: OrganizacionService, useValue: { listar: listCities, horariosSugeridos: () => of([{ idAten: 1, horaIni: '09:00:00', horaFin: '17:00:00' }]) } }] });
  });
  function setup(kind: Entidad, initial: Detalle | null = null) {
    const fixture = TestBed.createComponent(OrganizacionFormulario); fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('initial', initial); fixture.detectChanges();
    const page = fixture.componentInstance; const save = vi.fn(); page.guardar.subscribe(save);
    return { fixture, page, save };
  }
  it('crea ciudad solo con nombre, sin identificador manual', () => {
    const { fixture, page, save } = setup('ciudades'); page.form.patchValue({ nombre: ' Nueva ' }); page.enviar();
    expect(save).toHaveBeenCalledExactlyOnceWith({ nombre: 'Nueva' });
    expect(fixture.nativeElement.querySelector('#ciudad-id')).toBeNull();
    expect(page.form.get('id')).toBeNull();
  });
  it.each(['', '   ', 'x'.repeat(51)])('rechaza nombre inválido', nombre => {
    const { page, save } = setup('ciudades'); page.form.patchValue({ nombre }); page.enviar(); expect(save).not.toHaveBeenCalled(); expect(page.error()).toBeTruthy();
  });
  it('edita solo nombre de ciudad y no permite cambiar id ni estado', () => {
    const { fixture, page, save } = setup('ciudades', ciudad);
    expect(fixture.nativeElement.querySelector('#ciudad-id')).toBeNull(); expect(fixture.nativeElement.querySelector('#org-estado')).toBeNull();
    page.form.patchValue({ nombre: ' Nueva ', estado: 'inactivo' }); page.enviar(); expect(save).toHaveBeenCalledExactlyOnceWith({ nombre: 'Nueva' });
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
    for (const name of ['empleados', 'inventario', 'ventas', 'nro']) expect(page.form.get(name)).toBeNull();
  });
  it('selector muestra nombres y conserva el identificador solo como valor interno', () => {
    const { fixture } = setup('sucursales', sucursal);
    const select = fixture.nativeElement.querySelector('#org-ciudad') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect([...select.options].slice(1).map(option => option.textContent)).toEqual([...registeredCities].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(city => city.nombre));
    expect(select.title).toContain(ciudad.nombre);
  });
  it('carga todas las páginas de ciudades', () => {
    listCities.mockReturnValueOnce(of({ items: [ciudad], total: 2, offset: 0, limit: 100 }))
      .mockReturnValueOnce(of({ items: [{ id: 2, nombre: 'Segunda' }], total: 2, offset: 1, limit: 100 }));
    const { page } = setup('sucursales');
    expect(page.cities()).toHaveLength(2);
    expect(listCities).toHaveBeenLastCalledWith('ciudades', { offset: 1, limit: 100, q: '' });
  });
  it('permite reintentar después de un error sin guardar una ciudad inexistente', () => {
    listCities.mockReturnValueOnce(throwError(() => new Error('private-marker')));
    const { page, save } = setup('sucursales');
    expect(page.cityError()).not.toContain('private-marker');
    page.form.patchValue({ nombre: 'Sucursal', direccion: 'Calle', idCiud: 99 }); page.enviar();
    expect(save).not.toHaveBeenCalled();
    page.loadCities(); expect(page.cityError()).toBe(''); expect(page.cities()).toHaveLength(3);
  });
  it('busy bloquea envío sin reiniciar los campos; otro registro sí los reinicia', () => {

    const { fixture, page, save } = setup('sucursales', sucursal); page.form.controls.nombre.setValue('Nueva');
    fixture.componentRef.setInput('busy', true); fixture.detectChanges(); page.enviar();
    expect(save).not.toHaveBeenCalled(); expect(page.form.controls.nombre.value).toBe('Nueva');
    fixture.componentRef.setInput('initial', { ...sucursal, nro: 2, nombre: 'Otra' }); fixture.detectChanges(); expect(page.form.controls.nombre.value).toBe('Otra');
  });
  it('permite agregar horarios al crear una sucursal', () => {
    const { page, save } = setup('sucursales');
    page.form.patchValue({ nombre: 'Central', direccion: 'Calle', idCiud: 0 });
    page.addHours({ horaIni: '08:00', horaFin: '18:00' }); page.enviar();
    expect(save).toHaveBeenCalledExactlyOnceWith({ nombre: 'Central', direccion: 'Calle', idCiud: 0, estado: 'activo', horarios: [{ horaIni: '08:00:00', horaFin: '18:00:00', dias: [1,2,3,4,5,6,7] }] });
  });
  it('carga los horarios existentes y permite editarlos o quitarlos', () => {
    const { page, save } = setup('sucursales', { ...sucursal, horarios: [{ horaIni: '08:00:00', horaFin: '18:00:00' }] });
    expect(page.form.controls.horarios.getRawValue()).toEqual([{ horaIni: '08:00:00', horaFin: '18:00:00', dias: [1,2,3,4,5,6,7] }]);
    page.enviar(); expect(save).not.toHaveBeenCalled();
    page.form.controls.horarios.at(0).controls.horaFin.setValue('17:00'); page.enviar();
    expect(save).toHaveBeenLastCalledWith({ horarios: [{ horaIni: '08:00:00', horaFin: '17:00:00', dias: [1,2,3,4,5,6,7] }] });
    page.form.controls.horarios.clear(); page.enviar(); expect(save).toHaveBeenLastCalledWith({ horarios: [] });
  });
  it('selecciona días con botones y copia sugerencias sin cambiar los días', () => {
    const { fixture, page, save } = setup('sucursales');
    page.form.patchValue({ nombre: 'Central', direccion: 'Calle', idCiud: 0 });
    expect(fixture.nativeElement.querySelectorAll('.day-button')).toHaveLength(7);
    page.toggleDay(0, 1); page.toggleDay(0, 3); page.applySuggestion(0, '1'); page.enviar();
    expect(save).toHaveBeenCalledExactlyOnceWith({ nombre: 'Central', direccion: 'Calle', idCiud: 0, estado: 'activo', horarios: [{ horaIni: '09:00:00', horaFin: '17:00:00', dias: [1,3] }] });
    fixture.detectChanges(); expect(fixture.nativeElement.querySelector('.day-button').getAttribute('aria-pressed')).toBe('true');
    page.toggleDay(0, 1); expect(page.form.controls.horarios.at(0).controls.dias.value).toEqual([3]);
  });
  it('rechaza horas sin días seleccionados', () => {
    const { page, save } = setup('sucursales', sucursal);
    page.form.controls.horarios.at(0).patchValue({ horaIni: '09:00', horaFin: '17:00' }); page.enviar();
    expect(save).not.toHaveBeenCalled(); expect(page.error()).toContain('días');
  });
  it('rechaza rangos incompletos, invertidos y solapados', () => {
    const { page, save } = setup('sucursales', sucursal);
    page.addHours(); page.enviar(); expect(save).not.toHaveBeenCalled();
    page.form.controls.horarios.at(0).patchValue({ horaIni: '18:00', horaFin: '08:00' }); page.enviar(); expect(save).not.toHaveBeenCalled();
    page.form.controls.horarios.at(0).patchValue({ horaIni: '08:00', horaFin: '12:00' });
    page.addHours({ horaIni: '11:00', horaFin: '18:00' }); page.enviar(); expect(save).not.toHaveBeenCalled();
  });
});
