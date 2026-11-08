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
  let http:HttpTestingController;let page:ReportesDinamicosPage;
  beforeEach(()=>{
    session.set(initial);
    TestBed.configureTestingModule({imports:[ReportesDinamicosPage],providers:[provideRouter([]),provideHttpClient(),provideHttpClientTesting(),{provide:AuthService,useValue:{session}}]});
    const fixture=TestBed.createComponent(ReportesDinamicosPage);page=fixture.componentInstance;http=TestBed.inject(HttpTestingController);
    fixture.detectChanges();http.expectOne('/api/admin/reportes/dinamicos/referencias').flush({sucursales:[{nro:1,nombre:'Central'}]});
  });
  afterEach(()=>{http.verify();vi.unstubAllGlobals();vi.restoreAllMocks();});
  it('envía un plan fijo sin empresa y representa el resultado del servidor',()=>{
    page.execute();const request=http.expectOne('/api/admin/reportes/dinamicos/ejecutar');
    expect(request.request.body).not.toHaveProperty('empresa');expect(request.request.body).not.toHaveProperty('sql');
    request.flush({resultadoId:'uuid',titulo:'Ventas',plan:page.plan,columnas:['importe'],filas:[{importe:'222.00'}],nota:'calculado',procedencia:'PostgreSQL',generadoEn:'2026-11-08'});
    expect(page.result()?.filas[0]['importe']).toBe('222.00');
  });
  it('IA solo propone: la consulta comercial espera confirmación explícita',()=>{
    page.text='Ventas por sucursal del 2026-10-01 al 2026-10-31';page.interpret();
    http.expectOne('/api/admin/reportes/interpretar').flush({estado:'listo',mensaje:'Propuesta',modelo:'local',plan:page.plan});
    http.expectNone('/api/admin/reportes/dinamicos/ejecutar');expect(page.result()).toBeNull();
    page.confirm();http.expectOne('/api/admin/reportes/dinamicos/ejecutar').flush({filas:[],plan:page.plan});
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
});
