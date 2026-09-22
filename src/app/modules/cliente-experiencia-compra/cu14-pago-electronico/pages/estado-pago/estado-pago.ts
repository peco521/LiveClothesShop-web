import { money } from '../../../shared/pricing';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Cu14Layout } from '../../components/cu14-layout';
import { PagoDetalle } from '../../models/pago.models';
import { PagosService } from '../../services/pagos.service';
import { ComprasService } from '../../../cu13-compra-digital/services/compras.service';
import { pagoError } from '../../services/pago-error';

@Component({ selector: 'app-estado-pago', imports: [Cu14Layout, RouterLink], templateUrl: './estado-pago.html',
  styleUrls:['../../../shared/commerce.css','./estado-pago.css'],
})
export class EstadoPagoPage {
  readonly money=money;
  private readonly service = inject(PagosService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false); readonly error = signal(''); readonly pago = signal<PagoDetalle | null>(null);
  private readonly compras = inject(ComprasService);
  readonly confirmarCancelacion = signal(false);
  readonly id = signal(0);
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const id = Number(params.get('id') ?? 0);
      this.id.set(Number.isInteger(id) && id >= 1 ? id : 0);
      this.load();
    });
  }
  load(): void {
    if (!this.id()) { this.error.set(pagoError({})); return; }
    this.busy.set(true); this.error.set(''); this.pago.set(null);
    this.service.detalle(this.id()).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => this.pago.set(value), error: (error: unknown) => this.error.set(pagoError(error)),
    });
  }
  cancelar(): void {
    const pago = this.pago();
    if (!pago || pago.estado !== 'pendiente' || this.busy() || !this.confirmarCancelacion()) return;
    this.busy.set(true); this.error.set('');
    this.compras.cancelar(pago.nroVenta).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: () => { this.confirmarCancelacion.set(false); this.load(); },
      error: (error: unknown) => this.error.set(pagoError(error)),
    });
  }
  consultar(): void {
    if (!this.id() || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.reconciliar(this.id()).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => this.pago.set(value), error: (error: unknown) => this.error.set(pagoError(error)),
    });
  }
}
