import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { HistorialAdminService } from '../services/historial-admin.service';
import { HistorialAdminPage } from '../pages/historial-admin/historial-admin';
import { compra, historial } from './historial.fixtures';

const cliente = { idUsuario: 'cliente-1', ci: '123', nombre: 'Ana', apellidoPat: 'Salas', apellidoMat: 'Vega', correo: 'ana@example.com' };
describe('CU15 historial interno HTTP', () => {
  it('envía filtros y consulta historial/detalle por endpoints internos', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(HistorialAdminService); const http = TestBed.inject(HttpTestingController);
    service.clientes({ ci: ' 123 ', nombre: ' Ana ', apellidos: ' Salas ', correo: ' ana@example.com ' }, 20).subscribe();
    const req = http.expectOne(r => r.url === '/api/admin/historial-compras/clientes');
    expect(req.request.params.get('ci')).toBe('123'); expect(req.request.params.get('offset')).toBe('20'); expect(req.request.params.get('apellidos')).toBe('Salas');
    req.flush({ items: [cliente], total: 1, offset: 20, limit: 20 });
    service.historial(cliente.idUsuario).subscribe(); http.expectOne(r => r.url === '/api/admin/historial-compras/clientes/cliente-1').flush(historial);
    service.detalle(cliente.idUsuario, 11).subscribe(); http.expectOne('/api/admin/historial-compras/clientes/cliente-1/compras/11').flush(compra); http.verify();
  });
  it('no envía consultas privadas durante SSR', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PLATFORM_ID, useValue: 'server' }] });
    const service = TestBed.inject(HistorialAdminService); const next = vi.fn();
    service.clientes({ ci: '', nombre: '', apellidos: '', correo: '' }).subscribe(next); service.historial('1').subscribe(next); service.detalle('1', 11).subscribe(next);
    expect(next).not.toHaveBeenCalled(); TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
describe('CU15 historial interno página', () => {
  const service = { clientes: vi.fn(), historial: vi.fn(), detalle: vi.fn() };
  beforeEach(() => {
    service.clientes.mockReset().mockReturnValue(of({ items: [cliente], total: 1, offset: 0, limit: 20 }));
    service.historial.mockReset().mockReturnValue(of(historial)); service.detalle.mockReset().mockReturnValue(of(compra));
    TestBed.configureTestingModule({ providers: [{ provide: HistorialAdminService, useValue: service }] });
  });
  it('busca por los cuatro filtros y muestra compras/detalle sin permitir mutaciones', () => {
    const fixture = TestBed.createComponent(HistorialAdminPage); fixture.detectChanges(); const page = fixture.componentInstance;
    page.form.patchValue({ ci: '123', nombre: 'Ana', apellidos: 'Salas', correo: 'ana@example.com' }); page.search();
    expect(service.clientes).toHaveBeenLastCalledWith({ ci: '123', nombre: 'Ana', apellidos: 'Salas', correo: 'ana@example.com' }, 0);
    page.select(cliente); page.loadDetail(11); fixture.detectChanges();
    expect(page.history()?.total).toBe(1); expect(page.detail()?.nroVenta).toBe(11);
    expect(fixture.nativeElement.textContent).toContain('Camisa Oxford');
    expect(fixture.nativeElement.textContent).not.toContain('Finalizar compra');
  });
  it('abre el detalle en un panel aparte y lo cierra sin perder la lista', () => {
    const fixture = TestBed.createComponent(HistorialAdminPage); fixture.detectChanges(); const page = fixture.componentInstance;
    page.select(cliente); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    const verDetalle = fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
    expect(verDetalle).not.toBeNull(); expect(verDetalle.textContent).toContain('Ver detalle');
    verDetalle.click(); fixture.detectChanges();
    expect(page.detailOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('Detalle de compra #11');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges();
    expect(page.detailOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Compra #11');
  });
  it('cierra el panel del detalle al buscar otro cliente', () => {
    const fixture = TestBed.createComponent(HistorialAdminPage); fixture.detectChanges(); const page = fixture.componentInstance;
    page.select(cliente); page.loadDetail(11); fixture.detectChanges();
    expect(page.detailOpen()).toBe(true);
    page.form.patchValue({ nombre: 'Ana' }); page.search(); fixture.detectChanges();
    expect(page.detailOpen()).toBe(false); expect(page.detail()).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });
  it('cancela respuestas previas y oculta los datos después de un rechazo', () => {
    const pending = new Subject<typeof historial>(); service.historial.mockReturnValueOnce(pending);
    const fixture = TestBed.createComponent(HistorialAdminPage); const page = fixture.componentInstance;
    page.select(cliente); page.search(); expect(pending.observed).toBe(false); expect(page.history()).toBeNull();
    service.historial.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403, error: 'private' })));
    page.select(cliente); expect(page.history()).toBeNull(); expect(page.historyError()).toContain('autorización'); expect(page.historyError()).not.toContain('private');
  });
});
