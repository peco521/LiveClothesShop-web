import { money } from '../../../shared/pricing';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { CarritoService } from '../../../cu12-carrito/services/carrito.service';
import { CarritoDetalle } from '../../../cu12-carrito/models/carrito.models';
import { Cu13Layout } from '../../components/cu13-layout';
import { VentaDetalle } from '../../models/compra.models';
import { ComprasService } from '../../services/compras.service';
import { compraError } from '../../services/compra-error';

@Component({ selector: 'app-compra-preparada', imports: [Cu13Layout, RouterLink], templateUrl: './compra-preparada.html',
  styleUrls:['../../../shared/commerce.css','./compra-preparada.css'],
  styles: `.table-scroll { overflow-x: auto; } table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--line); } .total { font-size: 1.2rem; margin: 16px 0; } .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--line); }`,
})
export class CompraPreparadaPage {
  readonly money=money;
  private readonly carritoService = inject(CarritoService);
  readonly carrito = signal<CarritoDetalle|null>(null);
  producto(idVar: string){return this.carrito()?.items.find(item=>item.idVar===idVar);}
  private readonly service = inject(ComprasService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false); readonly error = signal(''); readonly venta = signal<VentaDetalle | null>(null);
  readonly confirmarCancelacion = signal(false);
  readonly nro = signal(0);
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const nro = Number(params.get('nro') ?? 0);
      this.nro.set(Number.isInteger(nro) && nro >= 1 ? nro : 0);
      this.load();
    });
  }
  cancelar(): void {
    if (!this.nro() || this.busy() || !this.confirmarCancelacion()) return;
    this.busy.set(true); this.error.set('');
    this.service.cancelar(this.nro()).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => { this.venta.set(value); this.confirmarCancelacion.set(false); },
      error: (error: unknown) => this.error.set(compraError(error)),
    });
  }
  load(): void {
    if (!this.nro()) { this.error.set(compraError({})); return; }
    this.busy.set(true); this.error.set(''); this.venta.set(null);
    forkJoin({venta:this.service.detalle(this.nro()),carrito:this.carritoService.obtener().pipe(catchError(()=>of(null)))})
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: ({venta,carrito}) => {this.venta.set(venta);this.carrito.set(carrito);}, error: (error: unknown) => this.error.set(compraError(error)),
    });
  }
}
