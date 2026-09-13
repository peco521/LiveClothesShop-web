import { TestBed } from '@angular/core/testing';
import { ClienteFormularioComponent } from '../components/cliente-formulario';
import { customer } from './cliente.fixtures';

describe('CU07 formulario personal', () => {
  function setup(nombres: string | null = customer.nombres) {
    const fixture = TestBed.createComponent(ClienteFormularioComponent);
    fixture.componentRef.setInput('cliente', { ...customer, nombres }); fixture.detectChanges();
    const component = fixture.componentInstance; const save = vi.fn(); component.guardar.subscribe(save);
    return { fixture, component, save };
  }
  it('precarga campos y muestra rol/código/estado solo lectura sin secretos ni controles ajenos', () => {
    const { fixture, component } = setup();
    expect(component.form.getRawValue().correo).toBe(customer.correo);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('CL001'); expect(html.textContent).toContain('publico-custom');
    expect(html.textContent).toContain('Cuenta: Activa'); expect(html.textContent).toContain('solo lectura): inactivo');
    expect(html.textContent).toContain('se invalidarán los enlaces de recuperación');
    for (const field of ['contrasena', 'tipo', 'nroRol', 'activo', 'cod_cl', 'estado', 'proporciones']) expect(component.form.get(field)).toBeNull();
    expect(html.querySelector('input[type=password]')).toBeNull();
  });
  it('no-op no emite PATCH y explica que no hay cambios', () => {
    const { fixture, component, save } = setup(); component.submit(); fixture.detectChanges();
    expect(save).not.toHaveBeenCalled(); expect(fixture.nativeElement.textContent).toContain('No hay cambios');
  });
  it('solo emite campos cambiados normalizados, no tipo/rol/perfil', () => {
    const { component, save } = setup(); component.form.patchValue({ correo: ' NUEVO@EXAMPLE.COM ', telefono: ' 123 ' }); component.submit();
    expect(save).toHaveBeenCalledExactlyOnceWith({ correo: 'nuevo@example.com', telefono: '123' });
  });
  it('correo equivalente normalizado es no-op', () => {
    const { component, save } = setup(); component.form.controls.correo.setValue(' CLIENTE@EXAMPLE.COM '); component.submit(); expect(save).not.toHaveBeenCalled();
  });
  it('no normaliza campos históricos sin editar al cambiar el teléfono', () => {
    const { fixture, component, save } = setup();
    fixture.componentRef.setInput('cliente', { ...customer, correo: ' CLIENTE@EXAMPLE.COM ', apellidoPat: ' Pérez ' }); fixture.detectChanges();
    component.form.controls.telefono.setValue('123'); component.submit();
    expect(save).toHaveBeenCalledExactlyOnceWith({ telefono: '123' });
  });
  it('conserva nombres históricos nulos al editar otro campo', () => {
    const { component, save } = setup(null); component.form.controls.telefono.setValue('123'); component.submit();
    expect(save).toHaveBeenCalledExactlyOnceWith({ telefono: '123' });
  });
  it('null sin cambios no emite ni lo convierte en cadena vacía', () => {
    const { component, save } = setup(null); component.submit(); expect(save).not.toHaveBeenCalled();
    component.form.controls.nombres.setValue(' Nuevo '); component.submit(); expect(save).toHaveBeenCalledExactlyOnceWith({ nombres: 'Nuevo' });
  });
  it('no permite borrar nombres existentes ni fechas futuras/correo inválido', () => {
    const { component, save } = setup(); component.form.patchValue({ nombres: ' ', correo: 'invalid', fechaNac: '2999-01-01' }); component.submit();
    expect(save).not.toHaveBeenCalled(); expect(component.form.touched).toBe(true);
    expect(component.form.controls.fechaNac.hasError('date')).toBe(true);
  });
  it.each([['ci', 101], ['nombres', 101], ['apellidoPat', 51], ['apellidoMat', 51], ['correo', 101], ['telefono', 21], ['direccion', 151]] as const)('respeta longitud %s', (key, length) => {
    const { component, save } = setup(); component.form.controls[key].setValue('x'.repeat(length)); component.submit();
    expect(component.form.controls[key].hasError('maxlength')).toBe(true); expect(save).not.toHaveBeenCalled();
  });
  it('bloquea doble envío durante guardado y recarga otro cliente', () => {
    const { fixture, component, save } = setup(); fixture.componentRef.setInput('busy', true); fixture.detectChanges();
    component.form.controls.telefono.setValue('123'); component.submit(); expect(save).not.toHaveBeenCalled();
    fixture.componentRef.setInput('cliente', { ...customer, idUsuario: 'otro', telefono: 'Otro', nombres: null }); fixture.detectChanges();
    expect(component.form.controls.telefono.value).toBe('Otro'); expect(component.form.controls.nombres.value).toBe('');
  });
});
