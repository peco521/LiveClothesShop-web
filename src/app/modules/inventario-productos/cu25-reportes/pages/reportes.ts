import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { InventarioPanel, requestError } from '../../shared/panel';
import { OperacionesService } from '../../shared/operaciones.service';
import { Refs, Report } from '../../shared/operaciones.models';

type ReportKind = 'ventas' | 'inventario' | 'reservas' | 'devoluciones';
type ReportFormat = 'pdf' | 'xlsx';

@Component({ selector: 'app-reportes', imports: [FormsModule, CurrencyPipe, InventarioPanel],
  templateUrl: './reportes.html', styleUrls: ['../../shared/panel.css', '../../shared/operaciones.css'] })
export class ReportesPage {
  private readonly service = inject(OperacionesService);
  private readonly destroy = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly refs = signal<Refs | null>(null);
  readonly report = signal<Report | null>(null);
  readonly busy = signal(false);
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly kinds: ReportKind[] = ['ventas', 'inventario', 'reservas', 'devoluciones'];
  /** Nombre visible de cada reporte exportable. */
  readonly labels: Record<ReportKind, string> = { ventas: 'Reporte de ventas', inventario: 'Inventario',
    reservas: 'Reservas', devoluciones: 'Devoluciones' };
  fechaIni = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA');
  fechaFin = new Date().toLocaleDateString('en-CA');
  nroSuc = 0;
  idCat = 0;
  idTemp = 0;

  constructor() { this.loadReferences(); this.load(); }

  private filters(): Record<string, string | number | undefined> {
    return { fechaIni: this.fechaIni, fechaFin: this.fechaFin, nroSuc: this.nroSuc || undefined,
      idCat: this.idCat || undefined, idTemp: this.idTemp || undefined };
  }

  loadReferences(): void {
    this.service.get<Refs>('reportes/referencias').pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: refs => this.refs.set(refs),
      error: e => this.error.set(requestError(e, this.router)),
    });
  }

  load(): void {
    if (this.busy()) return;
    if (!this.fechaIni || !this.fechaFin) { this.error.set('Indica el rango de fechas del reporte.'); return; }
    this.busy.set(true); this.error.set(''); this.success.set('');
    this.service.get<Report>('reportes', this.filters())
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({ next: value => this.report.set(value), error: e => { this.report.set(null); this.error.set(requestError(e, this.router)); } });
  }

  download(tipo: ReportKind, formato: ReportFormat): void {
    if (this.exporting()) return;
    if (!this.fechaIni || !this.fechaFin) { this.error.set('Indica el rango de fechas antes de exportar.'); return; }
    this.exporting.set(true); this.error.set(''); this.success.set('');
    this.service.export({ ...this.filters(), tipo, formato })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.exporting.set(false))).subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob as Blob);
          const anchor = document.createElement('a');
          anchor.href = url; anchor.download = `reporte-${tipo}.${formato}`; anchor.click();
          URL.revokeObjectURL(url);
          this.success.set(`Reporte de ${tipo} generado correctamente.`);
        },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }
}
