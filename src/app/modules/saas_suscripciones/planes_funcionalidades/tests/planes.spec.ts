import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiInterceptor } from '../../../../core/interceptors/api.interceptor';
import { SaasPlanesPage } from '../pages/planes';

describe('Gestión SaaS de planes', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('confirma el impacto del plan compartido en todas las empresas', () => {
    const fixture = TestBed.createComponent(SaasPlanesPage);
    const page = fixture.componentInstance;
    const plan = { idPlan: 1, nombre: 'Profesional', maxSucursales: 10, estado: 'activo' as const, funcionalidades: ['VENTAS'] };
    http.expectOne('/api/saas/planes').flush([plan]);
    http.expectOne('/api/saas/planes/funcionalidades').flush([{ codigo: 'VENTAS', descripcion: 'Ventas' }]);
    page.edit(plan);
    http.expectOne('/api/saas/planes/1/suscripciones').flush([
      { idSuscripcion: 1, idEmpresa: 1, empresa: 'Empresa A', maxSucursales: 10, sucursalesActivas: 1 },
      { idSuscripcion: 2, idEmpresa: 2, empresa: 'Empresa B', maxSucursales: 10, sucursalesActivas: 1 },
    ]);
    page.draft.maxSucursales = 5;
    page.review();
    const preview = http.expectOne('/api/saas/planes/1/impacto');
    expect(preview.request.body).not.toHaveProperty('suscripcionesSeleccionadas');
    expect(preview.request.headers.get('X-CSRF-Protection')).toBe('1');
    preview.flush({ empresasActivas: 2, suscripcionesActivas: 2, suscripcionesAsociadas: 2, confirmacionImpacto: 'a'.repeat(64) });
    page.confirm();
    const save = http.expectOne('/api/saas/planes/1');
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).not.toHaveProperty('suscripcionesSeleccionadas');
    expect(save.request.body.confirmacionImpacto).toBe('a'.repeat(64));
    save.flush({ ...plan, maxSucursales: 5 });
    http.expectOne('/api/saas/planes').flush([{ ...plan, maxSucursales: 5 }]);
    http.expectOne('/api/saas/planes/funcionalidades').flush([{ codigo: 'VENTAS', descripcion: 'Ventas' }]);
    expect(page.notice()).toContain('todas las empresas asociadas');
  });
});
