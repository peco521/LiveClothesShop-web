import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Cu08Layout } from '../../components/cu08-layout';
import { BitacoraFiltrosComponent } from '../../components/bitacora-filtros';
import { BitacoraFiltros, BitacoraListado } from '../../models/bitacora.models';
import { BitacoraService } from '../../services/bitacora.service';
import { bitacoraError } from '../../services/bitacora-error';

@Component({ selector: 'app-bitacora-lista', imports: [Cu08Layout, BitacoraFiltrosComponent, RouterLink], templateUrl: './bitacora-lista.html',
  styles: `.table-scroll { overflow-x: auto; } table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; } nav { display: flex; gap: 16px; margin-top: 20px; }`,
})
export class BitacoraListaPage {
  private readonly service = inject(BitacoraService);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  private filters: BitacoraFiltros = { offset: 0, limit: 20 };
  readonly busy = signal(false); readonly error = signal(''); readonly result = signal<BitacoraListado | null>(null);
  constructor() { this.load(); }
  aplicar(filters: BitacoraFiltros): void { this.filters = { ...filters, offset: 0 }; this.load(); }
  pagina(offset: number): void {
    if (this.busy() || !Number.isSafeInteger(offset) || offset < 0) return;
    this.filters = { ...this.filters, offset }; this.load();
  }
  load(): void {
    this.request?.unsubscribe(); this.result.set(null); this.error.set(''); this.busy.set(true);
    this.request = this.service.listar(this.filters).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({ next: value => this.result.set(value), error: (error: unknown) => this.error.set(bitacoraError(error)) });
  }
}
