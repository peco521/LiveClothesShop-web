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

    // Confirmar y generar
    fixture.componentInstance.confirmAndExecuteProposal();
    const execReq = http.expectOne('/api/saas/reportes/dinamicos/ejecutar');
    expect(execReq.request.body.plan.tipo).toBe('productos_vendidos');
    execReq.flush({
      plan: { tipo: 'productos_vendidos', fechaIni: '2026-10-01', fechaFin: '2026-10-31', nroSuc: null, limite: 10, umbral: 5 },
      empresas: [],
      procedencia: 'Prueba',
    });
    fixture.detectChanges();

    http.verify();
  });

  it('consulta métricas de machine learning y ejecuta el simulador de demanda', () => {
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

    // Cambiar a pestaña analítica
    fixture.componentInstance.setTab('analitica');
    const mlReq = http.expectOne('/api/saas/reportes/analitica');
    mlReq.flush({
      supervised: {
        metrics: {
          RandomForestRegressor: { mae: 2.3, rmse: 3.1, r2: 0.88 },
          GradientBoostingRegressor: { mae: 2.5, rmse: 3.3, r2: 0.85 },
        },
      },
      unsupervised: {
        kmeans_silhouette: 0.45,
        anomalies_detected: 4,
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('RandomForestRegressor');
    expect(fixture.nativeElement.textContent).toContain('0.88');
    expect(fixture.nativeElement.textContent).toContain('0.45');

    // Simulación de predicción
    fixture.componentInstance.predictScenario();
    const predReq = http.expectOne('/api/saas/reportes/analitica/predecir');
    predReq.flush({
      synthetic: true,
      predicted_daily_units: 34,
      limitation: 'Modelo demostrativo sintético.',
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.prediction()).toContain('34 unidades/día estimadas');
    http.verify();
  });
});
