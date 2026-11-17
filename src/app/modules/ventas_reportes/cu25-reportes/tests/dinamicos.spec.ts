import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { AuthResponse } from '../../../seguridad-accesos/models/auth.models';
import { ReportesDinamicosPage } from '../pages/dinamicos';

describe('Reportes dinámicos, confirmación y contexto',()=>{
  const initial:AuthResponse={empresa:'manaco',usuario:{idUsuario:'admin',nombres:'Prueba',correo:'test@example.com',tipo:'A'},
    rol:{nro:'admin',descripcion:'Administrador'},permisos:['CU25'],expiraEn:'2099-01-01T00:00:00Z'};
  const session=signal<AuthResponse|null>(initial);
  let http:HttpTestingController;let page:ReportesDinamicosPage;let host:HTMLElement;
  beforeEach(()=>{
    session.set(initial);
    TestBed.configureTestingModule({imports:[ReportesDinamicosPage],providers:[provideRouter([]),provideHttpClient(),provideHttpClientTesting(),{provide:AuthService,useValue:{session}}]});
    const fixture=TestBed.createComponent(ReportesDinamicosPage);page=fixture.componentInstance;host=fixture.nativeElement;http=TestBed.inject(HttpTestingController);
    fixture.detectChanges();http.expectOne('/api/admin/reportes/dinamicos/referencias').flush({sucursales:[{nro:1,nombre:'Central'}]});
  });
  afterEach(()=>{http.verify();vi.unstubAllGlobals();vi.restoreAllMocks();});
  it('envía un plan fijo sin empresa y representa el resultado del servidor',()=>{
    page.execute();const request=http.expectOne('/api/admin/reportes/dinamicos/ejecutar');
    expect(request.request.body).not.toHaveProperty('empresa');expect(request.request.body).not.toHaveProperty('sql');
    request.flush({resultadoId:'uuid',titulo:'Ventas',plan:page.plan,columnas:['importe'],filas:[{importe:'222.00'}],nota:'calculado',procedencia:'PostgreSQL',generadoEn:'2026-11-08'});
    expect(page.result()?.filas[0]['importe']).toBe('222.00');
  });
  it('IA solo propone y ejecuta el plan propuesto sin depender ni sobrescribir los parámetros estáticos',()=>{
    const originalPlan={...page.plan};
    page.text='Prendas vendidas de los últimos 3 meses';page.interpret();
    http.expectOne('/api/admin/reportes/interpretar').flush({estado:'listo',mensaje:'Propuesta',modelo:'local',
      plan:{tipo:'productos_vendidos',fechaIni:'2026-08-15',fechaFin:'2026-11-15',nroSuc:null,limite:10,umbral:5}});
    http.expectNone('/api/admin/reportes/dinamicos/ejecutar');expect(page.result()).toBeNull();
    page.confirm();
    const execReq=http.expectOne('/api/admin/reportes/dinamicos/ejecutar');
    expect(execReq.request.body.tipo).toBe('productos_vendidos');
    expect(execReq.request.body.fechaIni).toBe('2026-08-15');
    expect(execReq.request.body.fechaFin).toBe('2026-11-15');
    execReq.flush({filas:[],plan:execReq.request.body});
    expect(page.plan).toEqual(originalPlan);
  });
  it('otra sesión descarta resultados tardíos y no conserva métricas del usuario previo',()=>{
    page.execute();const late=http.expectOne('/api/admin/reportes/dinamicos/ejecutar');
    session.set({...initial,empresa:'otra',usuario:{...initial.usuario,idUsuario:'otro'}});TestBed.tick();
    http.expectOne('/api/admin/reportes/dinamicos/referencias').flush({sucursales:[]});
    late.flush({titulo:'Datos antiguos',filas:[{importe:'999'}]});
    expect(page.result()).toBeNull();expect(page.analytics()).toBeNull();
  });
  it('403 de plan no se presenta como resultado IA ni éxito comercial',()=>{
    page.text='Reporte';page.interpret();http.expectOne('/api/admin/reportes/interpretar').flush({error:{message:'El plan no incluye IA'}},{status:403,statusText:'Denied'});
    expect(page.error()).toContain('plan no incluye');expect(page.decision()).toBeNull();expect(page.result()).toBeNull();
  });
  it('voz usa reconocimiento del navegador, requiere revisar texto y no consulta automáticamente',()=>{
    let recognition:any;
    class Recognition {lang='';interimResults=false;onresult:any;onerror:any;onend:any;start=vi.fn();stop=vi.fn();constructor(){recognition=this;}}
    vi.stubGlobal('SpeechRecognition',Recognition);
    page.voice();expect(recognition.start).toHaveBeenCalledOnce();expect(page.listening()).toBe(true);
    recognition.onresult({results:[[{transcript:'Ventas en octubre'}]]});
    expect(page.text).toBe('Ventas en octubre');expect(page.message()).toContain('confirma');
    http.expectNone('/api/admin/reportes/interpretar');
    recognition.onerror();expect(page.message()).toContain('permiso denegado');
  });
  it('no muestra la sección de analítica ML sintética en el DOM',()=>{
    expect(host.textContent).not.toContain('Analítica ML');
    expect(host.textContent).not.toContain('Consultar modelos y métricas sintéticas');
    expect(host.textContent).not.toContain('Predecir escenario sintético');
  });
  it('oculta los reportes por comandos de voz e IA cuando el plan no incluye REPORTES_IA',()=>{
    TestBed.tick();
    expect(page.reportesHabilitados()).toBe(true);
    expect(page.iaHabilitada()).toBe(false);
    expect(host.textContent).toContain('Calcular reporte');
    expect(host.textContent).not.toContain('Interpretación IA local');
    expect(host.textContent).not.toContain('Dictar solicitud');
    expect(host.textContent).not.toContain('Interpretar texto confirmado');
  });
  it('muestra la sección de comandos de voz e IA solo cuando iaHabilitada es true',()=>{
    session.set({...initial,empresa:'pro-1'});
    TestBed.tick();
    http.expectOne('/api/admin/reportes/dinamicos/referencias').flush({sucursales:[{nro:1,nombre:'Central'}],iaHabilitada:true});
    TestBed.tick();
    expect(page.iaHabilitada()).toBe(true);
    expect(host.textContent).toContain('Interpretación IA local');
    expect(host.textContent).toContain('Dictar solicitud');
    expect(host.textContent).toContain('Interpretar texto confirmado');
  });
  it('oculta los reportes dinámicos y de voz cuando el plan no incluye REPORTES (HTTP 403)',()=>{
    session.set({...initial,empresa:'sin-reportes'});
    TestBed.tick();
    http.expectOne('/api/admin/reportes/dinamicos/referencias').flush({error:{message:'El plan vigente no incluye esta funcionalidad'}},{status:403,statusText:'Forbidden'});
    TestBed.tick();
    expect(page.reportesHabilitados()).toBe(false);
    expect(page.iaHabilitada()).toBe(false);
    expect(host.textContent).not.toContain('Calcular reporte');
    expect(host.textContent).not.toContain('Interpretación IA local');
    expect(host.textContent).toContain('Tu plan vigente no incluye reportes dinámicos ni comandos de voz');
  });
});
