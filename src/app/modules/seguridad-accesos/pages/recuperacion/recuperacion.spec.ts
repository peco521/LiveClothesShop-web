import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { RecuperacionPage } from './recuperacion';

describe('CU04 recuperación', () => {
  let fixture: ComponentFixture<RecuperacionPage>;
  const auth = { requestRecovery: vi.fn() };
  beforeEach(async () => {
    auth.requestRecovery.mockReset();
    await TestBed.configureTestingModule({ imports: [RecuperacionPage], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
    ] }).compileComponents();
    fixture = TestBed.createComponent(RecuperacionPage);
    fixture.detectChanges();
  });
  it.each(['', 'incorrecto', ' '])('rechaza correo %s', correo => {
    fixture.componentInstance.form.setValue({ correo });
    fixture.componentInstance.submit();
    expect(auth.requestRecovery).not.toHaveBeenCalled();
  });
  it('mensaje genérico local, no muestra datos arbitrarios del servidor', () => {
    auth.requestRecovery.mockReturnValue(of({ mensaje: 'dato que no debe mostrarse' }));
    fixture.componentInstance.form.setValue({ correo: 'ana@example.com' });
    fixture.componentInstance.submit(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Si la cuenta puede recuperarse');
    expect(fixture.nativeElement.textContent).not.toContain('dato que no debe mostrarse');
  });
  it('no afirma envío cuando el servicio está deshabilitado', () => {
    auth.requestRecovery.mockReturnValue(throwError(() => ({ status: 503 })));
    fixture.componentInstance.form.setValue({ correo: 'ana@example.com' });
    fixture.componentInstance.submit();
    expect(fixture.componentInstance.message()).toBe('');
    expect(fixture.componentInstance.error()).toContain('no está disponible');
  });
  it('evita doble envío y cancela al destruir', () => {
    const pending = new Subject<{ mensaje: string }>();
    auth.requestRecovery.mockReturnValue(pending);
    fixture.componentInstance.form.setValue({ correo: 'ana@example.com' });
    fixture.componentInstance.submit(); fixture.componentInstance.submit();
    expect(auth.requestRecovery).toHaveBeenCalledOnce();
    fixture.destroy(); expect(pending.observed).toBe(false);
  });
});
