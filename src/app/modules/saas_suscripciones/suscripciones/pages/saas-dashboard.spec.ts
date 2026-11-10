import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { SaasDashboardPage } from './saas-dashboard';

describe('Resumen del administrador SaaS', () => {
  it('consulta y muestra los indicadores con el permiso de empresas', () => {
    const session = signal({ plataforma: true, usuario: { tipo: 'S', correo: 'saas@example.com' }, permisos: ['SAAS-EMPRESAS', 'SAAS-PLANES'] });
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { session } }] });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SaasDashboardPage);
    fixture.detectChanges();
    http.expectOne('/api/saas/resumen').flush({
      empresas: { total: 2, activas: 1, suspendidas: 1, inactivas: 0 },
      suscripciones: { vigentes: 1, vencidas: 0, proximasAVencer: 1 },
      distribucionPlanes: [{nombre: 'Profesional', suscripciones: 1}],
      sucursalesActivas: 3, actividadReciente: [], diasProximosAVencer: 30,
    });
    http.expectOne('/api/saas/empresas').flush([]);
    http.expectOne('/api/saas/planes').flush([]);
    fixture.detectChanges();
    expect(fixture.componentInstance.section()).toBe('resumen');
    expect(fixture.nativeElement.textContent).toContain('Estado de la plataforma');
    expect(fixture.nativeElement.textContent).toContain('Profesional');
    expect(fixture.nativeElement.textContent).not.toContain('Tu cuenta no tiene permiso');
    http.verify();
  });

  it('muestra y filtra la auditoría de plataforma cuando tiene SAAS-AUDITORIA', () => {
    const session = signal({
      plataforma: true,
      usuario: { tipo: 'S', correo: 'adminsaas@fashionstore.com' },
      permisos: ['SAAS-AUDITORIA'],
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { session } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SaasDashboardPage);
    fixture.detectChanges();

    http.expectOne('/api/saas/auditoria?limite=21&desplazamiento=0').flush([
      {
        id: 338,
        accion: 'permisos_rol_actualizados',
        usuarioId: 'admin-1',
        fecha: '2026-11-09T23:40:17Z',
        detalles: { resultado: 'exito', rol: 'SAAS', agregadas: ['SAAS-AUDITORIA', 'SAAS-RESPALDOS'] },
      },
    ]);

    fixture.componentInstance.section.set('auditoria');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Auditoría de plataforma');
    expect(fixture.nativeElement.textContent).toContain('permisos rol actualizados');

    fixture.componentInstance.auditFilter = 'login';
    fixture.componentInstance.loadAudit(0);
    http.expectOne('/api/saas/auditoria?limite=21&desplazamiento=0&accion=login').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se encontraron eventos para ese filtro.');
    http.verify();
  });

  it('consulta y solicita respaldos cuando tiene SAAS-RESPALDOS', () => {
    const session = signal({
      plataforma: true,
      usuario: { tipo: 'S', correo: 'adminsaas@fashionstore.com' },
      permisos: ['SAAS-RESPALDOS'],
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { session } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SaasDashboardPage);
    fixture.detectChanges();

    fixture.componentInstance.section.set('respaldos');
    fixture.componentInstance.loadBackups();
    http.expectOne('/api/saas/respaldos').flush({
      configuracion: {
        configurado: true,
        estado: 'disponible',
        mensaje: null,
        destino: 'Almacenamiento privado del servidor · esquema public',
        retencionDias: 0,
      },
      respaldos: [],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Crear respaldo ahora');

    fixture.componentInstance.requestBackup();
    http.expectOne('/api/saas/respaldos').flush({
      id: 'd3948d38b2624613b5213337c6ff3bac',
      estado: 'solicitado',
      solicitado: '2026-11-10T01:05:48Z',
      completado: null,
      tamanoBytes: null,
      error: null,
    });
    http.expectOne('/api/saas/respaldos').flush({
      configuracion: {
        configurado: true,
        estado: 'disponible',
        mensaje: null,
        destino: 'Almacenamiento privado del servidor · esquema public',
        retencionDias: 0,
      },
      respaldos: [
        {
          id: 'd3948d38b2624613b5213337c6ff3bac',
          estado: 'completado',
          solicitado: '2026-11-10T01:05:48Z',
          completado: '2026-11-10T01:06:56Z',
          tamanoBytes: 263519,
          error: null,
        },
      ],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Descargar respaldo');
    expect(fixture.nativeElement.textContent).toContain('257.3 KB');
    http.verify();
  });

  it('genera automáticamente el código de empresa desde el nombre y el código del administrador inicial', () => {
    const session = signal({
      plataforma: true,
      usuario: { tipo: 'S', correo: 'adminsaas@fashionstore.com' },
      permisos: ['SAAS-EMPRESAS', 'SAAS-PLANES'],
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { session } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SaasDashboardPage);
    fixture.detectChanges();

    http.expectOne('/api/saas/resumen').flush({
      empresas: { total: 1, activas: 1, suspendidas: 0, inactivas: 0 },
      suscripciones: { vigentes: 1, vencidas: 0, proximasAVencer: 0 },
      distribucionPlanes: [{ nombre: 'Basico', suscripciones: 1 }],
      sucursalesActivas: 1,
      actividadReciente: [],
      diasProximosAVencer: 30,
    });
    http.expectOne('/api/saas/empresas').flush([]);
    http.expectOne('/api/saas/planes').flush([
      { idPlan: 1, nombre: 'Basico', maxSucursales: 2, estado: 'activo', funcionalidades: [] },
    ]);

    const component = fixture.componentInstance;
    component.section.set('aprovisionar');
    component.onCompanyNameChange('Bata');
    fixture.detectChanges();

    expect(component.provisionData.codigo).toMatch(/^Bat-\d{4}$/);
    expect(component.predictedAdminCode()).toBe('Adm-000001');
    expect(fixture.nativeElement.textContent).toContain('Código de administrador');

    component.provisionData.administrador.ci = '9988776';
    component.provisionData.administrador.nombre = 'Carlos';
    component.provisionData.administrador.apellidoPat = 'Gómez';
    component.provisionData.administrador.apellidoMat = 'Rojas';
    component.provisionData.administrador.correo = 'carlos@bata.com';
    component.provisionData.administrador.telefono = '70011223';
    component.provisionData.administrador.direccion = 'Av. Principal 123';
    component.provisionData.administrador.fechaNac = '1990-05-10';
    component.provisionData.administrador.contrasena = 'ClaveSeguraBata2026!';

    component.reviewProvision();
    expect(component.provisionReview()).toBe(true);
    http.verify();
  });
});
