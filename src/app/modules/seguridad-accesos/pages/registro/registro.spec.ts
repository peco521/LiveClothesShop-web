import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { RegistroPage } from './registro';
import { AuthService } from '../../services/auth.service';
import { RegistroResponse } from '../../models/auth.models';

describe('CU01 RegistroPage', () => {
  let fixture: ComponentFixture<RegistroPage>;
  let page: RegistroPage;
  const auth = { register: vi.fn() };
  const data = { ci: '123', nombres: 'Ana', apellidoPat: 'Pérez', apellidoMat: 'Gómez', sexo: 'F' as const,
    correo: 'ana@example.com', telefono: '70000000', direccion: 'Calle 1', fechaNac: '2000-01-01',
    contrasena: 'Frase de prueba 12345' };

  beforeEach(async () => {
    auth.register.mockReset();
    await TestBed.configureTestingModule({ imports: [RegistroPage], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
    ] }).compileComponents();
    fixture = TestBed.createComponent(RegistroPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('inicialmente inválido y no envía un formulario vacío', () => {
    expect(page.form.invalid).toBe(true);
    page.submit();
    expect(auth.register).not.toHaveBeenCalled();
    for (const control of Object.values(page.form.controls)) {
      expect(control.hasError('required')).toBe(true);
      expect(control.touched).toBe(true);
    }
  });

  it('valida todos los campos obligatorios', () => {
    page.form.setValue(data);
    expect(page.form.valid).toBe(true);
    for (const key of Object.keys(data) as (keyof typeof data)[]) {
      const control = page.form.controls[key];
      const before = control.value;
      control.setValue('');
      expect(control.hasError('required')).toBe(true);
      control.setValue(before as never);
    }
  });

  it.each(['incorrecto', 'correo@', '@dominio.com'])('rechaza correo inválido %s', value => {
    page.form.controls.correo.setValue(value);
    expect(page.form.controls.correo.hasError('email')).toBe(true);
  });

  it.each(['corta', ' '.repeat(12), 'x'.repeat(129)])('rechaza contraseña inválida', value => {
    page.form.controls.contrasena.setValue(value);
    expect(page.form.controls.contrasena.invalid).toBe(true);
  });

  it('rechaza fecha futura y campos de texto en blanco', () => {
    page.form.controls.fechaNac.setValue('2999-01-01');
    page.form.controls.nombres.setValue('   ');
    expect(page.form.controls.fechaNac.invalid).toBe(true);
    expect(page.form.controls.nombres.invalid).toBe(true);
  });

  it('rechaza fechas inexistentes', () => {
    page.form.controls.fechaNac.setValue('2020-02-31');
    expect(page.form.controls.fechaNac.invalid).toBe(true);
  });

  it('envía el payload público y entra directo a la tienda con la sesión ya iniciada', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.register.mockReturnValue(of({ idUsuario: '1', correo: data.correo, mensaje: 'OK' }));
    page.form.setValue(data);
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(auth.register).toHaveBeenCalledWith(data);
    expect(page.success()).toBe(true);
    expect(page.form.controls.contrasena.value).toBe('');
    // CU01: el registro deja la sesión iniciada; no se pide un segundo inicio de sesión.
    expect(navigate).toHaveBeenCalledWith('/tienda');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Tu cuenta está lista');
    expect(fixture.nativeElement.textContent).toContain('tu sesión ya está iniciada');
    expect(fixture.nativeElement.querySelector('a[href="/tienda"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it.each([409, 503, 0])('presenta error backend %s y elimina la contraseña del formulario', status => {
    auth.register.mockReturnValue(throwError(() => new HttpErrorResponse({ status, error: { secret: 'no mostrar' } })));
    page.form.setValue(data);
    page.submit();
    fixture.detectChanges();
    expect(page.success()).toBe(false);
    expect(page.error()).toContain(status === 409 ? 'ya está registrado' : status === 0 ? 'conectar' : 'no está disponible');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).not.toContain('no mostrar');
    expect(page.form.controls.contrasena.value).toBe('');
  });

  it('impide doble envío mientras espera', () => {
    const pending = new Subject<RegistroResponse>();
    auth.register.mockReturnValue(pending);
    page.form.setValue(data);
    page.submit(); page.submit();
    expect(auth.register).toHaveBeenCalledOnce();
    fixture.destroy();
    expect(pending.observed).toBe(false);
  });

  it('no muestra controles de privilegios', () => {
    for (const name of ['rol', 'tipo', 'permisos', 'activo', 'cod_adm', 'cod_emp', 'cod_cl']) {
      expect(fixture.nativeElement.querySelector(`[formControlName="${name}"]`)).toBeNull();
    }
  });
});
