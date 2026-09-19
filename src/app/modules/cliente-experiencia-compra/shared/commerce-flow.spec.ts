import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, provideRouter, Router, convertToParamMap } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { priceQuote, cartQuote } from './pricing';
import { CheckoutNavigation } from './checkout-navigation';
import { FinalizarCompraPage } from '../cu13-compra-digital/pages/finalizar-compra/finalizar-compra';
import { ComprasService } from '../cu13-compra-digital/services/compras.service';
import { PagosService } from '../cu14-pago-electronico/services/pagos.service';
import { CarritoService } from '../cu12-carrito/services/carrito.service';
import { ReservasService } from '../cu11-gestionar-reserva/services/reservas.service';
import { CatalogoService } from '../cu10-consultar-prendas/services/catalogo.service';
import { CatalogoDetallePage } from '../cu10-consultar-prendas/pages/catalogo-detalle/catalogo-detalle';
import { carritoResumen, sucursales, venta } from '../cu13-compra-digital/tests/compra.fixtures';
import { detail } from '../cu10-consultar-prendas/tests/catalogo.fixtures';

describe('Precios visuales sin cambiar el total del servidor',()=>{
 it('porcentaje, importe fijo y redondeo monetario',()=>{
  expect(priceQuote('45.46',{tipoDescuento:'porcentaje',valorDescuento:20})).toEqual(expect.objectContaining({base:45.46,total:36.37,discount:9.09}));
  expect(priceQuote('10.00',{tipoDescuento:'montoFijo',valorDescuento:'2.50'}).total).toBe(7.5);
  expect(priceQuote('0.05',{tipoDescuento:'porcentaje',valorDescuento:10}).discount).toBe(.01);
  expect(priceQuote(100,null).discount).toBe(0);
 });
 it('el descuento no supera el precio y se estima por unidad',()=>{
  expect(priceQuote(5,{tipoDescuento:'montoFijo',valorDescuento:20}).total).toBe(0);
  expect(cartQuote([{precio:100,promocion:{tipoDescuento:'porcentaje',valorDescuento:10},cantidad:2}])).toEqual({base:200,discount:20,total:180});
 });
});

