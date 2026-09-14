import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Cu14Layout } from '../../components/cu14-layout';
import { PagoDetalle } from '../../models/pago.models';
import { PagosService } from '../../services/pagos.service';
import { pagoError } from '../../services/pago-error';

@Component({ selector: 'app-estado-pago', imports: [Cu14Layout, RouterLink], templateUrl: './estado-pago.html',
  styles: `.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--line); } .actions { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }`,
})
export class EstadoPagoPage {
  private readonly service = inject(PagosService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false); readonly error = signal(''); readonly pago = signal<PagoDetalle | null>(null);
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
  consultar(): void {
    if (!this.id() || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.procesar(this.id()).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => this.pago.set(value), error: (error: unknown) => this.error.set(pagoError(error)),
    });
  }
}
