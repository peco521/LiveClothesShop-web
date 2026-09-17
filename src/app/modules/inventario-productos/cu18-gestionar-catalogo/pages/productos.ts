import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { InventarioProductosService } from '../../shared/inventario-productos.service';
import { InventarioPanel, requestError } from '../../shared/panel';
import { Option, Page, Product, ProductData, ProductSummary, Variant } from '../../shared/models';

@Component({selector:'app-gestionar-productos',imports:[ReactiveFormsModule,InventarioPanel],templateUrl:'./productos.html',styleUrls:['../../shared/panel.css','./productos.css']})
export class ProductosPage {
  readonly uploading = signal<number|null>(null);
  readonly imageMessage = signal('');
  uploadImage(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0]; input.value = '';
    if (!file || this.uploading() !== null || this.saving()) return;
    this.error.set(''); this.imageMessage.set('');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size === 0 || file.size > 5*1024*1024) {
      this.error.set('Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.'); return;
    }
    const variant = this.form.controls.variantes.at(index);
    if (!variant) return;
    this.uploading.set(index);
    this.service.uploadImage(file).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.uploading.set(null))).subscribe({
      next: result => {
        if (!this.form.controls.variantes.controls.includes(variant)) return;
        variant.controls.img.setValue(result.url); variant.controls.img.markAsDirty();
        this.imageMessage.set('Imagen subida correctamente. Guarda la prenda para asociarla.');
      },
      error: error => this.error.set(requestError(error, this.router))
    });
  }
  private readonly service=inject(InventarioProductosService); private readonly destroy=inject(DestroyRef); private readonly router=inject(Router); private readonly fb=inject(NonNullableFormBuilder);
  readonly page=signal<Page<ProductSummary>|null>(null); readonly refs=signal<Partial<Record<string,Option[]>>>({});
  readonly refsError=signal('');
  readonly busy=signal(false); readonly saving=signal(false); readonly refsBusy=signal(true); readonly editor=signal(false); readonly editId=signal<string|undefined>(undefined);
  readonly error=signal(''); readonly success=signal(''); readonly confirm=signal<ProductSummary|null>(null);
  readonly search=this.fb.group({q:['',Validators.maxLength(100)],estado:['']});
  readonly form=this.fb.group({descripcion:['',[Validators.required,Validators.maxLength(100),Validators.pattern(/\S/)]],estado:['activo'],
    idCat:[null as number|null,Validators.required],idMarca:[null as number|null,Validators.required],idCol:[null as number|null,Validators.required],
    idProv:[null as number|null,Validators.required],idPromo:[null as number|null],idTemp:[null as number|null],variantes:this.fb.array<ReturnType<ProductosPage['variantForm']>>([])});
  readonly options=[{key:'idCat',group:'categorias',label:'Categoría'},{key:'idMarca',group:'marcas',label:'Marca'},{key:'idCol',group:'colecciones',label:'Colección'},
    {key:'idProv',group:'proveedores',label:'Proveedor'},{key:'idPromo',group:'promociones',label:'Promoción (opcional)'}];
  constructor(){this.loadReferences();this.load();}
  variantForm(v?:Variant){return this.fb.group({idVariante:[v?.idVariante??''],sku:[v?.sku??'',[Validators.required,Validators.maxLength(30),Validators.pattern(/\S/)]],
    precio:[v?Number(v.precio):null as number|null,[Validators.required,Validators.min(0.01),Validators.max(99999999.99),Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    estado:[v?.estado??'activo'],img:[v?.img??'',[Validators.maxLength(255),Validators.pattern(/^https?:\/\/[^\s]+$/)]],
    idTalla:[v?.idTalla??null as number|null,Validators.required],idColores:[v?.idColores??[] as number[],Validators.required]});}
  loadReferences():void{
    this.refsBusy.set(true);this.refsError.set('');this.service.references().pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.refsBusy.set(false))).subscribe({next:r=>this.refs.set(r),error:e=>this.refsError.set(requestError(e,this.router))});
  }
  missingReferences():string[]{return ['categorias','marcas','colecciones','proveedores','tallas','colores'].filter(k=>!this.refs()[k]?.length);}
  choices(group:string):Option[]{return (this.refs()[group]??[]).filter(item=>group!=='colecciones'||this.form.controls.idTemp.value===null||(item.idTemps??[]).includes(this.form.controls.idTemp.value));}
  seasonChanged():void{if(!this.choices('colecciones').some(c=>c.id===this.form.controls.idCol.value))this.form.controls.idCol.setValue(null);}
  load(offset=0):void{
    if(this.busy())return;this.busy.set(true);this.error.set('');
    this.service.products({q:this.search.controls.q.value.trim(),estado:this.search.controls.estado.value||undefined,offset,limit:20})
      .pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.busy.set(false))).subscribe({next:r=>this.page.set(r),error:e=>{this.page.set(null);this.error.set(requestError(e,this.router));}});
  }
  newProduct():void{if(this.uploading()!==null||this.saving()||this.refsBusy()||this.missingReferences().length)return;this.fill();}
  edit(product:ProductSummary):void{
    if(this.uploading()!==null||this.saving())return;this.saving.set(true);this.error.set('');this.success.set('');
    this.service.product(product.idProd).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.saving.set(false))).subscribe({next:r=>this.fill(r),error:e=>this.error.set(requestError(e,this.router))});
  }
  private fill(product?:Product):void{
    this.imageMessage.set('');
    this.editId.set(product?.idProd);this.editor.set(true);this.confirm.set(null);this.success.set('');this.error.set('');
    this.form.reset({descripcion:product?.descripcion??'',estado:product?.estado??'activo',idCat:product?.idCat??null,idMarca:product?.idMarca??null,
      idCol:product?.idCol??null,idProv:product?.idProv??null,idPromo:product?.idPromo??null,idTemp:null});
    this.form.controls.variantes.clear();for(const v of product?.variantes??[])this.form.controls.variantes.push(this.variantForm(v));
    if(!this.form.controls.variantes.length)this.addVariant();
  }
  addVariant():void{if(this.form.controls.variantes.length<100)this.form.controls.variantes.push(this.variantForm());}
  removeVariant(index:number):void{if(this.form.controls.variantes.length>1&&!this.saving()&&this.uploading()===null)this.form.controls.variantes.removeAt(index);}
  toggleColor(index:number,id:number):void{const c=this.form.controls.variantes.at(index).controls.idColores;const next=c.value.includes(id)?c.value.filter(x=>x!==id):[...c.value,id];c.setValue(next);c.markAsTouched();}
  invalid(path:string):boolean{const c=this.form.get(path);return !!c&&c.invalid&&(c.touched||c.dirty);}
  save():void{
    if(this.uploading()!==null||this.saving())return;if(this.form.invalid){this.form.markAllAsTouched();return;}
    const raw=this.form.getRawValue();const skus=raw.variantes.map(v=>v.sku.trim());
    if(new Set(skus).size!==skus.length){this.error.set('Cada variante debe tener un SKU diferente.');return;}
    const data:ProductData={descripcion:raw.descripcion.trim(),estado:raw.estado as ProductData['estado'],idCat:raw.idCat!,idMarca:raw.idMarca!,idCol:raw.idCol!,idProv:raw.idProv!,idPromo:raw.idPromo,
      variantes:raw.variantes.map(v=>({idVariante:v.idVariante||undefined,sku:v.sku.trim(),precio:v.precio!,estado:v.estado as Variant['estado'],img:v.img.trim()||null,idTalla:v.idTalla!,idColores:v.idColores}))};
    this.saving.set(true);this.error.set('');this.success.set('');
    this.service.saveProduct(data,this.editId()).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.saving.set(false))).subscribe({
      next:()=>{this.editor.set(false);this.success.set('Prenda guardada correctamente.');this.load();},error:e=>this.error.set(requestError(e,this.router))});
  }
  remove():void{
    const product=this.confirm();if(!product||this.saving()||this.uploading()!==null)return;this.saving.set(true);this.error.set('');this.success.set('');
    this.service.deleteProduct(product.idProd).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.saving.set(false))).subscribe({
      next:()=>{this.confirm.set(null);this.success.set('Prenda eliminada correctamente.');this.load();},error:e=>this.error.set(requestError(e,this.router))});
  }
}
