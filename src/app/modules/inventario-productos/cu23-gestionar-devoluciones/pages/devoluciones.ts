import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { InventarioPanel, requestError } from '../../shared/panel';
import { OperacionesService } from '../../shared/operaciones.service';
import { Return, Sale } from '../../shared/operaciones.models';
import { Page } from '../../shared/models';

@Component({ selector: 'app-devoluciones', imports: [FormsModule, RouterLink, CurrencyPipe, InventarioPanel],
  templateUrl: './devoluciones.html', styleUrls: ['../../shared/panel.css', '../../shared/operaciones.css'] })
export class DevolucionesPage {
  private readonly service = inject(OperacionesService);
  private readonly destroy = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly page = signal<Page<Return> | null>(null);
  readonly sale = signal<Sale | null>(null);
  readonly busy = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  saleSearch: number | null = null;
  motivo = '';
  returnQuantities: Record<number, number> = {};
  buenEstado: Record<number, boolean> = {};

  constructor() { this.load(); }

  load(offset = 0): void {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.get<Page<Return>>('devoluciones', { offset, limit: 20 })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({ next: r => this.page.set(r), error: e => { this.page.set(null); this.error.set(requestError(e, this.router)); } });
  }

  findSale(): void {
    if (!Number.isInteger(this.saleSearch) || (this.saleSearch ?? 0) < 1) { this.error.set('Ingresa el número de venta del comprobante.'); return; }
    this.sale.set(null); this.returnQuantities = {}; this.motivo = ''; this.error.set(''); this.success.set('');
    this.service.get<Sale>(`devoluciones/ventas/${this.saleSearch}`)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: value => { this.sale.set(value); for (const item of value.items) this.returnQuantities[item.idDetalleVenta] = 0; },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  selectedItems(): { idDetalleVenta: number; cantidad: number }[] {
    return Object.entries(this.returnQuantities).filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => ({ idDetalleVenta: Number(id), cantidad: quantity }));
  }

  registerReturn(): void {
    const row = this.sale();
    const items = this.selectedItems();
    if (this.saving() || !row) return;
    if (!items.length) { this.error.set('Indica la cantidad a devolver de al menos una prenda.'); return; }
    if (!this.motivo.trim()) { this.error.set('Describe el motivo de la devolución.'); return; }
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.send('devoluciones', { nroVenta: row.nroVenta, idCliente: row.idCliente, motivo: this.motivo.trim(), items })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: () => { this.sale.set(null); this.motivo = ''; this.returnQuantities = {}; this.success.set('Solicitud registrada. Verifica el estado de las prendas antes de aceptarla.'); this.load(); },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  decideReturn(row: Return, approve: boolean): void {
    if (this.saving()) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.send<Return>(`devoluciones/${row.nroDev}/decision`, { accion: approve ? 'aprobar' : 'rechazar', buenEstado: this.buenEstado[row.nroDev] === true })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: () => { this.success.set(approve ? 'Devolución aprobada. Inventario repuesto y reembolso registrado.' : 'Devolución rechazada.'); this.load(); },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  refund(row: Return): void {
    if (this.saving()) return;
    const cash = row.reembolso?.metodo === 'efectivo';
    if (!window.confirm(cash ? 'Confirma que entregarás al cliente el importe indicado en efectivo.' : '¿Confirmas solicitar el reembolso a la pasarela original?')) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.send<Return>(`devoluciones/${row.nroDev}/reembolsar`)
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: () => { this.success.set('Estado del reembolso actualizado.'); this.load(); },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }
}