describe('Compra unificada',()=>{
 const compras={pendiente:vi.fn(),preparar:vi.fn()};
 const pagos={configuracion:vi.fn(),pagar:vi.fn()};
 const navigation={open:vi.fn()};
 const payment={idPago:3,nroVenta:venta.nroVenta,monto:venta.total,checkoutUrl:'https://checkout.stripe.com/c/pay/test'};
 beforeEach(()=>{
  compras.pendiente.mockReset().mockReturnValue(of(null));compras.preparar.mockReset().mockReturnValue(of({venta,reutilizada:false}));
  pagos.configuracion.mockReset().mockReturnValue(of({proveedor:'stripe',simulacion:false,disponible:true,moneda:'usd'}));
  pagos.pagar.mockReset().mockReturnValue(of({pago:payment,reutilizado:false}));navigation.open.mockReset();
  TestBed.configureTestingModule({providers:[provideRouter([]),{provide:ComprasService,useValue:compras},{provide:PagosService,useValue:pagos},
   {provide:CheckoutNavigation,useValue:navigation},{provide:CarritoService,useValue:{obtener:()=>of(carritoResumen)}},
   {provide:ReservasService,useValue:{sucursales:()=>of(sucursales)}}]});
 });
 it('pasa del resumen a Stripe sin pantallas intermedias ni monto enviado por el cliente',()=>{
  const fixture=TestBed.createComponent(FinalizarCompraPage);fixture.detectChanges();const page=fixture.componentInstance;
  page.form.patchValue({nroSuc:1,nit:'123'});page.confirmar();
  expect(compras.preparar).toHaveBeenCalledWith({nroSuc:1,nit:'123'});
  expect(pagos.pagar).toHaveBeenCalledWith({nroVenta:venta.nroVenta,metodo:'tarjeta'});
  expect(navigation.open).toHaveBeenCalledWith(payment);
 });
 it('separa sucursal, método y productos; Stripe no muestra campos de tarjeta ni métodos simulados',()=>{
  const fixture=TestBed.createComponent(FinalizarCompraPage);fixture.detectChanges();const page=fixture.componentInstance;
  page.form.controls.nroSuc.setValue(sucursales[0].nro);page.editarSucursal.set(false);fixture.detectChanges();
  expect(fixture.nativeElement.querySelectorAll('form .checkout-card').length).toBe(3);
  expect(fixture.nativeElement.querySelector('.branch-address').textContent).toContain(sucursales[0].nombre);
  expect(fixture.nativeElement.querySelector('.branch-address').textContent).toContain(sucursales[0].direccion);
  expect(fixture.nativeElement.querySelector('.pay-button').textContent).toContain('Pagar ahora');
  expect(fixture.nativeElement.querySelector('input[formControlName="metodo"]')).toBeNull();
  expect(fixture.nativeElement.querySelector('input[autocomplete="cc-number"]')).toBeNull();
  const modify=[...fixture.nativeElement.querySelectorAll('button')].find((b:any)=>b.textContent.trim()==='Modificar') as HTMLButtonElement;
  modify.click();fixture.detectChanges();expect(fixture.nativeElement.querySelector('#compra-sucursal')).toBeTruthy();
 });
 it('cambiar el método en simulación mantiene el medio seleccionado al pagar',()=>{
  pagos.configuracion.mockReturnValue(of({proveedor:'mock',simulacion:true,disponible:true,moneda:null}));
  const fixture=TestBed.createComponent(FinalizarCompraPage);fixture.detectChanges();const page=fixture.componentInstance;
  page.editarMetodo.set(true);fixture.detectChanges();
  const qr=fixture.nativeElement.querySelector('input[value="QR"]') as HTMLInputElement;
  qr.click();fixture.detectChanges();expect(page.form.controls.metodo.value).toBe('QR');
  expect(fixture.nativeElement.querySelector('.payment-overview').textContent).toContain('QR');
  page.form.controls.nroSuc.setValue(1);page.confirmar();
  expect(pagos.pagar).toHaveBeenCalledWith({nroVenta:venta.nroVenta,metodo:'QR',escenario:'aprobado'});
 });
 it('bloquea doble clic y retoma la misma venta cuando falla la pasarela',()=>{
  const pending=new Subject<any>();pagos.pagar.mockReturnValue(pending);
  const fixture=TestBed.createComponent(FinalizarCompraPage);const page=fixture.componentInstance;page.form.controls.nroSuc.setValue(1);
  page.confirmar();page.confirmar();expect(compras.preparar).toHaveBeenCalledTimes(1);
  pending.error(new HttpErrorResponse({status:503}));expect(page.busy()).toBe(false);expect(page.pendiente()?.nroVenta).toBe(venta.nroVenta);
  pagos.pagar.mockReturnValue(of({pago:payment}));page.continuarPago();
  expect(compras.preparar).toHaveBeenCalledTimes(1);expect(pagos.pagar).toHaveBeenCalledTimes(2);expect(navigation.open).toHaveBeenCalledOnce();
 });
 it('no solicita un pago si no hay stock en la sucursal o la pasarela no está disponible',()=>{
  compras.preparar.mockReturnValue(throwError(()=>new HttpErrorResponse({status:409,error:{error:{code:'disponibilidad_insuficiente'}}})));
  const page=TestBed.createComponent(FinalizarCompraPage).componentInstance;page.form.controls.nroSuc.setValue(1);page.confirmar();
  expect(pagos.pagar).not.toHaveBeenCalled();expect(page.error()).toContain('disponibilidad');
  page.config.update(v=>v?{...v,disponible:false}:v);page.confirmar();expect(compras.preparar).toHaveBeenCalledTimes(1);
 });
 it('usa el importe confirmado por el servidor al recuperar una venta pendiente',()=>{
  compras.pendiente.mockReturnValue(of({...venta,total:'123.45'}));
  const fixture=TestBed.createComponent(FinalizarCompraPage);fixture.detectChanges();const page=fixture.componentInstance;
  expect(fixture.nativeElement.textContent).toContain('123,45');page.continuarPago();expect(compras.preparar).not.toHaveBeenCalled();
  expect(pagos.pagar).toHaveBeenCalledWith({nroVenta:venta.nroVenta,metodo:'tarjeta'});
 });
});

describe('Seguridad de redirección',()=>{
 it('acepta únicamente Stripe HTTPS sin credenciales y conserva los estados internos',()=>{
  const assign=vi.fn();
  TestBed.configureTestingModule({providers:[provideRouter([]),{provide:DOCUMENT,useValue:{defaultView:{location:{assign}}}}]});
  const nav=TestBed.inject(CheckoutNavigation),router=TestBed.inject(Router);const navigate=vi.spyOn(router,'navigate').mockResolvedValue(true);
  nav.open({idPago:1,checkoutUrl:'https://checkout.stripe.com/c/pay/test'});expect(assign).toHaveBeenCalledOnce();
  for(const url of ['http://checkout.stripe.com/test','https://checkout.stripe.com.evil.test/test','https://user@checkout.stripe.com/test']){
   expect(()=>nav.open({idPago:1,checkoutUrl:url})).toThrow();
  }
  nav.open({idPago:1});expect(navigate).toHaveBeenCalledWith(['/tienda/pago',1]);
 });
});

