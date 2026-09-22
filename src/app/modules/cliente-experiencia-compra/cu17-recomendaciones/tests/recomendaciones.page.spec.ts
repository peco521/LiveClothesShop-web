import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { RecomendacionesPage } from '../pages/recomendaciones/recomendaciones';
import { RecomendacionesService } from '../services/recomendaciones.service';
import { general, personalizada, vacia } from './recomendaciones.fixtures';

describe('CU17 página de recomendaciones', () => {
  const service = { listar: vi.fn() };
  beforeEach(() => {
    service.listar.mockReset().mockReturnValue(of(personalizada));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: RecomendacionesService, useValue: service }] });
  });
  afterEach(() => vi.restoreAllMocks());
  function open() {
    const fixture = TestBed.createComponent(RecomendacionesPage);
    fixture.detectChanges();
    return { fixture, page: fixture.componentInstance };
  }
  it('muestra el estado de carga mientras busca', () => {
    service.listar.mockReturnValue(new Subject());
    const { fixture, page } = open();
    expect(page.busy()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Buscando recomendaciones para ti…');
  });
  it('pide ocho recomendaciones y muestra la tarjeta de CU10 con sus motivos', () => {
    const { fixture, page } = open();
    expect(service.listar).toHaveBeenCalledWith(8);
    const texto = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Recomendaciones para ti');
    expect(texto).toContain(personalizada.mensaje);
    expect(texto).toContain('Polera Nike Pro');
    expect(texto).toContain('Deportiva');
    expect(texto).toContain('Similar a los modelos de polera que prefieres');
    expect(texto).toContain('Disponible · 1 variantes');
    expect(fixture.nativeElement.querySelector('a[href="/tienda/prendas/prod-001"]')).toBeTruthy();
    expect(page.result()?.tipo).toBe('personalizada');
  });
  it('muestra el mensaje y las tarjetas del fallback general', () => {
    service.listar.mockReturnValue(of(general));
    const { fixture, page } = open();
    expect(page.result()?.tipo).toBe('general');
    expect(fixture.nativeElement.textContent).toContain(general.mensaje);
    expect(fixture.nativeElement.textContent).toContain('Popular entre los clientes');
    expect(fixture.nativeElement.textContent).toContain('Polera Nike Formal');
  });
  it('avisa cuando no hay recomendaciones disponibles', () => {
    service.listar.mockReturnValue(of(vacia));
    const { fixture } = open();
    expect(fixture.nativeElement.textContent).toContain('No hay recomendaciones disponibles en este momento.');
    expect(fixture.nativeElement.querySelector('.grid')).toBeNull();
  });
  it('solo enlaza al detalle de CU10: nunca agrega al carrito ni reserva', () => {
    const { fixture } = open();
    expect(fixture.nativeElement.querySelectorAll('a[href="/tienda/prendas/prod-001"]').length).toBeGreaterThan(0);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).not.toContain('Agregar al carrito');
    expect(texto).not.toContain('Reservar');
  });
  it('muestra el error del backend y permite reintentar', () => {
    service.listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { fixture, page } = open();
    expect(fixture.nativeElement.textContent).toContain('No pudimos obtener tus recomendaciones');
    expect(page.retryable()).toBe(true);
    service.listar.mockReturnValue(of(personalizada));
    page.load();
    fixture.detectChanges();
    expect(page.error()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Polera Nike Pro');
  });
  it('pide iniciar sesión cuando la sesión expiró', () => {
    service.listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const { fixture, page } = open();
    expect(page.loginRequired()).toBe(true);
    expect(page.retryable()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Iniciar sesión');
  });
});
