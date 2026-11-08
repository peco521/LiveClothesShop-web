import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { InventarioPanel, requestError } from '../../../inventario-productos/shared/panel';
import { OperacionesService } from '../../../inventario-productos/shared/operaciones.service';
import { ExchangeVariant, Return, Sale } from '../../../inventario-productos/shared/operaciones.models';
import { Page } from '../../../inventario-productos/shared/models';

@Component({ selector: 'app-devoluciones', imports: [FormsModule, RouterLink, CurrencyPipe, InventarioPanel],
  templateUrl: './devoluciones.html', styleUrls: ['../../../inventario-productos/shared/panel.css', '../../../inventario-productos/shared/operaciones.css'] })
export class DevolucionesPage {
  private readonly service = inject(OperacionesService);
  private readonly destroy = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly page = signal<Page<Return> | null>(null);
  readonly sale = signal<Sale | null>(null);
  readonly exchangeVariants = signal<ExchangeVariant[]>([]);
  readonly inspections = signal<Record<number, Record<number, 'apta' | 'danada' | ''>>>({});
  readonly busy = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  operation: 'devolucion' | 'cambio' = 'devolucion';
  saleSearch: number | null = null;
  motivo = '';
  returnQuantities: Record<number, number> = {};
  newVariants: Record<number, string> = {};
  private pendingOperation: { fingerprint: string; id: string } | null = null;

  constructor() { this.load(); }

  load(offset = 0): void {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.get<Page<Return>>('devoluciones', { offset, limit: 20 })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({
        next: r => {
          this.page.set(r);
          const current = this.inspections();
          const restored = { ...current };
          for (const row of r.items) {
            restored[row.nroDev] = { ...restored[row.nroDev] };
            for (const item of row.items) {
              if (item.condicion) restored[row.nroDev][item.idDetalleVenta] = item.condicion;
            }
          }
          this.inspections.set(restored);
        },
        error: e => { this.page.set(null); this.error.set(requestError(e, this.router)); },
      });
  }

  findSale(): void {
    if (!Number.isInteger(this.saleSearch) || (this.saleSearch ?? 0) < 1) { this.error.set('Ingresa el número de venta del comprobante.'); return; }
    this.sale.set(null); this.exchangeVariants.set([]); this.returnQuantities = {}; this.newVariants = {};
    this.motivo = ''; this.pendingOperation = null; this.error.set(''); this.success.set('');
    this.service.get<Sale>(`devoluciones/ventas/${this.saleSearch}`)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: value => {
          this.sale.set(value);
          for (const item of value.items) this.returnQuantities[item.idDetalleVenta] = 0;
          if (this.operation === 'cambio') this.loadExchangeVariants(value.nroVenta);
        },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  setOperation(operation: 'devolucion' | 'cambio'): void {
    this.operation = operation;
    this.pendingOperation = null;
    if (operation === 'cambio' && this.sale()) this.loadExchangeVariants(this.sale()!.nroVenta);
  }

  private loadExchangeVariants(nroVenta: number): void {
    this.service.get<ExchangeVariant[]>(`devoluciones/ventas/${nroVenta}/variantes`)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: variants => this.exchangeVariants.set(variants),
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  variantsFor(idVar: string): ExchangeVariant[] {
    return this.exchangeVariants().filter(variant => variant.idVar !== idVar);
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
    if (!row.idCliente) { this.error.set('La venta no tiene un cliente titular y no admite esta gestión administrativa.'); return; }
    const body: Record<string, unknown> = {
      nroVenta: row.nroVenta, idCliente: row.idCliente, motivo: this.motivo.trim(), items,
    };
    if (this.operation === 'cambio') {
      const exchangeItems = items.map(item => ({
        ...item,
        idVarNueva: this.newVariants[item.idDetalleVenta],
      }));
      if (exchangeItems.some(item => !item.idVarNueva)) {
        this.error.set('Selecciona la nueva variante para cada prenda del cambio.');
        return;
      }
      body['items'] = exchangeItems;
    }
    const fingerprint = JSON.stringify(body);
    if (this.pendingOperation?.fingerprint !== fingerprint) {
      this.pendingOperation = { fingerprint, id: crypto.randomUUID() };
    }
    body['idOperacion'] = this.pendingOperation.id;
    this.saving.set(true); this.error.set(''); this.success.set('');
    const path = this.operation === 'cambio' ? 'devoluciones/cambios' : 'devoluciones';
    this.service.send(path, body)
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: () => {
          this.pendingOperation = null;
          this.sale.set(null); this.motivo = ''; this.returnQuantities = {}; this.newVariants = {};
          this.success.set(this.operation === 'cambio'
            ? 'Cambio registrado. La nueva venta puede requerir pago o confirmación del reembolso.'
            : 'Solicitud registrada. Inspecciona cada prenda antes de aceptarla.');
          this.load();
        },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  setInspection(nroDev: number, detailId: number, condition: 'apta' | 'danada' | ''): void {
    this.inspections.update(current => ({
      ...current,
      [nroDev]: { ...current[nroDev], [detailId]: condition },
    }));
  }

  canApprove(row: Return): boolean {
    return row.items.every(item => this.inspections()[row.nroDev]?.[item.idDetalleVenta] === 'apta'
      || this.inspections()[row.nroDev]?.[item.idDetalleVenta] === 'danada');
  }

  decideReturn(row: Return, action: 'inspeccionar' | 'aprobar' | 'rechazar'): void {
    if (this.saving()) return;
    const inspections = action === 'rechazar' ? [] : row.items.map(item => ({
      idDetalleVenta: item.idDetalleVenta,
      condicion: this.inspections()[row.nroDev]?.[item.idDetalleVenta],
    }));
    if (action !== 'rechazar' && inspections.some(item => item.condicion !== 'apta' && item.condicion !== 'danada')) {
      this.error.set('Registra la condición de cada prenda antes de continuar.');
      return;
    }
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.send<Return>(`devoluciones/${row.nroDev}/decision`, {
      accion: action, inspecciones: inspections,
    })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: () => {
          this.success.set(action === 'aprobar' ? 'Devolución aprobada. Inventario y reembolso actualizados.'
            : action === 'inspeccionar' ? 'Inspección registrada. Confirma la aceptación o el rechazo.'
              : 'Devolución rechazada.');
          this.load();
        },
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
