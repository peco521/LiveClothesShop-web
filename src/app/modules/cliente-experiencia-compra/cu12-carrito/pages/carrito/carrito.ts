import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu12Layout } from '../../components/cu12-layout';
import { CarritoDetalle } from '../../models/carrito.models';
import { CarritoService } from '../../services/carrito.service';
import { cartQuote, money, priceQuote } from '../../../shared/pricing';
import { carritoError } from '../../services/carrito-error';

@Component({ selector: 'app-carrito', imports: [Cu12Layout, FormsModule, RouterLink], templateUrl: './carrito.html',
  styleUrls:["../../../shared/commerce.css","./carrito.css"],
})
export class CarritoPage {
  readonly money=money;readonly quote=priceQuote;readonly cartQuote=cartQuote;
  private readonly service = inject(CarritoService);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  readonly busy = signal(false); readonly error = signal(''); readonly carrito = signal<CarritoDetalle | null>(null);
  readonly retirarUltimo = signal<number|null>(null);
  private readonly removeDialog = viewChild<ElementRef<HTMLDialogElement>>('removeDialog');
  readonly cantidades: Record<number, number> = {};
  constructor() { this.load(); }
  load(): void {
    this.request?.unsubscribe();
    this.busy.set(true); this.error.set('');
    this.request = this.service.obtener().pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => { this.cerrarConfirmacion(); this.carrito.set(value); for (const item of value.items) this.cantidades[item.idDetalleCarro] = item.cantidad; },
      error: (error: unknown) => this.error.set(carritoError(error)),
    });
  }
  cambiar(item: { idDetalleCarro: number }, cantidad: number): void {
    if (this.busy()) return;
    const actual = this.carrito()?.items.find(row => row.idDetalleCarro === item.idDetalleCarro);
    if (!actual) return;
    if (cantidad === 0) { this.cantidades[item.idDetalleCarro]=actual.cantidad; this.solicitarRetiro(item.idDetalleCarro); return; }
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > actual.cantidadDisponible) {
      this.cantidades[item.idDetalleCarro] = actual.cantidad;
      this.error.set(!Number.isInteger(cantidad) || cantidad < 1 ? 'La cantidad debe ser un entero mayor a cero.' : 'Solo hay '+actual.cantidadDisponible+' unidades disponibles de esta variante.');
      return;
    }
    this.mutar(this.service.modificar(item.idDetalleCarro, cantidad));
  }
  cambiarDesdeCampo(item: {idDetalleCarro: number}, event: Event): void {
    const campo=event.target as HTMLInputElement;
    this.cambiar(item,campo.valueAsNumber);
    campo.value=String(this.cantidades[item.idDetalleCarro]??1);
  }
  solicitarRetiro(id: number): void {
    if(this.busy()||!this.carrito()?.items.some(item=>item.idDetalleCarro===id))return;
    if(this.carrito()!.items.length>1){this.quitar(id);return;}
    this.error.set('');this.retirarUltimo.set(id);
    const dialog=this.removeDialog()?.nativeElement;
    if(dialog){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
  }
  cerrarConfirmacion(): void {
    const dialog=this.removeDialog()?.nativeElement;
    if(dialog?.open){if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
    this.retirarUltimo.set(null);
  }
  confirmarRetiro(): void {
    const id=this.retirarUltimo();
    if(id!==null&&!this.busy()&&this.carrito()?.items.length===1)this.quitar(id);
  }
  quitar(id: number): void {
    if (this.busy()) return;
    this.mutar(this.service.eliminar(id));
  }
  private mutar(request: ReturnType<CarritoService['modificar']>): void {
    this.request?.unsubscribe();
    this.busy.set(true); this.error.set('');
    this.request = request.pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => { this.cerrarConfirmacion(); this.carrito.set(value); for (const item of value.items) this.cantidades[item.idDetalleCarro] = item.cantidad; },
      error: (error: unknown) => {
        // Conserva el aviso: recargar con load() lo borraba inmediatamente.
        this.error.set(carritoError(error));
        for (const item of this.carrito()?.items ?? []) this.cantidades[item.idDetalleCarro] = item.cantidad;
      },
    });
  }
}
