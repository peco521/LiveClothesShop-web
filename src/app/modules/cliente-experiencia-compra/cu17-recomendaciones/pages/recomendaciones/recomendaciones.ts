import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Cu10Layout } from '../../../cu10-consultar-prendas/components/cu10-layout';
import { RecomendacionesRespuesta } from '../../models/recomendacion.models';
import { RECOMENDACIONES_LIMITE_DEFECTO, RecomendacionesService } from '../../services/recomendaciones.service';
import { recomendacionesError } from '../../services/recomendaciones-error';
import { money, priceQuote } from '../../../shared/pricing';

@Component({
  selector: 'app-recomendaciones',
  imports: [RouterLink, Cu10Layout],
  templateUrl: './recomendaciones.html',
  // Reutiliza la tarjeta de producto de CU10; el archivo local aporta la grilla
  // y los motivos de la recomendación.
  styleUrls: ['../../../cu10-consultar-prendas/pages/catalogo-lista/catalogo-cards.css', './recomendaciones.css'],
})
export class RecomendacionesPage {
  readonly money = money;
  readonly quote = priceQuote;
  private readonly service = inject(RecomendacionesService);
  private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly loginRequired = signal(false);
  readonly retryable = signal(true);
  readonly limit = signal(RECOMENDACIONES_LIMITE_DEFECTO);
  readonly result = signal<RecomendacionesRespuesta | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.busy.set(true);
    this.error.set('');
    this.loginRequired.set(false);
    this.retryable.set(true);
    this.result.set(null);
    this.service.listar(this.limit()).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)),
    ).subscribe({
      next: value => this.result.set(value),
      error: (error: unknown) => {
        this.error.set(recomendacionesError(error));
        this.loginRequired.set(error instanceof HttpErrorResponse && error.status === 401);
        this.retryable.set(!(error instanceof HttpErrorResponse && [401, 403, 422].includes(error.status)));
      },
    });
  }
}
