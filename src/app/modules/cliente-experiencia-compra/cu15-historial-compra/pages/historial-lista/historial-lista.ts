import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { CompraEstados } from '../../components/compra-estados';
import { HistorialCompras } from '../../models/historial.models';
import { HistorialService } from '../../services/historial.service';
import { historialError } from '../../services/historial-error';

@Component({
  selector: 'app-historial-lista',
  imports: [RouterLink, DatePipe, DecimalPipe, CompraEstados],
  templateUrl: './historial-lista.html',
  styleUrl: '../../historial.css',
})
export class HistorialListaPage {
  private readonly service = inject(HistorialService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly loginRequired = signal(false);
  readonly retryable = signal(true);
  readonly result = signal<HistorialCompras | null>(null);
  readonly offset = signal(0);
  readonly limit = signal(20);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const offset = Number(params.get('offset') ?? 0);
      const limit = Number(params.get('limit') ?? 20);
      this.offset.set(Number.isSafeInteger(offset) && offset >= 0 ? offset : 0);
      this.limit.set(Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : 20);
      this.load();
    });
  }

  load(): void {
    this.request?.unsubscribe();
    this.busy.set(true);
    this.error.set('');
    this.loginRequired.set(false);
    this.retryable.set(true);
    this.result.set(null);
    this.request = this.service.listar(this.offset(), this.limit()).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)),
    ).subscribe({
      next: value => this.result.set(value),
      error: (error: unknown) => {
        this.error.set(historialError(error));
        this.loginRequired.set(error instanceof HttpErrorResponse && error.status === 401);
        this.retryable.set(!(error instanceof HttpErrorResponse && [401, 403, 422].includes(error.status)));
      },
    });
  }

  pagina(offset: number): void {
    if (this.busy()) return;
    void this.router.navigate([], {
      relativeTo: this.route, queryParams: { offset: Math.max(0, offset), limit: this.limit() },
    });
  }
}
