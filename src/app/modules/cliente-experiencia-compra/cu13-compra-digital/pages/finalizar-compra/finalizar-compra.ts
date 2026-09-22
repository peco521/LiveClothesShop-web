import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, switchMap, tap } from 'rxjs';
import { Cu13Layout } from '../../components/cu13-layout';
import { CarritoDetalle } from '../../../cu12-carrito/models/carrito.models';
import { CarritoService } from '../../../cu12-carrito/services/carrito.service';
import { SucursalCliente } from '../../../cu11-gestionar-reserva/models/reserva.models';
import { ReservasService } from '../../../cu11-gestionar-reserva/services/reservas.service';
import { ComprasService } from '../../services/compras.service';
import { VentaDetalle } from '../../models/compra.models';
import { compraError } from '../../services/compra-error';
import { PagosService } from '../../../cu14-pago-electronico/services/pagos.service';
import { MetodoPago, EscenarioMock, PagoCrear } from '../../../cu14-pago-electronico/models/pago.models';
import { pagoError } from '../../../cu14-pago-electronico/services/pago-error';
import { CheckoutNavigation } from '../../../shared/checkout-navigation';
import { cartQuote, money, priceQuote } from '../../../shared/pricing';

@Component({selector:'app-finalizar-compra',imports:[Cu13Layout,ReactiveFormsModule,RouterLink],templateUrl:'./finalizar-compra.html',styleUrls:['../../../shared/commerce.css','./finalizar-compra.css']})
export class FinalizarCompraPage {
 private readonly carritoService=inject(CarritoService);private readonly reservasService=inject(ReservasService);
 private readonly compras=inject(ComprasService);private readonly pagos=inject(PagosService);private readonly navigation=inject(CheckoutNavigation);private readonly destroy=inject(DestroyRef);
 readonly money=money;readonly cartQuote=cartQuote;readonly quote=priceQuote;
 readonly editarSucursal=signal(true);readonly editarMetodo=signal(false);
 readonly busy=signal(false);readonly loading=signal(true);readonly error=signal('');
 readonly carrito=signal<CarritoDetalle|null>(null);readonly sucursales=signal<SucursalCliente[]>([]);readonly pendiente=signal<VentaDetalle|null>(null);
 readonly config=signal<{proveedor:'stripe'|'mock';simulacion:boolean;disponible:boolean;moneda:string|null}|null>(null);
 readonly form=inject(NonNullableFormBuilder).group({nroSuc:[0,[Validators.required,Validators.min(1)]],nit:['',Validators.maxLength(30)],metodo:['tarjeta' as MetodoPago,Validators.required],escenario:['aprobado' as EscenarioMock,Validators.required]});
 constructor(){
  forkJoin({venta:this.compras.pendiente(),cart:this.carritoService.obtener(),branches:this.reservasService.sucursales(),config:this.pagos.configuracion()})
   .pipe(takeUntilDestroyed(),finalize(()=>this.loading.set(false))).subscribe({
    next:({venta,cart,branches,config})=>{this.pendiente.set(venta);this.carrito.set(cart);this.sucursales.set(branches);this.config.set(config);
     if(venta)this.form.patchValue({nroSuc:venta.sucursal.nro,nit:venta.nit??''});
     else if(branches.length===1){this.form.controls.nroSuc.setValue(branches[0].nro);this.editarSucursal.set(false);}
     if(!config.disponible)this.error.set('La pasarela de pago no está disponible en este momento.');
    },error:e=>this.error.set(compraError(e))
   });
 }
 get sucursalSeleccionada():SucursalCliente|undefined{return this.sucursales().find(branch=>branch.nro===this.form.controls.nroSuc.value);}
 get metodoSeleccionado():string{return this.config()?.proveedor==='stripe'||this.form.controls.metodo.value==='tarjeta'?'Tarjeta de crédito o débito':this.form.controls.metodo.value==='QR'?'QR':'Transferencia';}
 private paymentData(nroVenta:number):PagoCrear{
  const v=this.form.getRawValue(),config=this.config();
  return {nroVenta,metodo:config?.proveedor==='stripe'?'tarjeta':v.metodo,...(config?.simulacion?{escenario:v.escenario}:{})};
 }
 private openPayment(pago:{idPago:number;checkoutUrl?:string|null}):void{
  try{this.navigation.open(pago);}catch{this.error.set('No se pudo abrir una dirección de pago válida. Puedes reintentar el pago de la compra pendiente.');}
 }
 confirmar():void{
  if(this.busy()||this.loading()||this.pendiente())return;
  if(!this.config()?.disponible){this.error.set('La pasarela de pago no está disponible en este momento.');return;}
  if(this.form.invalid||!this.carrito()?.items.length){this.form.markAllAsTouched();this.error.set('Selecciona una sucursal y revisa los datos de la compra.');return;}
  const value=this.form.getRawValue();this.busy.set(true);this.error.set('');
  this.compras.preparar({nroSuc:value.nroSuc,nit:value.nit.trim()||undefined}).pipe(takeUntilDestroyed(this.destroy),
   tap(({venta})=>this.pendiente.set(venta)),switchMap(({venta})=>this.pagos.pagar(this.paymentData(venta.nroVenta))),
   finalize(()=>this.busy.set(false))).subscribe({next:({pago})=>this.openPayment(pago),error:e=>this.error.set(this.pendiente()?pagoError(e):compraError(e))});
 }
 continuarPago():void{
  const venta=this.pendiente();
  if(!venta||venta.estado!=='registrada'||this.busy()||this.loading()||!this.config()?.disponible)return;
  this.busy.set(true);this.error.set('');
  this.pagos.pagar(this.paymentData(venta.nroVenta)).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.busy.set(false)))
   .subscribe({next:({pago})=>this.openPayment(pago),error:e=>this.error.set(pagoError(e))});
 }
}
