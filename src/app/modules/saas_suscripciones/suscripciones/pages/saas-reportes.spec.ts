import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SaasReportesComponent } from './saas-reportes';

describe('Reportes SaaS y analítica inteligente (CU28 + CU29)', () => {
  it('inicializa y calcula reportes dinámicos por empresa con visualización de barras', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SaasReportesComponent);
    fixture.detectChanges();

    // Estado de IA y lista de empresas
    http.expectOne('/api/saas/reportes/estado').flush({ iaDisponible: true });
    http.expectOne('/api/saas/reportes/empresas').flush([
      { idEmp: 1, codigo: 'Bat-1234', nombre: 'Bata', idPlan: 2, plan: 'Profesional', estado: 'activa', fechaInicio: '2026-01-01', fechaVencimiento: '2027-01-01' },
      { idEmp: 2, codigo: 'Pil-5678', nombre: 'Empresa Piloto', idPlan: 1, plan: 'Básico', estado: 'activa', fechaInicio: '2026-01-01', fechaVencimiento: '2027-01-01' },
    ]);

    // Ejecución inicial automática de reporte dinámico
    const req = http.expectOne('/api/saas/reportes/dinamicos/ejecutar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.plan.tipo).toBe('ventas_sucursal');
    req.flush({
      plan: { tipo: 'ventas_sucursal', fechaIni: '2026-11-01', fechaFin: '2026-11-12', nroSuc: null, limite: 10, umbral: 5 },
      empresas: [
        {
          empresa: { idEmp: 1, codigo: 'Bat-1234', nombre: 'Bata', idPlan: 2, plan: 'Profesional', estado: 'activa' },
          reporte: {
            titulo: 'Ventas por sucursal y período',
            plan: { tipo: 'ventas_sucursal', limite: 10, umbral: 5 },
            columnas: ['sucursal', 'ventas', 'unidades', 'importe'],
            filas: [
              { sucursal: 'Sucursal Central', ventas: 15, unidades: 25, importe: 1250.50 },
              { sucursal: 'Sucursal Norte', ventas: 8, unidades: 12, importe: 620.00 },
            ],
            nota: 'Ventas de prueba',
            generadoEn: '2026-11-12',
            procedencia: 'Datos simulados',
          },
        },
      ],
      procedencia: 'Resultados del reporte por empresa',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('CU28 - REPORTES GERENCIALES');
    expect(fixture.nativeElement.textContent).not.toContain('Analítica inteligente y ML');
    expect(fixture.nativeElement.textContent).not.toContain('CU28 - ANALÍTICA INTELIGENTE');
    expect(fixture.nativeElement.textContent).not.toContain('Simulador de predicción de demanda sintética');
    expect(fixture.nativeElement.querySelectorAll('.report-tabs button').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Bata');
    expect(fixture.nativeElement.textContent).toContain('Sucursal Central');
    expect(fixture.nativeElement.textContent).toContain('Distribución proporcional');
    expect(fixture.componentInstance.dynamicResult()?.empresas.length).toBe(1);

    http.verify();
  });

  it('permite interpretar texto con IA (CU29) y ejecutar la propuesta', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SaasReportesComponent);
    fixture.detectChanges();

    http.expectOne('/api/saas/reportes/estado').flush({ iaDisponible: true });
    http.expectOne('/api/saas/reportes/empresas').flush([]);
    http.expectOne('/api/saas/reportes/dinamicos/ejecutar').flush({
      plan: { tipo: 'ventas_sucursal', fechaIni: null, fechaFin: null, nroSuc: null, limite: 10, umbral: 5 },
      empresas: [],
      procedencia: 'Prueba',
    });
    fixture.detectChanges();

    // Interpretar texto
    fixture.componentInstance.voiceText = 'productos más vendidos del último mes';
    fixture.componentInstance.interpret();

    const interpReq = http.expectOne('/api/saas/reportes/interpretar');
    expect(interpReq.request.body.texto).toBe('productos más vendidos del último mes');
    interpReq.flush({
      estado: 'listo',
      mensaje: 'Plan de reporte generado para productos más vendidos',
      modelo: 'local-qwen',
      plan: {
        tipo: 'productos_vendidos',
        fechaIni: '2026-10-01',
        fechaFin: '2026-10-31',
        nroSuc: null,
        limite: 10,
        umbral: 5,
      },
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.decision()?.estado).toBe('listo');
    expect(fixture.nativeElement.textContent).toContain('Plan de reporte generado para productos más vendidos');

    // Confirmar y generar sin depender ni modificar los filtros estáticos superiores
    const originalPlan = { ...fixture.componentInstance.plan };
    fixture.componentInstance.confirmAndExecuteProposal();
    const execReq = http.expectOne('/api/saas/reportes/dinamicos/ejecutar');
    expect(execReq.request.body.plan.tipo).toBe('productos_vendidos');
    expect(execReq.request.body.plan.fechaIni).toBe('2026-10-01');
    expect(execReq.request.body.plan.fechaFin).toBe('2026-10-31');
    expect(fixture.componentInstance.plan).toEqual(originalPlan);
    execReq.flush({
      plan: { tipo: 'productos_vendidos', fechaIni: '2026-10-01', fechaFin: '2026-10-31', nroSuc: null, limite: 10, umbral: 5 },
      empresas: [],
      procedencia: 'Prueba',
    });
    fixture.detectChanges();

    http.verify();
  });

  it('oculta por completo Analítica inteligente y ML en todas las pestañas y consulta indicadores generales', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SaasReportesComponent);
    fixture.detectChanges();

    http.expectOne('/api/saas/reportes/estado').flush({ iaDisponible: true });
    http.expectOne('/api/saas/reportes/empresas').flush([]);
    http.expectOne('/api/saas/reportes/dinamicos/ejecutar').flush({
      plan: { tipo: 'ventas_sucursal', fechaIni: null, fechaFin: null, nroSuc: null, limite: 10, umbral: 5 },
      empresas: [],
      procedencia: 'Prueba',
    });
    fixture.detectChanges();

    const tabButtons = Array.from(fixture.nativeElement.querySelectorAll('.report-tabs button') as NodeListOf<HTMLButtonElement>)
      .map(b => b.textContent?.trim() ?? '');
    expect(tabButtons).toEqual([
      'Reportes gerenciales dinámicos (CU28)',
      'Indicadores generales por empresa',
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('Analítica inteligente y ML');

    fixture.componentInstance.setTab('resumen');
    http.expectOne(req => req.url === '/api/saas/reportes/dashboard').flush({
      fechaIni: '2026-11-01',
      fechaFin: '2026-11-15',
      empresas: [],
      procedencia: 'Prueba',
    });
    fixture.detectChanges();

    http.expectNone('/api/saas/reportes/analitica');
    http.expectNone('/api/saas/reportes/analitica/predecir');
    expect(fixture.nativeElement.textContent).not.toContain('Analítica inteligente y ML');
    expect(fixture.nativeElement.textContent).not.toContain('Métricas de Modelos y Predicción de Demanda');
    expect(fixture.nativeElement.textContent).not.toContain('Simulador de predicción de demanda sintética');
    http.verify();
  });

  it('permite seleccionar X empresas y descarga PDF consolidado único (sin ZIP)', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SaasReportesComponent);
    fixture.detectChanges();

    http.expectOne('/api/saas/reportes/estado').flush({ iaDisponible: true });
    http.expectOne('/api/saas/reportes/empresas').flush([
      { idEmp: 1, codigo: 'Bat-1234', nombre: 'Bata', idPlan: 2, plan: 'Profesional', estado: 'activa', fechaInicio: '2026-01-01', fechaVencimiento: '2027-01-01' },
      { idEmp: 2, codigo: 'Pil-5678', nombre: 'Empresa Piloto', idPlan: 1, plan: 'Básico', estado: 'activa', fechaInicio: '2026-01-01', fechaVencimiento: '2027-01-01' },
      { idEmp: 3, codigo: 'Urb-9012', nombre: 'UrbanWomen', idPlan: 1, plan: 'Básico', estado: 'activa', fechaInicio: '2026-01-01', fechaVencimiento: '2027-01-01' },
    ]);
    http.expectOne('/api/saas/reportes/dinamicos/ejecutar').flush({
      plan: { tipo: 'ventas_sucursal', fechaIni: '2026-11-01', fechaFin: '2026-11-12', nroSuc: null, limite: 10, umbral: 5 },
      empresas: [],
      procedencia: 'Prueba',
    });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.idEmp = -1;
    component.onCompanyChange();
    component.toggleCompany(1, true);
    http.expectOne('/api/saas/reportes/referencias?idEmp=1').flush({ sucursales: [{ nro: 1, nombre: 'Central' }] });
    component.toggleCompany(3, true);
    fixture.detectChanges();

    component.executeDynamic();
    const multiReq = http.expectOne('/api/saas/reportes/dinamicos/ejecutar');
    expect(multiReq.request.body.idEmps).toEqual([1, 3]);
    multiReq.flush({
      plan: { tipo: 'ventas_sucursal', fechaIni: '2026-11-01', fechaFin: '2026-11-12', nroSuc: null, limite: 10, umbral: 5 },
      empresas: [
        { empresa: { idEmp: 1, codigo: 'Bat-1234', nombre: 'Bata', idPlan: 2, plan: 'Profesional', estado: 'activa', fechaInicio: '2026-01-01', fechaVencimiento: '2027-01-01' },
          reporte: { titulo: 'Ventas', plan: { tipo: 'ventas_sucursal', fechaIni: null, fechaFin: null, nroSuc: null, limite: 10, umbral: 5 }, columnas: [], filas: [], nota: '', generadoEn: '', procedencia: '' } },
        { empresa: { idEmp: 3, codigo: 'Urb-9012', nombre: 'UrbanWomen', idPlan: 1, plan: 'Básico', estado: 'activa', fechaInicio: '2026-01-01', fechaVencimiento: '2027-01-01' },
          reporte: { titulo: 'Ventas', plan: { tipo: 'ventas_sucursal', fechaIni: null, fechaFin: null, nroSuc: null, limite: 10, umbral: 5 }, columnas: [], filas: [], nota: '', generadoEn: '', procedencia: '' } },
      ],
      procedencia: 'Consolidado',
    });

    vi.stubGlobal('URL', { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} });
    component.exportDynamic('pdf');
    const expReq = http.expectOne('/api/saas/reportes/dinamicos/exportar');
    expect(expReq.request.body.idEmps).toEqual([1, 3]);
    expect(expReq.request.body.formato).toBe('pdf');
    expReq.flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    expect(component.success()).toContain('reporte-consolidado-ventas_sucursal.pdf');
    expect(component.success()).not.toContain('.zip');

    // Propuesta de IA dirigida a 1 empresa específica
    component.idEmp = 0;
    component.onCompanyChange();
    component.voiceText = 'Ventas por sucursal de los últimos 3 meses de Bata';
    component.interpret();
    http.expectOne('/api/saas/reportes/interpretar').flush({
      estado: 'listo',
      mensaje: 'Ventas por sucursal del 2026-08-17 al 2026-11-17.',
      modelo: 'local',
      idEmps: [1],
      empresasNombres: ['Bata'],
      plan: { tipo: 'ventas_sucursal', fechaIni: '2026-08-17', fechaFin: '2026-11-17', nroSuc: null, limite: 10, umbral: 5 },
    });
    component.confirmAndExecuteProposal();
    const aiExecReq = http.expectOne('/api/saas/reportes/dinamicos/ejecutar');
    expect(aiExecReq.request.body.idEmp).toBe(1);
    aiExecReq.flush({
      plan: { tipo: 'ventas_sucursal', fechaIni: '2026-08-17', fechaFin: '2026-11-17', nroSuc: null, limite: 10, umbral: 5 },
      empresas: [],
      procedencia: 'Prueba',
    });
    vi.unstubAllGlobals();
    http.verify();
  });
});
