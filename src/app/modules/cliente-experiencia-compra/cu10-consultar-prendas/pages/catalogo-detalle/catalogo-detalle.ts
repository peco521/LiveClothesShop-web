import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Cu10Layout } from '../../components/cu10-layout';
import { ProductoDetalle, VarianteDetalle } from '../../models/catalogo.models';
import { CatalogoService } from '../../services/catalogo.service';
import { catalogoError } from '../../services/catalogo-error';
import { CarritoService } from '../../../cu12-carrito/services/carrito.service';
import { money, priceQuote } from '../../../shared/pricing';
import { carritoError } from '../../../cu12-carrito/services/carrito-error';

@Component({ selector: 'app-catalogo-detalle', imports: [Cu10Layout, FormsModule, RouterLink], templateUrl: './catalogo-detalle.html',
  styleUrls:['../../../shared/commerce.css','./catalogo-detalle.css'],
})
export class CatalogoDetallePage {
  readonly money=money; readonly quote=priceQuote;
  private readonly router=inject(Router);
  selected():VarianteDetalle|null{return this.item()?.variantes.find(v=>v.idVariante===this.seleccion())??null;}
  gallery(){const variants=this.item()?.variantes??[];return variants.filter((v,i)=>v.imagen&&variants.findIndex(x=>x.imagen===v.imagen)===i);}
  branches(){return (this.item()?.disponibilidad??[]).filter(b=>b.idVariante===this.seleccion());}
  available():boolean{return this.branches().some(b=>b.cantDisp>0);}
  colorKey(variant:VarianteDetalle):string{return variant.colores.map(color=>color.idColor).sort((a,b)=>a-b).join(',')||'sin-color';}
  colorName(variant:VarianteDetalle|null):string{return variant?.colores.map(color=>color.descripcion).join(' / ')||'Sin color';}
  stock(idVariante:string):number{return (this.item()?.disponibilidad??[]).filter(branch=>branch.idVariante===idVariante).reduce((sum,branch)=>sum+Math.max(0,branch.cantDisp),0);}
  colorOptions():VarianteDetalle[]{
    const groups=new Map<string,VarianteDetalle[]>(),current=this.selected();
    for(const variant of this.item()?.variantes??[]){const key=this.colorKey(variant);groups.set(key,[...(groups.get(key)??[]),variant]);}
    return [...groups.values()].map(variants=>variants.find(v=>v.talla.idTalla===current?.talla.idTalla)??variants.find(v=>this.stock(v.idVariante)>0)??variants[0]);
  }
  sizeOptions():VarianteDetalle[]{const current=this.selected();return (this.item()?.variantes??[]).filter(v=>current&&this.colorKey(v)===this.colorKey(current));}
  changeQuantity(delta:number):void{
    if(this.agregando())return;
    const value=this.cantidad(),limit=this.selected()?this.stock(this.selected()!.idVariante):0;
    this.cantidad.set(Math.min(Math.max(1,limit),Math.max(1,(Number.isInteger(value)?value:1)+delta)));
  }
  private readonly service = inject(CatalogoService);
  private readonly carrito = inject(CarritoService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false); readonly error = signal(''); readonly item = signal<ProductoDetalle | null>(null);
  readonly seleccion = signal<string | null>(null);
  readonly actual = signal('');
  readonly cantidad = signal(1);
  readonly agregando = signal(false); readonly agregado = signal(false); readonly carritoErrorMsg = signal('');
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => { this.actual.set(params.get('id') ?? ''); this.load(this.actual()); });
  }
  elegir(idVariante: string): void {
    if(this.agregando()||!this.item()?.variantes.some(v=>v.idVariante===idVariante))return;
    this.seleccion.set(idVariante);this.agregado.set(false);this.carritoErrorMsg.set('');
    const limit=this.stock(idVariante);
    if(!Number.isInteger(this.cantidad())||this.cantidad()>limit)this.cantidad.set(Math.max(1,limit));
  }
  load(id: string): void {
    this.busy.set(true); this.error.set(''); this.item.set(null); this.seleccion.set(null);
    this.agregado.set(false); this.carritoErrorMsg.set(''); this.cantidad.set(1);
    this.service.detalle(id).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => { this.item.set(value); if (value.variantes.length) this.seleccion.set(value.variantes[0].idVariante); },
      error: (error: unknown) => this.error.set(catalogoError(error)),
    });
  }
  agregar(comprar=false): void {
    const idVar = this.seleccion();
    const cantidad = this.cantidad();
    if(this.agregando())return;
    if(!idVar||!Number.isInteger(cantidad)||cantidad<1){this.carritoErrorMsg.set('Selecciona una variante y una cantidad entera mayor que cero.');return;}
    if(!this.available()){this.carritoErrorMsg.set('Esta variante no tiene existencias disponibles.');return;}
    if(cantidad>this.stock(idVar)){this.carritoErrorMsg.set('La cantidad supera las existencias disponibles de esta variante.');return;}
    this.agregando.set(true); this.agregado.set(false); this.carritoErrorMsg.set('');
    this.carrito.agregar({ idVar, cantidad }).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.agregando.set(false))).subscribe({
      next: () => {this.agregado.set(true);if(comprar)void this.router.navigate(['/tienda/finalizar-compra']);},
      error: (error: unknown) => this.carritoErrorMsg.set(carritoError(error)),
    });
  }
}
