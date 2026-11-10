import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { AuthService } from '../../../seguridad-accesos/services/auth.service';
import { InventarioPanel } from '../../../inventario-productos/shared/panel';

interface Plan { tipo: string; fechaIni: string|null; fechaFin: string|null; nroSuc: number|null; limite: number; umbral: number; }
interface Report { resultadoId: string; titulo: string; plan: Plan; columnas: string[]; filas: Record<string, string|number>[]; nota: string; generadoEn: string; procedencia: string; }
interface Decision { estado: string; mensaje: string; plan: Plan|null; modelo: string; }
interface Recognition { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{transcript: string}>> })=>void)|null; onerror: (()=>void)|null; onend: (()=>void)|null; start(): void; stop(): void; }

@Component({selector:'app-reportes-dinamicos', imports:[FormsModule,InventarioPanel], templateUrl:'./dinamicos.html',
  styles:`.fields{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}label{display:grid;gap:5px}input,select,textarea,button{font:inherit;padding:9px}textarea{width:100%;box-sizing:border-box}table{width:100%;border-collapse:collapse}td,th{padding:9px;text-align:left;border-bottom:1px solid #ccc}.scroll{overflow:auto}.bars{display:grid;gap:8px;padding:12px;background:#f5f5ef}.bar{height:12px;background:#426c47;max-width:100%}.note{font-size:.9rem}.actions{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}pre{white-space:pre-wrap}.ml-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:14px 0}.ml-card{padding:14px;border:1px solid #d4d8ce;border-radius:10px;background:#fafaf6}.ml-card h3{margin:0 0 8px;font-size:1rem}`})
