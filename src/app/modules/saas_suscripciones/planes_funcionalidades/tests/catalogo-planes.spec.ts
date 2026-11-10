import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogoPlanesSaasComponent } from '../components/catalogo-planes';

describe('Catálogo de planes de plataforma', () => {
  it('muestra los planes reales recibidos y ofrece el editor al usuario autorizado', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CatalogoPlanesSaasComponent);
    fixture.componentRef.setInput('plans', [{ idPlan: 2, nombre: 'Profesional', maxSucursales: 10, estado: 'activo', funcionalidades: ['CU25'] }]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Profesional');
    expect(fixture.nativeElement.textContent).toContain('10');
    expect(fixture.nativeElement.textContent).toContain('Reportes gerenciales');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/saas/planes');
    fixture.componentRef.setInput('canManage', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });
});
