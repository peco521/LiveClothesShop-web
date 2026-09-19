import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Cu11Layout } from '../../components/cu11-layout';
import { ReservaDetalle } from '../../models/reserva.models';
import { ReservasService } from '../../services/reservas.service';
import { reservaError } from '../../services/reserva-error';
import { DatePipe } from '@angular/common';

@Component({ selector: 'app-detalle-reserva', imports: [Cu11Layout, RouterLink, DatePipe], templateUrl: './reserva-detalle.html',
  styleUrl: './detalle-reserva.css',
})
export class DetalleReservaPage {
  private readonly service = inject(ReservasService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false); readonly error = signal(''); readonly item = signal<ReservaDetalle | null>(null);
  readonly nro = signal(0); readonly confirmar = signal(false);
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const nro = Number(params.get('nro') ?? 0);
      this.nro.set(Number.isInteger(nro) && nro >= 1 ? nro : 0);
      this.confirmar.set(false);
      this.load();
    });
  }
  get cancelable(): boolean { return this.item()?.estado === 'pendiente'; }
  load(): void {
    if (!this.nro()) { this.error.set(reservaError({})); return; }
    this.busy.set(true); this.error.set(''); this.item.set(null);
    this.service.detalle(this.nro()).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => this.item.set(value), error: (error: unknown) => this.error.set(reservaError(error)),
    });
  }
  cancelar(): void {
    if (!this.cancelable || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.cancelar(this.nro()).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => { this.item.set(value); this.confirmar.set(false); },
      error: (error: unknown) => this.error.set(reservaError(error)),
    });
  }
}
