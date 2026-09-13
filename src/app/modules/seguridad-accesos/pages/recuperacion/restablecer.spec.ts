import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { RestablecerPage } from './restablecer';

describe('CU04 restablecimiento', () => {
  let fixture: ComponentFixture<RestablecerPage>;
  const token = 'a'.repeat(43);
  const password = 'Una frase nueva de prueba';
  const auth = { resetPassword: vi.fn() };
  beforeEach(async () => {
    auth.resetPassword.mockReset();
    window.history.replaceState({}, '', `/restablecer-contrasena#token=${token}`);
    await TestBed.configureTestingModule({ imports: [RestablecerPage], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
    ] }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });
  afterEach(() => { window.history.replaceState({}, '', '/'); vi.restoreAllMocks(); });
  function create() {
    fixture = TestBed.createComponent(RestablecerPage);
    fixture.detectChanges();
    return fixture.componentInstance;
  }
  it('recibe fragmento, lo retira y no usa storage', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const page = create();
    expect(page.hasToken()).toBe(true);
    expect(window.location.hash).toBe('');
    expect(storage).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain(token);
  });
  it.each(['', '?token=' + token, '#token=invalid'])('rechaza ausencia, query o formato inválido %s', suffix => {
    window.history.replaceState({}, '', '/restablecer-contrasena' + suffix);
    const page = create(); page.submit();
    expect(page.hasToken()).toBe(false);
    expect(page.error()).toContain('no es válido');
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });
  it.each(['short', ' '.repeat(12), 'a'.repeat(129)])('aplica reglas de contraseña', password => {
    const page = create();
    page.form.setValue({ nueva: password, confirmacion: password }); page.submit();
    expect(page.form.invalid).toBe(true);
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });
  it('exige confirmación coincidente', () => {
    const page = create(); page.form.setValue({ nueva: password, confirmacion: password + 'x' }); page.submit();
    expect(page.form.hasError('matching')).toBe(true);
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });
  it('éxito limpia contraseña y token y navega a login sin almacenamiento', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const page = create(); auth.resetPassword.mockReturnValue(of({ mensaje: 'OK' }));
    page.form.setValue({ nueva: password, confirmacion: password }); page.submit();
    expect(auth.resetPassword).toHaveBeenCalledWith(token, password);
    expect(page.hasToken()).toBe(false);
    expect(page.form.controls.nueva.value).toBe('');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/login');
    expect(storage).not.toHaveBeenCalled();
  });
  it('token inválido o expirado obliga a solicitar otro', () => {
    const page = create(); auth.resetPassword.mockReturnValue(throwError(() => ({ status: 400 })));
    page.form.setValue({ nueva: password, confirmacion: password }); page.submit();
    expect(page.error()).toContain('no es válido o ha expirado');
    expect(page.hasToken()).toBe(false);
    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();
  });
  it('fallo temporal permite reintentar, sin conservar contraseñas', () => {
    const page = create(); auth.resetPassword.mockReturnValue(throwError(() => ({ status: 503 })));
    page.form.setValue({ nueva: password, confirmacion: password }); page.submit();
    expect(page.hasToken()).toBe(true);
    expect(page.form.controls.nueva.value).toBe('');
    expect(page.error()).toContain('Inténtalo');
  });
});
