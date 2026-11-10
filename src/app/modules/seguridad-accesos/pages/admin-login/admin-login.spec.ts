import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminLoginPage } from './admin-login';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../models/auth.models';

describe('Acceso administrativo separado', () => {
  const session: AuthResponse = {
    empresa: 'piloto',
    usuario: { idUsuario: 'ADM-002', tipo: 'A', nombres: 'Austin', correo: 'admin@example.com' },
    rol: { nro: 'A', descripcion: 'Administrador' }, permisos: ['CU05'], expiraEn: '2030-01-01T00:00:00Z',
  };
  const auth = {
    login: vi.fn(),
    restore: vi.fn(),
    listCompanies: vi.fn(),
    session: signal<AuthResponse | null>(null),
  };

  beforeEach(async () => {
    auth.login.mockReset();
    auth.restore.mockReset().mockReturnValue(of(null));
    auth.listCompanies.mockReset().mockReturnValue(of([
      { codigo: 'piloto', nombre: 'Empresa Piloto (datos del Parcial 1)' },
      { codigo: 'manaco', nombre: 'Manaco' },
    ]));
    auth.session.set(null);
    await TestBed.configureTestingModule({ imports: [AdminLoginPage], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
    ] }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  it('muestra la lista de empresas al pasar el mouse o presionar y permite seleccionar una para acceder al panel', () => {
    auth.login.mockReturnValue(of(session));
    const fixture = TestBed.createComponent(AdminLoginPage);
    fixture.detectChanges();

    const field = fixture.nativeElement.querySelector('.company-selector-field') as HTMLElement;
    field.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(fixture.componentInstance.companyMenuOpen()).toBe(true);

    const options = Array.from(fixture.nativeElement.querySelectorAll('.company-option')) as HTMLButtonElement[];
    expect(options.length).toBe(2);
    expect(options[0].textContent).toContain('Empresa Piloto (datos del Parcial 1)');

    options[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.empresa.value).toBe('piloto');
    expect(fixture.componentInstance.companyMenuOpen()).toBe(false);

    fixture.componentInstance.form.patchValue({ correo: 'admin@example.com', contrasena: 'Anterior123*' });
    fixture.componentInstance.submit();
    expect(auth.login).toHaveBeenCalledWith(
      { empresa: 'piloto', correo: 'admin@example.com', contrasena: 'Anterior123*' },
      'admin',
    );
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('usa el endpoint interno y entra al panel', () => {
    auth.login.mockReturnValue(of(session));
    const fixture = TestBed.createComponent(AdminLoginPage); fixture.detectChanges();
    const data = { empresa: 'manaco', correo: 'admin@example.com', contrasena: 'Anterior123*' };
    fixture.componentInstance.form.setValue(data);
    fixture.componentInstance.submit();
    expect(auth.login).toHaveBeenCalledWith(data, 'admin');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/admin');
    expect(fixture.componentInstance.form.controls.contrasena.value).toBe('');
  });

  it('no se queda cargando si la lista de empresas falla y permite reintentar', () => {
    auth.listCompanies.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const fixture = TestBed.createComponent(AdminLoginPage);
    fixture.detectChanges();
    fixture.componentInstance.toggleCompanies();
    fixture.detectChanges();
    expect(fixture.componentInstance.loadingCompanies()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No se pudo cargar la lista de empresas');
    auth.listCompanies.mockReturnValue(of([{ codigo: 'piloto', nombre: 'Empresa Piloto' }]));
    (fixture.nativeElement.querySelector('.company-retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.company-option:not(.company-retry)').length).toBe(1);
  });

  it('indica revisar la empresa cuando la cuenta no pertenece a ella', () => {
    auth.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const fixture = TestBed.createComponent(AdminLoginPage); fixture.detectChanges();
    fixture.componentInstance.form.setValue({ empresa: 'manaco', correo: 'admin@example.com', contrasena: 'Clave123*' });
    fixture.componentInstance.submit();
    expect(fixture.componentInstance.error()).toContain('pertenezca a la empresa seleccionada');
    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();
  });

  it('no ofrece registro público de administradores', () => {
    const fixture = TestBed.createComponent(AdminLoginPage); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/registro"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('ADMINISTRADORES Y EMPLEADOS');
  });

  it('no navega ante credenciales rechazadas', () => {
    auth.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const fixture = TestBed.createComponent(AdminLoginPage); fixture.detectChanges();
    fixture.componentInstance.form.setValue({ empresa: 'manaco', correo: 'admin@example.com', contrasena: 'incorrecta' });
    fixture.componentInstance.submit();
    expect(fixture.componentInstance.error()).toContain('correo y la contraseña');
    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();
  });
});
