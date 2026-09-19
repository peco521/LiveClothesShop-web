import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { InventarioPanel, requestError } from '../../shared/panel';
import { OperacionesService } from '../../shared/operaciones.service';
import { Reservation } from '../../shared/operaciones.models';
import { Page } from '../../shared/models';

type ReservationAction = 'confirmar' | 'atender' | 'reprogramar';

@Component({ selector: 'app-reservas-sucursal', imports: [FormsModule, DatePipe, InventarioPanel],
  templateUrl: './reservas-sucursal.html', styleUrls: ['../../shared/panel.css', '../../shared/operaciones.css'] })
export class ReservasSucursalPage {
  private readonly service = inject(OperacionesService);
  private readonly destroy = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly page = signal<Page<Reservation> | null>(null);
  readonly reservation = signal<Reservation | null>(null);
  readonly busy = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  status = '';
  reservationDate = '';
  reservationTime = '';

  constructor() { this.load(); }

  load(offset = 0): void {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.get<Page<Reservation>>('reservas-sucursal', { estado: this.status, offset, limit: 20 })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false)))
      .subscribe({ next: r => this.page.set(r), error: e => { this.page.set(null); this.error.set(requestError(e, this.router)); } });
  }

  showReservation(row: Reservation): void {
    if (this.saving()) return;
    this.error.set(''); this.success.set('');
    this.service.get<Reservation>(`reservas-sucursal/${row.nroReserva}`)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: value => { this.reservation.set(value); this.reservationDate = value.fechaReserva; this.reservationTime = value.horaAtencion.slice(0, 5); },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  closeDetail(): void { if (!this.saving()) { this.reservation.set(null); this.error.set(''); } }

  /** Pasa el cobro de la reserva al punto de venta (CU24): el pago la marca atendida. */
  chargeInCashier(row: Reservation): void {
    const queries: Record<string, string | number> = { reserva: row.nroReserva, sucursal: row.sucursal.nro };
    if (row.idCliente) queries['cliente'] = row.idCliente;
    this.router.navigate(['/admin/caja'], { queryParams: queries });
  }

  reservationAction(action: ReservationAction): void {
    const row = this.reservation();
    if (!row || this.saving()) return;
    if (action === 'reprogramar' && (!this.reservationDate || !this.reservationTime)) {
      this.error.set('Indica la nueva fecha y hora de la visita.'); return;
    }
    const body = action === 'reprogramar'
      ? { accion: action, fechaReserva: this.reservationDate, horaAtencion: this.reservationTime }
      : { accion: action };
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.service.send<Reservation>(`reservas-sucursal/${row.nroReserva}/accion`, body)
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
        next: value => {
          this.reservation.set(value); this.success.set('Reserva actualizada correctamente.'); this.load();
          // Con las prendas preparadas se cobra en CU24: el pago actualiza el estado a atendida.
          if (action === 'confirmar') this.chargeInCashier({ ...row, ...value });
        },
        error: e => this.error.set(requestError(e, this.router)),
      });
  }

  readonly actions: Record<Reservation['estado'], string> = {
    pendiente: 'Pendiente de preparación', confirmada: 'Preparada, esperando al cliente',
    atendida: 'Entregada al cliente', cancelada: 'Cancelada por el cliente', vencida: 'Vencida sin retiro',
  };
}