describe('Galería, sucursales y compra rápida del producto',()=>{
 it('solo muestra fotos del producto y cambia disponibilidad con la variante',()=>{
  TestBed.configureTestingModule({providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{paramMap:of(convertToParamMap({id:detail.idProd}))}},
   {provide:CatalogoService,useValue:{detalle:()=>of(detail)}},{provide:CarritoService,useValue:{agregar:vi.fn()}}]});
  const fixture=TestBed.createComponent(CatalogoDetallePage);fixture.detectChanges();const page=fixture.componentInstance;
  expect(page.selected()?.idVariante).toBe('var-001');expect(page.available()).toBe(true);
  expect(fixture.nativeElement.querySelector('.hero-image img').src).toBe('http://img/1.jpg');
  expect(page.branches().every(b=>b.idVariante==='var-001')).toBe(true);
  page.elegir('var-002');fixture.detectChanges();expect(page.available()).toBe(false);
  expect(fixture.nativeElement.querySelector('.hero-image img')).toBeNull();
 });
 it('miniaturas por color con existencias bajas reales y tallas de ese color',()=>{
  const redL={...detail.variantes[0],idVariante:'red-L',talla:detail.variantes[1].talla};
  const blueM={...detail.variantes[1],idVariante:'blue-M',talla:detail.variantes[0].talla,imagen:'http://img/blue.jpg'};
  const product={...detail,variantes:[...detail.variantes,redL,blueM],disponibilidad:[...detail.disponibilidad,
    {nroSuc:2,sucursal:'Norte',ciudad:'La Paz',idVariante:'var-001',stock:9,cantDisp:5},
    {nroSuc:1,sucursal:'Central',ciudad:'La Paz',idVariante:'red-L',stock:15,cantDisp:10},
    {nroSuc:1,sucursal:'Central',ciudad:'La Paz',idVariante:'blue-M',stock:8,cantDisp:3}]};
  TestBed.configureTestingModule({providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{paramMap:of(convertToParamMap({id:detail.idProd}))}},
    {provide:CatalogoService,useValue:{detalle:()=>of(product)}},{provide:CarritoService,useValue:{agregar:vi.fn()}}]});
  const fixture=TestBed.createComponent(CatalogoDetallePage);fixture.detectChanges();const page=fixture.componentInstance;
  const cards=fixture.nativeElement.querySelectorAll('.color-option');
  expect(cards.length).toBe(2);expect(cards[0].textContent).toContain('Rojo');expect(cards[0].textContent).toContain('Quedan 9 unidades');
  expect(page.sizeOptions().map(v=>v.idVariante)).toEqual(['var-001','red-L']);
  page.elegir('red-L');fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('.color-option:first-child .low-stock')).toBeNull();
  page.elegir('blue-M');fixture.detectChanges();expect(fixture.nativeElement.querySelector('.hero-image img').src).toBe('http://img/blue.jpg');
  page.cantidad.set(3);page.changeQuantity(1);expect(page.cantidad()).toBe(3);
  page.elegir('var-002');fixture.detectChanges();expect(fixture.nativeElement.querySelector('.empty-stock').textContent).toContain('Agotado');
 });
 it('comprar ahora añade la variante y navega al resumen, sin aceptar cantidades fraccionarias',()=>{
  const agregar=vi.fn().mockReturnValue(of(carritoResumen));
  TestBed.configureTestingModule({providers:[provideRouter([]),{provide:ActivatedRoute,useValue:{paramMap:of(convertToParamMap({id:detail.idProd}))}},
   {provide:CatalogoService,useValue:{detalle:()=>of(detail)}},{provide:CarritoService,useValue:{agregar}}]});
  const router=TestBed.inject(Router),navigate=vi.spyOn(router,'navigate').mockResolvedValue(true);
  const page=TestBed.createComponent(CatalogoDetallePage).componentInstance;
  page.cantidad.set(1.5);page.agregar(true);expect(agregar).not.toHaveBeenCalled();
  page.cantidad.set(2);page.agregar(true);expect(agregar).toHaveBeenCalledWith({idVar:'var-001',cantidad:2});
  expect(navigate).toHaveBeenCalledWith(['/tienda/finalizar-compra']);
 });
});