export class ReportesDinamicosPage {
  private readonly http=inject(HttpClient); private readonly auth=inject(AuthService); private readonly destroy=inject(DestroyRef);
  private readonly base=inject(API_BASE_URL).replace(/\/$/,'')+'/admin/reportes';
  readonly busy=signal(false); readonly error=signal(''); readonly message=signal(''); readonly result=signal<Report|null>(null);
  readonly decision=signal<Decision|null>(null); readonly branches=signal<Array<{nro:number;nombre:string}>>([]);
  readonly analytics=signal<Record<string,unknown>|null>(null); readonly listening=signal(false);
  readonly prediction=signal<string>('');
  scenario={category:'camiseta',day_of_week:5,month:6,price:45,discount:0.2,promotion:1};
  readonly types=[{id:'ventas_sucursal',label:'Ventas por sucursal y período'},{id:'productos_vendidos',label:'Productos más vendidos'},
    {id:'ventas_semana',label:'Evolución semanal de ventas'},{id:'existencias_bajas',label:'Productos con menor existencia'}];
  plan: Plan={tipo:'ventas_sucursal',fechaIni:new Date().toISOString().slice(0,8)+'01',fechaFin:new Date().toISOString().slice(0,10),nroSuc:null,limite:10,umbral:5};
  text=''; private recognition:Recognition|null=null;
  private owner():string {const session=this.auth.session();return JSON.stringify(session ? [session.empresa,session.usuario.idUsuario,session.expiraEn]:null);}
  constructor(){effect(()=>{const owner=this.owner();this.result.set(null);this.decision.set(null);this.analytics.set(null);this.branches.set([]);this.prediction.set('');this.text='';
    this.http.get<{sucursales:Array<{nro:number;nombre:string}>}>(this.base+'/dinamicos/referencias').pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:r=>{if(owner===this.owner())this.branches.set(r.sucursales);},error:e=>{if(owner===this.owner())this.fail(e);}});
  });this.destroy.onDestroy(()=>this.recognition?.stop());}
  private fail(error:unknown):void {const e=error as HttpErrorResponse;this.error.set(e.status===401?'Sesión vencida: inicia sesión de nuevo.':e.error?.error?.message??'No se pudo completar la consulta.');}
  execute():void {if(this.busy())return;this.busy.set(true);this.error.set('');const owner=this.owner();
    const plan={...this.plan,nroSuc:this.plan.nroSuc?Number(this.plan.nroSuc):null,
      fechaIni:this.plan.tipo==='existencias_bajas'?null:this.plan.fechaIni,fechaFin:this.plan.tipo==='existencias_bajas'?null:this.plan.fechaFin};
    this.http.post<Report>(this.base+'/dinamicos/ejecutar',plan).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.busy.set(false))).subscribe({
      next:r=>{if(owner===this.owner())this.result.set(r);},error:e=>{if(owner===this.owner())this.fail(e);}});
  }
  interpret():void {if(this.busy()||!this.text.trim())return;this.busy.set(true);this.error.set('');this.decision.set(null);const owner=this.owner();
    this.http.post<Decision>(this.base+'/interpretar',{texto:this.text.trim(),canal:'texto'}).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.busy.set(false))).subscribe({
      next:r=>{if(owner===this.owner())this.decision.set(r);},error:e=>{if(owner===this.owner())this.fail(e);}});}
  confirm():void {const plan=this.decision()?.plan;if(plan){this.plan={...plan};this.execute();}}
  export(format:'pdf'|'xlsx'):void {const result=this.result();if(!result)return;const owner=this.owner();this.error.set('');
    this.http.get(this.base+'/dinamicos/'+result.resultadoId+'/exportar',{params:{formato:format},responseType:'blob'}).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:blob=>{if(owner!==this.owner())return;const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='fashionstore-reporte.'+format;a.click();URL.revokeObjectURL(url);},error:e=>{if(owner===this.owner())this.fail(e);}});}
  loadAnalytics():void {const owner=this.owner();this.error.set('');this.http.get<Record<string,unknown>>(this.base+'/analitica').pipe(takeUntilDestroyed(this.destroy)).subscribe({next:r=>{if(owner===this.owner())this.analytics.set(r);},error:e=>{if(owner===this.owner())this.fail(e);}});}
  analyticsText():string{return JSON.stringify(this.analytics(),null,2);}
  supervisedMetrics():Array<{model:string;mae:number;rmse:number;r2:number}>{
    const sup=this.analytics()?.['supervised'] as {metrics?:Record<string,{mae:number;rmse:number;r2:number}>}|undefined;
    if(!sup?.metrics)return[];
    return Object.entries(sup.metrics).map(([model,m])=>({model,mae:m.mae,rmse:m.rmse,r2:m.r2}));
  }
  unsupervisedSummary():{silhouette?:number;anomalies?:number;clusters?:Array<Record<string,unknown>>}|null{
    const unsup=this.analytics()?.['unsupervised'] as {kmeans_silhouette?:number;anomalies_detected?:number;clusters?:Array<Record<string,unknown>>}|undefined;
    if(!unsup)return null;
    return {silhouette:unsup.kmeans_silhouette,anomalies:unsup.anomalies_detected,clusters:unsup.clusters};
  }
  predict():void {const owner=this.owner();this.error.set('');this.http.post<{synthetic:boolean;predicted_daily_units:number;limitation:string}>(this.base+'/analitica/predecir',this.scenario).pipe(takeUntilDestroyed(this.destroy)).subscribe({
    next:r=>{if(owner===this.owner())this.prediction.set('Escenario sintético: '+r.predicted_daily_units+' unidades/día estimadas. '+r.limitation);},error:e=>{if(owner===this.owner())this.fail(e);}});}
  bar(row:Record<string,string|number>):number {const rows=this.result()?.filas??[];const key=this.result()?.plan.tipo==='existencias_bajas'?'disponible':'importe';const max=Math.max(1,...rows.map(r=>Number(r[key])||0));return 100*(Number(row[key])||0)/max;}
  label(row:Record<string,string|number>):string{return String(row['sucursal']??row['producto']??row['semana']??'');}
  voice():void {const win=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
    const Constructor=win.SpeechRecognition??win.webkitSpeechRecognition;if(!Constructor){this.message.set('Este navegador no ofrece reconocimiento de voz. Usa la entrada escrita.');return;}
    this.recognition?.stop();const recognition=new Constructor();this.recognition=recognition;recognition.lang='es-BO';recognition.interimResults=false;
    recognition.onresult=event=>{this.text=Array.from(event.results).map(result=>result[0].transcript).join(' ');this.message.set('Revisa y confirma el texto reconocido antes de interpretarlo.');};
    recognition.onerror=()=>{this.listening.set(false);this.message.set('Voz no disponible o permiso denegado. Puedes escribir la solicitud.');};recognition.onend=()=>this.listening.set(false);
    try{recognition.start();this.listening.set(true);}catch{this.message.set('No se pudo iniciar el micrófono. Usa la entrada escrita.');}}
}
