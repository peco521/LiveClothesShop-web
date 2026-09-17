import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { CompraEstados } from '../../components/compra-estados';
import { CompraDetalle } from '../../models/historial.models';
import { HistorialService } from '../../services/historial.service';
import { historialError } from '../../services/historial-error';

@Component({
  selector: 'app-historial-detalle',
  imports: [RouterLink, DatePipe, DecimalPipe, CompraEstados],
  templateUrl: './historial-detalle.html',
  styleUrl: '../../historial.css',
})
export class HistorialDetallePage {
  private readonly service = inject(HistorialService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  private nro = 0;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly loginRequired = signal(false);
  readonly retryable = signal(true);
  readonly compra = signal<CompraDetalle | null>(null);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const id = params.get('nro') ?? '';
      const nro = Number(id);
      this.nro = /^[1-9]\d*$/.test(id) && Number.isSafeInteger(nro) && nro <= 2147483647 ? nro : 0;
      this.load();
    });
  }

  load(): void {
    this.request?.unsubscribe();
    this.compra.set(null);
    this.error.set('');
    this.loginRequired.set(false);
    this.retryable.set(true);
    if (!this.nro) {
      this.busy.set(false);
      this.retryable.set(false);
      this.error.set('El número de compra no es válido.');
      return;
    }
    this.busy.set(true);
    this.request = this.service.detalle(this.nro).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)),
    ).subscribe({
      next: value => this.compra.set(value),
      error: (error: unknown) => {
        this.error.set(historialError(error));
        this.loginRequired.set(error instanceof HttpErrorResponse && error.status === 401);
        this.retryable.set(!(error instanceof HttpErrorResponse && [401, 403, 404, 422].includes(error.status)));
      },
    });
  }

  metodo(value: string): string {
    return ({ tarjeta: 'Tarjeta', QR: 'QR', transferencia: 'Transferencia', efectivo: 'Efectivo' } as Record<string, string>)[value] ?? 'No disponible';
  }
}
