import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu11Layout } from '../../components/cu11-layout';
import { ReservasFiltros, ReservasListado } from '../../models/reserva.models';
import { ReservasService } from '../../services/reservas.service';
import { reservaError } from '../../services/reserva-error';

@Component({ selector: 'app-mis-reservas', imports: [Cu11Layout, ReactiveFormsModule, RouterLink], templateUrl: './mis-reservas.html',
  styles: `.table-scroll { overflow-x: auto; } table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--line); } .actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin: 20px 0; } .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--line); font-size: 0.85rem; }`,
})
export class MisReservasPage {
  private readonly service = inject(ReservasService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  private filters: ReservasFiltros = { offset: 0, limit: 20 };
  readonly busy = signal(false); readonly error = signal(''); readonly result = signal<ReservasListado | null>(null);
  readonly form = inject(NonNullableFormBuilder).group({ estado: [''] });
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const offset = Number(params.get('offset') ?? 0), limit = Number(params.get('limit') ?? 20);
      const estado = params.get('estado');
      this.filters = { offset: Number.isSafeInteger(offset) && offset >= 0 ? offset : 0,
        limit: Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : 20,
        ...(estado === 'pendiente' || estado === 'confirmada' || estado === 'atendida'
          || estado === 'cancelada' || estado === 'vencida' ? { estado } : {}) };
      this.form.reset({ estado: this.filters.estado ?? '' });
      this.load();
    });
  }
  aplicar(): void {
    const estado = this.form.getRawValue().estado;
    void this.router.navigate([], { relativeTo: this.route,
      queryParams: { offset: 0, limit: this.filters.limit, ...(estado !== '' ? { estado } : {}) } });
  }
  pagina(offset: number): void {
    if (this.busy()) return;
    void this.router.navigate([], { relativeTo: this.route,
      queryParams: { offset: Math.max(0, offset), limit: this.filters.limit,
        ...(this.filters.estado ? { estado: this.filters.estado } : {}) } });
  }
  load(): void {
    this.request?.unsubscribe();
    this.busy.set(true); this.error.set(''); this.result.set(null);
    this.request = this.service.listar(this.filters).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: value => this.result.set(value), error: (error: unknown) => this.error.set(reservaError(error)),
    });
  }
}
