import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { InventarioProductosService } from '../../shared/inventario-productos.service';
import { InventarioPanel, requestError } from '../../shared/panel';
import { Inventory, InventoryReferences, Movement, MovementData, Page } from '../../shared/models';

@Component({selector:'app-gestionar-inventario',imports:[ReactiveFormsModule,InventarioPanel],templateUrl:'./inventario.html',styleUrl:'../../shared/panel.css'})
export class InventarioPage {
  private readonly service=inject(InventarioProductosService);private readonly destroy=inject(DestroyRef);private readonly router=inject(Router);private readonly fb=inject(NonNullableFormBuilder);
  readonly page=signal<Page<Inventory>|null>(null);readonly refs=signal<InventoryReferences|null>(null);readonly history=signal<Page<Movement>|null>(null);readonly historyRow=signal<Inventory|null>(null);
  readonly busy=signal(false);readonly saving=signal(false);readonly historyBusy=signal(false);readonly editor=signal(false);readonly error=signal('');readonly success=signal('');
  readonly filters=this.fb.group({q:['',Validators.maxLength(100)],nroSuc:[null as number|null],idCat:[null as number|null],idTalla:[null as number|null],idColor:[null as number|null]});
  readonly form=this.fb.group({nroSuc:[null as number|null,Validators.required],idVariante:['',Validators.required],tipoMov:['entrada'],
    cantidad:[null as number|null,[Validators.required,Validators.min(1),Validators.max(2147483647),Validators.pattern(/^\d+$/)]],
    motivo:['',[Validators.required,Validators.maxLength(255),Validators.pattern(/\S/)]],ajusteDireccion:['aumentar']});
  constructor(){this.loadReferences();this.load();}
  loadReferences():void{
    this.service.inventoryReferences().pipe(takeUntilDestroyed(this.destroy)).subscribe({next:r=>{
      this.refs.set(r);if(r.sucursalAsignada!==null){this.filters.controls.nroSuc.setValue(r.sucursalAsignada);this.filters.controls.nroSuc.disable();this.form.controls.nroSuc.setValue(r.sucursalAsignada);this.form.controls.nroSuc.disable();}
    },error:e=>this.error.set(requestError(e,this.router))});
  }
  load(offset=0):void{
    if(this.busy())return;const raw=this.filters.getRawValue();this.busy.set(true);this.error.set('');
    this.service.inventory({q:raw.q.trim(),nroSuc:raw.nroSuc??undefined,idCat:raw.idCat??undefined,idTalla:raw.idTalla??undefined,idColor:raw.idColor??undefined,offset,limit:20})
      .pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.busy.set(false))).subscribe({next:r=>this.page.set(r),error:e=>{this.page.set(null);this.error.set(requestError(e,this.router));}});
  }
  newMovement(row?:Inventory):void{
    if(this.saving()||!this.refs())return;this.editor.set(true);this.error.set('');this.success.set('');this.historyRow.set(null);this.history.set(null);
    this.form.reset({nroSuc:row?.nroSuc??this.refs()?.sucursalAsignada??null,idVariante:row?.idVariante??'',tipoMov:'entrada',cantidad:null,motivo:'',ajusteDireccion:'aumentar'});
  }
  save():void{
    if(this.saving())return;if(this.form.invalid){this.form.markAllAsTouched();return;}
    const raw=this.form.getRawValue();const data:MovementData={nroSuc:raw.nroSuc!,idVariante:raw.idVariante,tipoMov:raw.tipoMov as MovementData['tipoMov'],cantidad:raw.cantidad!,motivo:raw.motivo.trim(),
      ...(raw.tipoMov==='ajuste'?{ajusteDireccion:raw.ajusteDireccion as 'aumentar'|'disminuir'}:{})};
    this.saving.set(true);this.error.set('');this.success.set('');
    this.service.registerMovement(data).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.saving.set(false))).subscribe({
      next:r=>{this.editor.set(false);this.success.set(`${r.mensaje}. Stock: ${r.stock}; disponible: ${r.cantDisp}.`);this.load();},error:e=>this.error.set(requestError(e,this.router))});
  }
  showHistory(row:Inventory,offset=0):void{
    if(this.historyBusy())return;this.historyBusy.set(true);this.error.set('');this.historyRow.set(row);this.history.set(null);
    this.service.movements(row.nroInv,offset).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.historyBusy.set(false))).subscribe({next:r=>this.history.set(r),error:e=>this.error.set(requestError(e,this.router))});
  }
  invalid(key:string):boolean{const c=this.form.get(key);return !!c&&c.invalid&&(c.touched||c.dirty);}
}
