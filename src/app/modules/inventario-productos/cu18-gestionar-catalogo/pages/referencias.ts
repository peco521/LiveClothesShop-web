import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Group, Option, Page, ReferenceRow } from '../../shared/models';
import { InventarioProductosService } from '../../shared/inventario-productos.service';
import { InventarioPanel, requestError } from '../../shared/panel';

interface Field { key: string; label: string; type: string; max?: number }
const description = (max: number): Field => ({ key:'descripcion', label:'Descripción', type:'text', max });
const name = (max: number): Field => ({ key:'nombre', label:'Nombre', type:'text', max });
export const PANELS: Record<Group, { title: string; singular: string; fields: Field[] }> = {
  tallas:{title:'Tallas',singular:'talla',fields:[description(8)]},
  colores:{title:'Colores',singular:'color',fields:[description(20),{key:'hex',label:'Color',type:'color'}]},
  colecciones:{title:'Colecciones',singular:'colección',fields:[description(150),{key:'idTemps',label:'Temporadas',type:'multiple'}]},
  temporadas:{title:'Temporadas',singular:'temporada',fields:[name(100),{key:'fechaIni',label:'Fecha de inicio',type:'date'}, {key:'fechaFin',label:'Fecha de fin',type:'date'}, {key:'estado',label:'Estado',type:'state'}]},
  categorias:{title:'Categorías',singular:'categoría',fields:[description(30)]},
  marcas:{title:'Marcas',singular:'marca',fields:[name(30),{key:'estado',label:'Estado',type:'state'}]},
  proveedores:{title:'Proveedores',singular:'proveedor',fields:[name(100),{key:'correo',label:'Correo',type:'email',max:150}, {key:'direccion',label:'Dirección',type:'text',max:150}, {key:'telefono',label:'Teléfono',type:'text',max:20}]},
};

@Component({selector:'app-catalogo-referencias',imports:[ReactiveFormsModule,InventarioPanel],templateUrl:'./referencias.html',styleUrl:'../../shared/panel.css'})
export class ReferenciasPage {
  private readonly service = inject(InventarioProductosService); private readonly destroy = inject(DestroyRef); private readonly router = inject(Router);
  readonly kind = inject(ActivatedRoute).snapshot.data['kind'] as Group;
  readonly config = PANELS[this.kind]; readonly page = signal<Page<ReferenceRow> | null>(null);
  readonly busy = signal(false); readonly saving = signal(false); readonly editing = signal(false); readonly editId = signal<number | undefined>(undefined);
  readonly error = signal(''); readonly success = signal(''); readonly confirm = signal<ReferenceRow | null>(null); readonly seasons = signal<Option[]>([]);
  readonly search = inject(NonNullableFormBuilder).group({q:['',Validators.maxLength(100)]});
  readonly form = inject(NonNullableFormBuilder).group({descripcion:[''],nombre:[''],hex:['#000000'],fechaIni:[''],fechaFin:[''],estado:['activo'],correo:[''],direccion:[''],telefono:[''],idTemps:[[] as string[]]});
  constructor() {
    for (const field of this.config.fields) {
      const control = this.form.get(field.key)!;
      if (field.type !== 'multiple') control.setValidators([Validators.required, ...(field.max ? [Validators.maxLength(field.max),Validators.pattern(/\S/)] : []), ...(field.type==='email' ? [Validators.email] : [])]);
      control.updateValueAndValidity();
    }
    if (this.kind === 'colecciones') this.service.references().pipe(takeUntilDestroyed()).subscribe({next:r=>this.seasons.set(r['temporadas']),error:e=>this.error.set(requestError(e,this.router))});
    this.load();
  }
  load(offset=0):void {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.listGroup(this.kind,{q:this.search.controls.q.value.trim(),offset,limit:20}).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.busy.set(false)))
      .subscribe({next:r=>this.page.set(r),error:e=>{this.page.set(null);this.error.set(requestError(e,this.router));}});
  }
  edit(row?:ReferenceRow):void {
    if (this.saving()) return;
    this.editId.set(row?.id); this.editing.set(true); this.confirm.set(null); this.success.set(''); this.error.set('');
    this.form.reset({descripcion:row?.descripcion??'',nombre:row?.nombre??'',hex:row?.hex??'#000000',fechaIni:row?.fechaIni??'',fechaFin:row?.fechaFin??'',
      estado:row?.estado??'activo',correo:row?.correo??'',direccion:row?.direccion??'',telefono:row?.telefono??'',idTemps:(row?.idTemps??[]).map(String)});
  }
  save():void {
    if (this.saving()) return;
    if (this.form.invalid) {this.form.markAllAsTouched();return;}
    if (this.kind==='temporadas' && this.form.controls.fechaFin.value < this.form.controls.fechaIni.value) {this.form.controls.fechaFin.setErrors({range:true});return;}
    const values = this.form.getRawValue() as Record<string,unknown>; const data:Record<string,unknown> = {};
    for (const field of this.config.fields) data[field.key] = field.key==='idTemps' ? (values[field.key] as string[]).map(Number) : String(values[field.key]).trim();
    this.saving.set(true); this.error.set('');
    this.service.saveGroup(this.kind,data,this.editId()).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.saving.set(false))).subscribe({
      next:()=>{this.editing.set(false);this.success.set('Guardado correctamente.');this.load();},error:e=>this.error.set(requestError(e,this.router))});
  }
  remove():void {
    const row=this.confirm(); if (!row || this.saving()) return;
    this.saving.set(true);this.error.set('');this.success.set('');
    this.service.deleteGroup(this.kind,row.id).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.saving.set(false))).subscribe({
      next:()=>{this.confirm.set(null);this.success.set('Registro eliminado correctamente.');this.load();},error:e=>this.error.set(requestError(e,this.router))});
  }
  invalid(key:string):boolean {const c=this.form.get(key);return !!c && c.invalid && (c.touched || c.dirty);}
  display(row:ReferenceRow,key:string):string {
    if (key==='idTemps') return (row.idTemps??[]).map(id=>this.seasons().find(s=>s.id===id)?.nombre??'Temporada').join(', ') || 'Sin temporadas';
    return String((row as unknown as Record<string,unknown>)[key]??'—');
  }
}
