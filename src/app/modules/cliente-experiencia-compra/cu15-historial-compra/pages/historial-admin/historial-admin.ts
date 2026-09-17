import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { finalize, Subscription } from 'rxjs';
import { CompraDetalle, HistorialCompras } from '../../models/historial.models';
import { ClienteHistorial, ClientesHistorial, FiltrosHistorial, HistorialAdminService } from '../../services/historial-admin.service';
import { CompraEstados } from '../../components/compra-estados';

@Component({ selector: 'app-historial-admin', imports: [ReactiveFormsModule, DatePipe, CurrencyPipe, CompraEstados], templateUrl: './historial-admin.html',
  styles: `:host { display: block; max-width: 1100px; margin: auto; } .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; } .compact { width: auto; display: inline-flex; min-height: 44px; margin: 4px 8px 8px 0; } .secondary { background: var(--paper); border-color: var(--line); color: var(--ink); } .panel { background: var(--paper); padding: 22px; border: 1px solid var(--line); border-radius: 12px; margin: 20px 0; } .table-scroll { overflow-x: auto; } table { width: 100%; border-collapse: collapse; } th, td { padding: 12px; text-align: left; border-bottom: 1px solid var(--line); } small { display: block; color: var(--muted); } .purchase-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; }`,
})
export class HistorialAdminPage {
  private readonly service = inject(HistorialAdminService);
  private readonly destroy = inject(DestroyRef);
  private searchRequest?: Subscription;
  private historyRequest?: Subscription;
  private detailRequest?: Subscription;
  readonly clients = signal<ClientesHistorial | null>(null);
  readonly selected = signal<ClienteHistorial | null>(null);
  readonly history = signal<HistorialCompras | null>(null);
  readonly detail = signal<CompraDetalle | null>(null);
  readonly searching = signal(false);
  readonly loadingHistory = signal(false);
  readonly loadingDetail = signal(false);
  readonly error = signal('');
  readonly historyError = signal('');
  readonly detailError = signal('');
  readonly form = new FormGroup({ ci: new FormControl('', { nonNullable: true }), nombre: new FormControl('', { nonNullable: true }), apellidos: new FormControl('', { nonNullable: true }), correo: new FormControl('', { nonNullable: true }) });
  private filters: FiltrosHistorial = this.form.getRawValue();
  constructor() { this.search(); }
  private message(error: unknown): string {
    return error instanceof HttpErrorResponse && error.status === 403 ? 'No tienes autorización para consultar este historial.'
      : error instanceof HttpErrorResponse && error.status === 401 ? 'Tu sesión expiró. Inicia sesión nuevamente.' : 'No fue posible obtener la información. Inténtalo nuevamente.';
  }
  search(offset = 0): void {
    if (offset === 0) {
      const value = this.form.getRawValue();
      if (Object.values(value).some(v => v.trim().length > 100)) { this.error.set('Los filtros admiten hasta 100 caracteres.'); return; }
      this.filters = value;
    }
    this.searchRequest?.unsubscribe(); this.historyRequest?.unsubscribe(); this.detailRequest?.unsubscribe();
    this.selected.set(null); this.history.set(null); this.detail.set(null); this.historyError.set(''); this.detailError.set(''); this.error.set(''); this.clients.set(null); this.searching.set(true);
    this.searchRequest = this.service.clientes(this.filters, offset).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.searching.set(false))).subscribe({ next: result => this.clients.set(result), error: error => this.error.set(this.message(error)) });
  }
  select(client: ClienteHistorial): void { this.selected.set(client); this.loadHistory(); }
  loadHistory(offset = 0): void {
    const client = this.selected(); if (!client) return;
    this.historyRequest?.unsubscribe(); this.detailRequest?.unsubscribe(); this.history.set(null); this.detail.set(null); this.historyError.set(''); this.detailError.set(''); this.loadingHistory.set(true);
    this.historyRequest = this.service.historial(client.idUsuario, offset).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loadingHistory.set(false))).subscribe({ next: result => this.history.set(result), error: error => this.historyError.set(this.message(error)) });
  }
  loadDetail(nro: number): void {
    const client = this.selected(); if (!client) return;
    this.detailRequest?.unsubscribe(); this.detail.set(null); this.detailError.set(''); this.loadingDetail.set(true);
    this.detailRequest = this.service.detalle(client.idUsuario, nro).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loadingDetail.set(false))).subscribe({ next: result => this.detail.set(result), error: error => this.detailError.set(this.message(error)) });
  }
}
